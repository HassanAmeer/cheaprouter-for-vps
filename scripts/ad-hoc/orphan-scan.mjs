/** One-shot: list code files with ZERO incoming static imports (orphan candidates). */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", ".source", "data", "coverage", ".turbo", "build", ".build"]);
const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function* walk(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith("." ) && e.name !== ".env.example") continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name));
    } else if (CODE_EXT.has(path.extname(e.name))) {
      yield path.join(dir, e.name);
    }
  }
}

// Next.js / tooling entry points: referenced by convention, never by import.
function isEntryRel(rel) {
  const b = path.basename(rel);
  if (/^(page|route|layout|loading|error|not-found|template|default)\.(tsx?|jsx?)$/.test(b)) return "app-route";
  if (b === "middleware.ts" || b === "instrumentation.ts") return "next-convention";
  if (/\.d\.ts$/.test(rel)) return "ambient-types";
  if (rel.startsWith("bin/")) return "bin-entry";
  if (/\.test\.(tsx?|jsx?)$/.test(b) || /\.spec\.(tsx?|jsx?)$/.test(b)) return "test-file";
  if (b === "next.config.mjs" || b === "eslint.config.mjs" || b === "postcss.config.mjs" || b === "prettier.config.mjs" || b === "playwright.config.ts" || b === "vitest.config.ts" || b === "tailwind.config.ts") return "tool-config";
  return null;
}

const staticRe = /(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm;

function resolveToFile(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(root, "src", spec.slice(2));
  else if (spec === "@cheaproute/open-sse") base = path.join(root, "open-sse", "index.ts");
  else if (spec.startsWith("@cheaproute/open-sse/")) base = path.join(root, "open-sse", spec.slice("@cheaproute/open-sse/".length));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare package
  const cands = [base];
  for (const ext of [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]) cands.push(base + ext);
  for (const ext of [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]) cands.push(base + ext);
  // ESM-style explicit extension that doesn't exist on disk (e.g. "./x.js" -> x.ts)
  const stripped = base.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, "");
  if (stripped !== base) {
    for (const ext of [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]) cands.push(stripped + ext);
  }
  for (const c of cands) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

const files = [...walk(root)];
const referenced = new Set();
const edges = {}; // importer rel -> [target rel]
for (const f of files) {
  let src;
  try {
    src = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  staticRe.lastIndex = 0;
  let m;
  while ((m = staticRe.exec(src))) {
    const t = resolveToFile(f, m[1] || m[2] || m[3] || m[4] || m[5]);
    if (t) {
      referenced.add(t);
      const rel = path.relative(root, f);
      edges[rel] = edges[rel] || [];
      edges[rel].push(path.relative(root, t));
    }
  }
}
fs.writeFileSync("/tmp/opencode/edges.json", JSON.stringify(edges));

const orphans = [];
for (const f of files) {
  if (referenced.has(f)) continue;
  const rel = path.relative(root, f);
  if (rel.startsWith("@cheaproute/")) continue; // foreign packages, out of scope
  const entry = isEntryRel(rel);
  if (entry) continue;
  orphans.push(rel);
}
console.log(`scanned ${files.length} files | orphan candidates: ${orphans.length}`);
const byDir = {};
for (const o of orphans) {
  const d = path.dirname(o);
  byDir[d] = byDir[d] || [];
  byDir[d].push(path.basename(o));
}
for (const [d, fs2] of Object.entries(byDir).sort()) console.log(`\n${d}/ (${fs2.length})\n  ${fs2.join("\n  ")}`);
fs.writeFileSync("/tmp/opencode/orphans.json", JSON.stringify(orphans));
