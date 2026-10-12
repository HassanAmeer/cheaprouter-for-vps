/** One-shot: string-verify every orphan candidate (catches dynamic refs). */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const orphans = JSON.parse(fs.readFileSync("/tmp/opencode/orphans.json", "utf8"));

// Build search corpus: all tracked + untracked-but-not-ignored files, minus
// binaries/build output. Use git ls-files + others.
let allFiles;
try {
  allFiles = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execSync("git ls-files --others --exclude-standard", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  allFiles = [...new Set([...allFiles, ...untracked])];
} catch {
  allFiles = [];
}
function searchKey(rel) {
  const base = path.basename(rel).replace(/\.(d\.ts|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, "");
  if (base === "index") {
    // barrel: search by directory path instead
    return path.dirname(rel).split(path.sep).slice(-2).join("/");
  }
  return base;
}

const cache = new Map();
function fileText(abs) {
  if (!cache.has(abs)) {
    try {
      const s = fs.statSync(abs);
      if (s.size > 2_000_000) cache.set(abs, "");
      else cache.set(abs, fs.readFileSync(abs, "utf8"));
    } catch {
      cache.set(abs, "");
    }
  }
  return cache.get(abs);
}

const results = [];
for (const rel of orphans) {
  const key = searchKey(rel);
  const hits = [];
  for (const f of allFiles) {
    if (f === rel) continue;
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map|lock|db|sqlite|log)$/.test(f)) continue;
    const text = fileText(path.join(root, f));
    if (text.includes(key)) hits.push(f);
  }
  const codeHits = hits.filter(
    (h) => !h.startsWith("docs/") && !h.endsWith(".md") && h !== "package-lock.json"
  );
  const docsHits = hits.filter(
    (h) => h.startsWith("docs/") || h.endsWith(".md")
  );
  results.push({ file: rel, key, codeHits, docsHits });
}

const deletable = results.filter((r) => r.codeHits.length === 0);
const kept = results.filter((r) => r.codeHits.length > 0);
console.log(`candidates: ${results.length} | DELETE (no code refs): ${deletable.length} | KEEP/INVESTIGATE: ${kept.length}`);
fs.writeFileSync("/tmp/opencode/orphan-verdict.json", JSON.stringify({ deletable, kept }, null, 1));
console.log("\n== DELETE ==");
for (const d of deletable) {
  const extra = d.docsHits.length ? `  [docs mention: ${d.docsHits.length}]` : "";
  console.log(`  ${d.file}${extra}`);
}
