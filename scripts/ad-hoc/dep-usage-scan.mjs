/** One-shot: report import-usage of every dependency across the repo. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  ".source",
  "data",
  "coverage",
  ".turbo",
  "build",
]);
const CODE_EXT = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

function* walk(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name));
    } else if (CODE_EXT.has(path.extname(e.name))) {
      yield path.join(dir, e.name);
    }
  }
}

const staticRe =
  /(?:import|export)\s+[^;]*?\sfrom\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function pkgOf(spec) {
  if (!spec || spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("#")) return null;
  if (/^(node:|data:|https?:|blob:|file:)/.test(spec)) return null;
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const usage = new Map(); // pkg -> Set<file>
let files = 0;
for (const f of walk(root)) {
  files++;
  let src;
  try {
    src = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  staticRe.lastIndex = 0;
  let m;
  while ((m = staticRe.exec(src))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    const pkg = pkgOf(spec);
    if (!pkg) continue;
    if (!usage.has(pkg)) usage.set(pkg, new Set());
    usage.get(pkg).add(path.relative(root, f));
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
// mentions in npm scripts / configs (binaries, loaders, etc.)
const haystack = [
  JSON.stringify(pkg.scripts || {}),
  JSON.stringify(pkg.bin || {}),
  safeRead("postcss.config.mjs"),
  safeRead("next.config.mjs"),
  safeRead("eslint.config.mjs"),
  safeRead("playwright.config.ts"),
  safeRead("vitest.config.ts"),
  safeRead(".npmrc"),
];
function safeRead(p) {
  try {
    return fs.readFileSync(path.join(root, p), "utf8");
  } catch {
    return "";
  }
}
const hay = haystack.join("\n");

console.log(`scanned ${files} code files\n`);
const rows = [];
for (const name of Object.keys(all).sort()) {
  const inCode = usage.get(name)?.size || 0;
  const inConfig = hay.includes(name);
  rows.push({ name, inCode, inConfig, sample: [...(usage.get(name) || [])].slice(0, 3) });
}
const unused = rows.filter((r) => r.inCode === 0 && !r.inConfig);
console.log(`== deps with ZERO static import + zero script/config mention: ${unused.length} ==`);
for (const r of unused) console.log(`  ${r.name}`);
console.log(`\n== low-use deps (1-2 files), review list ==`);
for (const r of rows.filter((r) => r.inCode >= 1 && r.inCode <= 2))
  console.log(`  ${r.name} (${r.inCode}): ${r.sample.join(", ")}`);
fs.writeFileSync("/tmp/opencode/dep-usage.json", JSON.stringify(rows, null, 1));
