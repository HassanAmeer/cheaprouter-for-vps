/**
 * One-shot codemod: eliminate @typescript-eslint/no-unused-vars errors.
 *
 * Reads an ESLint JSON report, and for every `no-unused-vars` hit applies a
 * behavior-preserving fix using the TypeScript compiler API:
 *   - unused import specifier  -> removed (statement kept as side-effect
 *                                import when it would otherwise go empty,
 *                                so module-evaluation side effects survive;
 *                                pure type-only imports are deleted instead)
 *   - unused catch binding     -> `catch (e)` becomes `catch`
 *   - unused binding element   -> `{ a }` becomes `{ a: _a }` (same prop read)
 *   - everything else (params, locals, functions, classes, types, ...)
 *                              -> renamed to `_name` (all same-symbol refs,
 *                                so closures/writes keep working)
 *
 * Skipped (reported, left for humans): `this` params, enum members,
 * anything inside `declare global`, tokens without a symbol.
 *
 * Usage:
 *   node_modules/.bin/eslint . --no-cache --format json -o /tmp/lint.json
 *   node scripts/ad-hoc/remove-unused-vars.mjs /tmp/lint.json
 */
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const RULE = "@typescript-eslint/no-unused-vars";

const lintJsonPath = process.argv[2];
if (!lintJsonPath) {
  console.error("usage: remove-unused-vars.mjs <eslint-json-report>");
  process.exit(1);
}
const repoRoot = process.cwd();
const report = JSON.parse(fs.readFileSync(lintJsonPath, "utf8"));

// Group hits by file.
const byFile = new Map();
for (const entry of report) {
  const hits = (entry.messages || []).filter(
    (m) => m.ruleId === RULE && m.severity === 2 && /never used/.test(m.message || "")
  );
  if (hits.length === 0) continue;
  const name = entry.filePath.match(/'([^']+)'/)?.[1] ?? null;
  const list = hits.map((m) => ({
    line: m.line,
    col: m.column,
    name,
  }));
  if (!byFile.has(entry.filePath)) byFile.set(entry.filePath, []);
  byFile.get(entry.filePath).push(...list);
}
const files = [...byFile.keys()];
console.log(`files with ${RULE}: ${files.length}`);

// Fast program: we only need same-file symbol resolution, so skip module
// resolution entirely. Imports are handled purely syntactically.
const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  checkJs: false,
  skipLibCheck: true,
  noResolve: true,
  noEmit: true,
  strict: false,
});
const checker = program.getTypeChecker();

function deepestIdentifier(sf, pos) {
  let found = null;
  function visit(node) {
    if (node.pos <= pos && pos < node.end) {
      if (ts.isIdentifier(node)) found = node;
      ts.forEachChild(node, visit);
    }
  }
  visit(sf);
  return found;
}

function freeName(sf, base) {
  const text = sf.getFullText();
  let candidate = base.startsWith("_") ? base : `_${base}`;
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  while (new RegExp(`\\b${esc(candidate)}\\b`).test(text)) candidate += "_";
  return candidate;
}

function insideDeclareGlobal(node) {
  let n = node;
  while (n) {
    if (
      ts.isModuleBlock(n) &&
      ts.isModuleDeclaration(n.parent) &&
      n.parent.name &&
      ts.isIdentifier(n.parent.name) &&
      n.parent.name.text === "global"
    ) {
      return true;
    }
    n = n.parent;
  }
  return false;
}

let fixed = 0;
const skipped = [];

