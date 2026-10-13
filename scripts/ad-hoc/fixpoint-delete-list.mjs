/** One-shot: transitive-orphan fixpoint + final delete list with exclusions. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const verdict = JSON.parse(fs.readFileSync("/tmp/opencode/orphan-verdict.json", "utf8"));
const edges = JSON.parse(fs.readFileSync("/tmp/opencode/edges.json", "utf8"));

// Files that are entries (never deleted) — same rules as orphan-scan.
function isEntryRel(rel) {
  const b = path.basename(rel);
  if (/^(page|route|layout|loading|error|not-found|template|default)\.(tsx?|jsx?)$/.test(b)) return true;
  if (b === "middleware.ts" || b === "instrumentation.ts") return true;
  if (/\.d\.ts$/.test(rel)) return true;
  if (rel.startsWith("bin/")) return true;
  if (/\.test\.(tsx?|jsx?)$/.test(b) || /\.spec\.(tsx?|jsx?)$/.test(b)) return true;
  if (rel.startsWith("@cheaproute/")) return true;
  return false;
}

// Exclusions: my session scripts + curated pipeline families + runnable benches.
const KEEP_PREFIX = [
  "scripts/cli/",
  "scripts/dev/",
  "scripts/docs/",
  "scripts/i18n/",
  "scripts/ops/",
  "scripts/release/",
  "scripts/sre/",
];
const KEEP_FILES = new Set([
  "scripts/ad-hoc/dep-usage-scan.mjs",
  "scripts/ad-hoc/orphan-scan.mjs",
  "scripts/ad-hoc/orphan-verify.mjs",
  "scripts/ad-hoc/remove-unused-vars.mjs",
  "scripts/ad-hoc/fixpoint-delete-list.mjs",
  "scripts/perf/routing-events-bench.ts",
  "scripts/perf/video-bridge-bench.ts",
  "scripts/perf/video-bridge-promotion-eval.ts",
]);
const excluded = (rel) =>
  KEEP_FILES.has(rel) || KEEP_PREFIX.some((p) => rel.startsWith(p));

const dead = new Set(
  verdict.deletable.map((d) => d.file).filter((f) => !excluded(f))
);

// Reverse edges: target -> importers.
const referrers = {};
for (const [imp, targets] of Object.entries(edges)) {
  for (const t of targets) {
    referrers[t] = referrers[t] || new Set();
    referrers[t].add(imp);
  }
}

// String corpus for dynamic-ref check of fixpoint candidates.
let allFiles;
try {
  allFiles = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execSync("git ls-files --others --exclude-standard", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  allFiles = [...new Set([...allFiles, ...untracked])];
} catch {
  allFiles = [];
}
const cache = new Map();
function fileText(abs) {
  if (!cache.has(abs)) {
    try {
      const s = fs.statSync(abs);
      cache.set(abs, s.size > 2_000_000 ? "" : fs.readFileSync(abs, "utf8"));
    } catch {
      cache.set(abs, "");
    }
  }
  return cache.get(abs);
}
function hasLiveStringRef(rel, deadSet) {
  const base = path.basename(rel).replace(/\.(d\.ts|ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, "");
  const key = base === "index" ? path.dirname(rel).split(path.sep).slice(-2).join("/") : base;
  for (const f of allFiles) {
    if (f === rel || deadSet.has(f)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map|lock|db|sqlite|log)$/.test(f)) continue;
    if (fileText(path.join(root, f)).includes(key)) return f;
  }
  return null;
}

// Fixpoint: a non-entry file whose every referrer is dead, and which has no
// live string refs, is transitively dead.
let changed = true;
const added = [];
while (changed) {
  changed = false;
  for (const [target, imps] of Object.entries(referrers)) {
    if (dead.has(target) || isEntryRel(target) || excluded(target)) continue;
    const live = [...imps].filter((i) => !dead.has(i));
    if (live.length === 0) {
      const hit = hasLiveStringRef(target, dead);
      if (!hit) {
        dead.add(target);
        added.push(target);
        changed = true;
      }
    }
  }
}

const final = [...dead].sort();
const directKept = verdict.deletable.filter((d) => dead.has(d.file)).length;
const excludedCount = verdict.deletable.length - directKept;
console.log(`direct-deletable: ${verdict.deletable.length} | excluded-pipelines: ${excludedCount} | transitive-added: ${added.length} | FINAL DELETE: ${final.length}`);
for (const a of added) console.log(`  + transitive: ${a}`);
fs.writeFileSync("/tmp/opencode/final-delete.txt", final.join("\n"));