for (const filePath of files) {
  const rel = path.relative(repoRoot, filePath);
  const sf = program.getSourceFile(filePath);
  if (!sf) {
    skipped.push(`${rel}: no source file`);
    continue;
  }
  const edits = []; // {start,end,text}
  const addEdit = (start, end, text) => edits.push({ start, end, text });

  // Collect `import { … }` specifier removals per NamedImports list first:
  // piecemeal per-specifier ranges can OVERLAP (first+last of a 2-list eats
  // the closing brace), so each specifier list is resolved as a whole.
  const specHitsByList = new Map(); // ts.Node (NamedImports) -> Array<ImportSpecifier>
  const flaggedDefaultClauses = new Set(); // ImportClause whose default import is flagged
  const flaggedNamespaces = new Set(); // NamespaceImport nodes flagged unused
  const emptiedStmts = new Set(); // ImportDeclaration fully emptied -> handleEmpty owns it
  const otherHits = [];
  for (const hit of byFile.get(filePath)) {
    let pos;
    try {
      pos = sf.getPositionOfLineAndCharacter(hit.line - 1, hit.col - 1);
    } catch {
      skipped.push(`${rel}:${hit.line}:${hit.col}: bad position`);
      continue;
    }
    const token = deepestIdentifier(sf, pos);
    if (!token || !ts.isIdentifier(token)) {
      skipped.push(`${rel}:${hit.line}:${hit.col}: no identifier at position`);
      continue;
    }
    if (hit.name && token.text !== hit.name) {
      skipped.push(`${rel}:${hit.line}:${hit.col}: token '${token.text}' != reported '${hit.name}'`);
      continue;
    }
    if (ts.isImportSpecifier(token.parent)) {
      const list = token.parent.parent;
      if (!specHitsByList.has(list)) specHitsByList.set(list, []);
      specHitsByList.get(list).push(token.parent);
    } else if (ts.isImportClause(token.parent) && token.parent.name === token) {
      flaggedDefaultClauses.add(token.parent);
      otherHits.push({ hit, token });
    } else if (ts.isNamespaceImport(token.parent)) {
      flaggedNamespaces.add(token.parent);
      otherHits.push({ hit, token });
    } else {
      otherHits.push({ hit, token });
    }
  }

  const resolveSpecifierList = (list) => {
    const elements = [...list.elements];
    const flagged = new Set(specHitsByList.get(list) || []);
    const survivors = elements.filter((e) => !flagged.has(e));
    const clause = list.parent; // ImportClause
    const stmt = clause.parent; // ImportDeclaration
    // A default import (`import Foo, { … }`) is NOT part of `elements`:
    // the statement still has a survivor even when every named specifier
    // is flagged. Only a bare `import { … }` with zero survivors is empty.
    // (A flagged default is tracked separately and coordinated below.)
    const hasLiveDefault = !!clause.name && !flaggedDefaultClauses.has(clause);
    if (survivors.length === 0 && !hasLiveDefault) {
      emptiedStmts.add(stmt);
      handleEmptyImport(stmt, clause);
      return;
    }
    if (survivors.length === 0 && hasLiveDefault) {
      // `import Foo, { Gone }` -> `import Foo from "m"`: drop the braces.
      const named = clause.namedBindings;
      addEdit(named.getStart(sf), named.getEnd(), "");
      return;
    }
    // Remove flagged ones with provably disjoint ranges: if a survivor
    // follows, drop [flagged.start, nextOriginal.start); otherwise drop
    // [prevOriginal.end, flagged.end) — adjacent to the neighbour's range,
    // never overlapping (idx >= 1 here: with no survivor after AND idx 0,
    // survivors would be empty, handled above).
    elements.forEach((el, idx) => {
      if (!flagged.has(el)) return;
      const nextSurvivor = elements.slice(idx + 1).find((e) => !flagged.has(e));
      if (nextSurvivor) {
        addEdit(el.getStart(sf), elements[idx + 1].getStart(sf), "");
      } else {
        addEdit(elements[idx - 1].getEnd(), el.getEnd(), "");
      }
    });
  };

  const renameSymbolEverywhere = (token, symbol) => {
    const newName = freeName(sf, token.text);
    const walk = (node) => {
      if (ts.isIdentifier(node)) {
        try {
          if (checker.getSymbolAtLocation(node) === symbol) {
            addEdit(node.getStart(sf), node.getEnd(), newName);
          }
        } catch {
          /* unresolved: ignore */
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(sf);
  };

  const handleEmptyImport = (stmt, importClause) => {
    const named = importClause.namedBindings;
    const allTypeOnly =
      !!importClause.isTypeOnly ||
      (named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((e) => !!e.isTypeOnly));
    if (allTypeOnly) {
      addEdit(stmt.getStart(sf), stmt.getEnd(), ""); // fully erased anyway
    } else {
      addEdit(stmt.getStart(sf), stmt.getEnd(), `import ${stmt.moduleSpecifier.getText(sf)};`);
    }
  };

  // Resolve every touched `import { … }` list as a whole (disjoint ranges
  // by construction), then handle all non-specifier hits.
  for (const list of specHitsByList.keys()) {
    fixed += specHitsByList.get(list).length;
    resolveSpecifierList(list);
  }

  for (const { hit, token } of otherHits) {
    const label = `${rel}:${hit.line}:${hit.col}`;
    if (insideDeclareGlobal(token)) {
      skipped.push(`${label} '${token.text}': inside declare global`);
      continue;
    }
    const parent = token.parent;

    // 2. import Foo from "m" (default)
    if (ts.isImportClause(parent) && parent.name === token) {
      const stmt = parent.parent;
      if (emptiedStmts.has(stmt)) {
        fixed++; // whole statement already replaced by the list/namespace path
        continue;
      }
      if (parent.namedBindings) {
        if (
          ts.isNamespaceImport(parent.namedBindings) &&
          flaggedNamespaces.has(parent.namedBindings)
        ) {
          fixed++; // namespace branch owns the whole statement
          continue;
        }
        addEdit(token.getStart(sf), parent.namedBindings.getStart(sf), "");
      } else {
        handleEmptyImport(parent.parent, parent);
      }
      fixed++;
      continue;
    }
    // 3. import * as ns from "m"
    if (ts.isNamespaceImport(parent)) {
      const clause = parent.parent;
      const stmt = clause.parent;
      if (clause.name && !flaggedDefaultClauses.has(clause)) {
        // `import Foo, * as ns` -> `import Foo from "m"`: keep the live default.
        addEdit(clause.name.getEnd(), parent.getEnd(), "");
      } else {
        emptiedStmts.add(stmt);
        handleEmptyImport(stmt, clause);
      }
      fixed++;
      continue;
    }
    // 4. catch (e)  ->  catch  (parens located via AST, never text search:
    // a text lastIndexOf(")") would match a ")" inside the block body)
    if (
      ts.isVariableDeclaration(parent) &&
      parent.name === token &&
      ts.isCatchClause(parent.parent)
    ) {
      const kids = parent.parent.getChildren(sf);
      const open = kids.find((k) => k.kind === ts.SyntaxKind.OpenParenToken);
      const close = kids.find((k) => k.kind === ts.SyntaxKind.CloseParenToken);
      if (open && close) {
        addEdit(open.getStart(sf), close.getEnd(), "");
        fixed++;
      } else {
        skipped.push(`${label}: catch parens not found`);
      }
      continue;
    }
    // 5. binding element: const { a } = … / const [a] = …
    if (ts.isBindingElement(parent)) {
      if (ts.isArrayBindingPattern(parent.parent)) {
        // array position is meaningful: rename in place, `[a]` -> `[_a]`.
        // (`a: _a` would be object syntax — a parse error.)
        const symbol = checker.getSymbolAtLocation(token);
        if (!symbol) {
          skipped.push(`${label}: array element without symbol`);
          continue;
        }
        renameSymbolEverywhere(token, symbol);
      } else if (!parent.propertyName) {
        // shorthand: rewrite `a` -> `a: _a` (or `a = init` -> `a: _a = init`)
        const newName = freeName(sf, token.text);
        addEdit(token.getStart(sf), token.getEnd(), `${token.text}: ${newName}`);
      } else if (ts.isIdentifier(parent.name)) {
        // `prop: a` -> `prop: _a`
        const symbol = checker.getSymbolAtLocation(token);
        if (!symbol) {
          skipped.push(`${label}: no symbol`);
          continue;
        }
        renameSymbolEverywhere(token, symbol);
      } else {
        skipped.push(`${label}: nested binding pattern`);
        continue;
      }
      fixed++;
      continue;
    }
    // 6. variable / param / declaration name / type param -> rename everywhere
    const isDeclName =
      (ts.isVariableDeclaration(parent) && parent.name === token) ||
      (ts.isParameter(parent) && parent.name === token) ||
      ((ts.isFunctionDeclaration(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isInterfaceDeclaration(parent) ||
        ts.isTypeAliasDeclaration(parent) ||
        ts.isEnumDeclaration(parent) ||
        ts.isModuleDeclaration(parent)) &&
        parent.name === token) ||
      ts.isTypeParameterDeclaration(parent);
    if (isDeclName) {
      if (token.text === "this") {
        skipped.push(`${label}: 'this' parameter`);
        continue;
      }
      if (ts.isEnumMember(parent)) {
        skipped.push(`${label}: enum member`);
        continue;
      }
      let symbol = null;
      try {
        symbol = checker.getSymbolAtLocation(token);
      } catch {
        symbol = null;
      }
      if (!symbol) {
        skipped.push(`${label} '${token.text}': no symbol`);
        continue;
      }
      renameSymbolEverywhere(token, symbol);
      fixed++;
      continue;
    }
    skipped.push(`${label} '${token.text}': unhandled parent ${ts.SyntaxKind[parent.kind]}`);
  }

  if (edits.length === 0) continue;
  // Safety net: edits must be pairwise disjoint in original coordinates.
  // If any two overlap, skip the whole file for human review.
  const ordered = [...edits].sort((a, b) => a.start - b.start);
  let overlap = false;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].start < ordered[i - 1].end) {
      overlap = true;
      break;
    }
  }
  if (overlap) {
    skipped.push(`${rel}: OVERLAPPING edits — file left untouched`);
    continue;
  }
  edits.sort((a, b) => b.start - a.start);
  let text = sf.getFullText();
  for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  fs.writeFileSync(filePath, text);
  console.log(`  ${rel}: ${edits.length} edits`);
}

console.log(`\nfixed errors: ${fixed}`);
console.log(`skipped (${skipped.length}):`);
for (const s of skipped) console.log(`  - ${s}`);
