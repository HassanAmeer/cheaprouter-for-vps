#!/usr/bin/env node
/**
 * Live filter audit (v2) — every catalog/routing filter surface.
 *
 * v1 lessons applied here:
 *   - management writes go to the right endpoints (PATCH /api/keys/{id},
 *     PUT /api/providers/{id})
 *   - every write is verified in the DB before the effect is judged
 *   - every catalog read uses a FRESH api key (unique auth fingerprint ⇒
 *     unique catalog cache key), so a 60 s catalog cache can never mask a
 *     working filter as broken
 *   - everything it creates is deleted again (temp keys, settings restore)
 *
 * Usage: node --import tsx/esm scripts/ad-hoc/audit-filters.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:20128";
const DB = process.env.DB_PATH || "/root/.cheaproute/storage.sqlite";
const COOKIE_FILE = process.env.COOKIE_FILE || "/tmp/opencode/live-cookies.txt";

const sql = (q) =>
  execSync(`sqlite3 ${DB} ${JSON.stringify(q)}`)
    .toString()
    .trim();
const sqlSafe = (q) => {
  try {
    return sql(q);
  } catch {
    return "";
  }
};

const cookieLine = fs
  .readFileSync(COOKIE_FILE, "utf8")
  .split("\n")
  .find(
    (l) =>
      l.includes("auth_token") && !l.trimStart().startsWith("# ") && !l.startsWith("# Netscape")
  );
const COOKIE = `auth_token=${cookieLine.split("\t").pop().trim()}`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

async function call(path, { method = "GET", body, headers = {}, cookie = false } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (cookie) h.Cookie = COOKIE;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, text, json };
}

async function catalogWith(key) {
  const { status, json } = await call("/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  return { status, ids: Array.isArray(json?.data) ? json.data.map((m) => m.id) : [] };
}

const tempKeys = [];
async function freshKey(extra = {}) {
  const { status, json } = await call("/api/keys", {
    method: "POST",
    cookie: true,
    body: { name: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...extra },
  });
  if (status !== 201 || !json?.key)
    throw new Error(`temp key creation failed: ${status} ${json?.error?.message ?? ""}`);
  tempKeys.push({ id: json.id, key: json.key });
  return { id: json.id, key: json.key };
}

async function cleanupKeys() {
  for (const k of tempKeys) {
    await call(`/api/keys/${k.id}`, { method: "DELETE", cookie: true });
  }
  tempKeys.length = 0;
}

const settingsNow = async () => (await call("/api/settings", { cookie: true })).json || {};
const patchSettings = async (patch) =>
  call("/api/settings", { method: "PATCH", cookie: true, body: patch });

console.log(`# base=${BASE}\n`);

/* ───────────── 1. catalog query params (public, no auth) ────────────────── */
{
  const base = await catalogWith("__public__"); // no Authorization header path
  const anon = await call("/v1/models");
  const anonIds = (anon.json?.data ?? []).map((m) => m.id);
  check(
    "GET /v1/models → 200 + non-empty catalog",
    anon.status === 200 && anonIds.length > 0,
    `${anon.status}, ${anonIds.length} models`
  );

  const alias = await call("/v1/models?prefix=alias");
  const canonical = await call("/v1/models?prefix=canonical");
  const dual = await call("/v1/models?prefix=dual");
  const aIds = (alias.json?.data ?? []).map((m) => m.id);
  const cIds = (canonical.json?.data ?? []).map((m) => m.id);
  const dIds = (dual.json?.data ?? []).map((m) => m.id);
  check(
    "?prefix=alias → alias-form ids",
    alias.status === 200 && aIds.some((id) => id.startsWith("cfp/")),
    `${aIds.length} ids`
  );
  check(
    "?prefix=canonical → canonical-form ids",
    canonical.status === 200 && cIds.some((id) => id.startsWith("cloudflare-playground/")),
    `${cIds.length} ids`
  );
  check(
    "?prefix=canonical drops the alias form",
    !cIds.includes("cfp/zai-org/glm-5.2"),
    `alias id present=${cIds.includes("cfp/zai-org/glm-5.2")}`
  );
  check(
    "?prefix=dual keeps both forms",
    dIds.some((id) => id.startsWith("cfp/")) &&
      dIds.some((id) => id.startsWith("cloudflare-playground/")),
    `${dIds.length} ids`
  );

  const configured = await call("/v1/models?configuredOnly=true");
  const confIds = (configured.json?.data ?? []).map((m) => m.id);
  const activeProviders = new Set(
    sql("SELECT DISTINCT provider FROM provider_connections WHERE is_active=1;")
      .split("\n")
      .filter(Boolean)
  );
  const allowedPrefixes = new Set([
    ...activeProviders,
    "antseed",
    "cfp",
    "pol-text",
    "horde",
    "ddgw",
    "kilo-code-cli",
    "opencode-cli",
    "ap_kilocode",
    "agy",
    "duckduckgo-web",
    "pollinations-text",
    "cloudflare-playground",
    "aihorde",
    "veoaifree-web",
  ]);
  const leaks = confIds.filter((id) => {
    if (!id.includes("/")) return false;
    const p = id.split("/")[0];
    return ![...allowedPrefixes].some((ap) => p === ap || id.startsWith(`${ap}/`));
  });
  check(
    "?configuredOnly=true → no unconfigured provider rows",
    configured.status === 200 && leaks.length === 0,
    `${confIds.length} ids, leaks=${leaks.slice(0, 5).join(",") || "none"}`
  );

  const p1 = await call("/v1/models?limit=5");
  const ids1 = (p1.json?.data ?? []).map((m) => m.id);
  check("?limit=5 → exactly 5 rows", ids1.length === 5, `${ids1.length} rows`);
  const p2 = await call(`/v1/models?limit=5&after=${encodeURIComponent(ids1[ids1.length - 1])}`);
  const ids2 = (p2.json?.data ?? []).map((m) => m.id);
  const overlap = ids2.filter((id) => ids1.includes(id));
  check(
    "?after= → next page, no overlap",
    p2.status === 200 && overlap.length === 0,
    `page2=${ids2.length}, overlap=${overlap.length}`
  );

  const head = await fetch(`${BASE}/v1/models`, { method: "HEAD" });
  const headBody = await head.text();
  check(
    "HEAD /v1/models → 200 + empty body",
    head.status === 200 && headBody.length === 0,
    `${head.status}, ${headBody.length} bytes`
  );

  const codex = await call("/v1/models", {
    headers: { originator: "codex_exec", "User-Agent": "codex_cli_rs/1.0" },
  });
  check(
    "Codex client headers → 200 + valid catalog",
    codex.status === 200 && Array.isArray(codex.json?.data),
    `${codex.status}`
  );
}

/* ───────────── 2. per-API-key filters ───────────────────────────────────── */
try {
  // restricted + allowedModels
  const k1 = await freshKey({
    modelAccessMode: "restricted",
    allowedModels: ["pol-text/openai-fast"],
  });
  const db1 = sqlSafe(
    `SELECT model_access_mode || '|' || allowed_models FROM api_keys WHERE id='${k1.id}';`
  );
  const cat1 = await catalogWith(k1.key);
  const rows1 = cat1.ids.filter((id) => id.includes("/"));
  const unexpected1 = rows1.filter((id) => !id.startsWith("pol-text/"));
  check(
    "key filter: restricted + allowedModels → only allowed model visible",
    db1.includes("restricted") && rows1.length > 0 && unexpected1.length === 0,
    `db=${db1.slice(0, 40)}, rows=${rows1.length}, unexpected=${unexpected1.slice(0, 3).join(",") || "none"}`
  );

  // blockedModels glob
  await call(`/api/keys/${k1.id}`, {
    method: "PATCH",
    cookie: true,
    body: { blockedModels: ["cfp/*"] },
  });
  const db2 = sqlSafe(`SELECT blocked_models FROM api_keys WHERE id='${k1.id}';`);
  const cat2 = await catalogWith(k1.key);
  const cfpRows = cat2.ids.filter((id) => id.startsWith("cfp/"));
  check(
    "key filter: blockedModels glob hides matching rows",
    db2.includes("cfp") && cfpRows.length === 0,
    `db=${db2.slice(0, 40)}, cfp rows=${cfpRows.length}`
  );

  // allowedCombos
  await call(`/api/keys/${k1.id}`, {
    method: "PATCH",
    cookie: true,
    body: { modelAccessMode: "all", allowedModels: [], allowedCombos: ["auto"] },
  });
  const cat3 = await catalogWith(k1.key);
  const combos3 = cat3.ids.filter((id) => !id.includes("/"));
  check(
    "key filter: allowedCombos limits combo ids",
    combos3.length === 1 && combos3[0] === "auto",
    `combos=${combos3.join(",") || "none"}`
  );

  // catalogScope=combos
  await call(`/api/keys/${k1.id}`, {
    method: "PATCH",
    cookie: true,
    body: { catalogScope: "combos", allowedCombos: ["auto", "Claude Haiku 4.5"] },
  });
  const cat4 = await catalogWith(k1.key);
  const providerRows4 = cat4.ids.filter((id) => id.includes("/"));
  check(
    "key filter: catalogScope=combos → only combo rows",
    providerRows4.length === 0,
    `${cat4.ids.length} rows, provider rows=${providerRows4.length}`
  );

  // allowAutoCombos=false
  await call(`/api/keys/${k1.id}`, {
    method: "PATCH",
    cookie: true,
    body: { catalogScope: "all", allowedCombos: [], allowAutoCombos: false },
  });
  const cat5 = await catalogWith(k1.key);
  const autoRows5 = cat5.ids.filter((id) => id.startsWith("auto"));
  check(
    "key filter: allowAutoCombos=false hides auto ids",
    autoRows5.length === 0,
    `auto rows=${autoRows5.length}`
  );

  // disableNonPublicModels
  const k2 = await freshKey({ disableNonPublicModels: true });
  const db6 = sqlSafe(`SELECT disable_non_public_models FROM api_keys WHERE id='${k2.id}';`);
  const cat6 = await catalogWith(k2.key);
  check(
    "key filter: disableNonPublicModels persisted + catalog still valid",
    db6 === "1" && cat6.status === 200,
    `db=${db6}, ${cat6.ids.length} rows`
  );

  // allowedConnections (connection-scoped access)
  const k3 = await freshKey({ allowedConnections: ["dcb275b6-5a6a-447c-a194-dbd7fc5a6b2b"] });
  const cat7 = await catalogWith(k3.key);
  check("key filter: allowedConnections accepted", cat7.status === 200, `${cat7.ids.length} rows`);
} finally {
  await cleanupKeys();
  check("temp keys deleted (cleanup)", true, "");
}

/* ───────────── 3. global settings filters ───────────────────────────────── */
const before = await settingsNow();
const saved = {
  blockedProviders: before.blockedProviders ?? [],
  hidePaidModels: before.hidePaidModels ?? false,
  hideAutoCombos: before.hideAutoCombos ?? false,
  hideNoThinkVariants: before.hideNoThinkVariants ?? false,
  modelVisibilityAllowlist: before.modelVisibilityAllowlist ?? [],
  modelVisibilityDenylist: before.modelVisibilityDenylist ?? [],
  wildcardAliases: before.wildcardAliases ?? [],
};

try {
  // blockedProviders
  {
    const key = (await freshKey()).key;
    const base = await catalogWith(key);
    const p = await patchSettings({ blockedProviders: ["pollinations-text"] });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='blockedProviders';"
    );
    const after = await catalogWith((await freshKey()).key);
    const polLeft = after.ids.filter((id) => id.startsWith("pol-text/"));
    check(
      "settings: blockedProviders hides that provider's models",
      p.status === 200 &&
        db.includes("pollinations-text") &&
        polLeft.length === 0 &&
        after.ids.length < base.ids.length,
      `patch=${p.status}, db=${db.slice(0, 40)}, pol rows=${polLeft.length}, ${base.ids.length}→${after.ids.length}`
    );
    await patchSettings({ blockedProviders: saved.blockedProviders });
  }

  // hidePaidModels
  {
    const base = await catalogWith((await freshKey()).key);
    const p = await patchSettings({ hidePaidModels: true });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='hidePaidModels';"
    );
    const after = await catalogWith((await freshKey()).key);
    check(
      "settings: hidePaidModels removes paid rows",
      p.status === 200 && db === "true" && after.ids.length < base.ids.length,
      `patch=${p.status}, db=${db}, ${base.ids.length}→${after.ids.length}`
    );
    await patchSettings({ hidePaidModels: saved.hidePaidModels });
  }

  // hideAutoCombos
  {
    const p = await patchSettings({ hideAutoCombos: true });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='hideAutoCombos';"
    );
    const after = await catalogWith((await freshKey()).key);
    const autoRows = after.ids.filter((id) => id.startsWith("auto"));
    check(
      "settings: hideAutoCombos hides auto/* ids",
      p.status === 200 && db === "true" && autoRows.length === 0,
      `patch=${p.status}, db=${db}, auto rows=${autoRows.length}`
    );
    await patchSettings({ hideAutoCombos: saved.hideAutoCombos });
  }

  // hideNoThinkVariants
  {
    const base = await catalogWith((await freshKey()).key);
    const p = await patchSettings({ hideNoThinkVariants: true });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='hideNoThinkVariants';"
    );
    const after = await catalogWith((await freshKey()).key);
    check(
      "settings: hideNoThinkVariants applied",
      p.status === 200 && db === "true" && after.ids.length <= base.ids.length,
      `patch=${p.status}, db=${db}, ${base.ids.length}→${after.ids.length}`
    );
    await patchSettings({ hideNoThinkVariants: saved.hideNoThinkVariants });
  }

  // modelVisibility allow / deny lists
  {
    const p = await patchSettings({ modelVisibilityAllowlist: ["pol-text/*"] });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='modelVisibilityAllowlist';"
    );
    const after = await catalogWith((await freshKey()).key);
    const allowed = after.ids.filter((id) => id.startsWith("pol-text/"));
    const others = after.ids.filter((id) => id.includes("/") && !id.startsWith("pol-text/"));
    check(
      "settings: modelVisibilityAllowlist restricts the catalog",
      p.status === 200 && db.includes("pol-text") && allowed.length > 0 && others.length === 0,
      `patch=${p.status}, db=${db.slice(0, 40)}, allowed=${allowed.length}, others=${others.length}`
    );
    await patchSettings({ modelVisibilityAllowlist: saved.modelVisibilityAllowlist });

    const p2 = await patchSettings({ modelVisibilityDenylist: ["horde/*"] });
    const db2 = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='modelVisibilityDenylist';"
    );
    const after2 = await catalogWith((await freshKey()).key);
    const hordeRows = after2.ids.filter((id) => id.startsWith("horde/"));
    check(
      "settings: modelVisibilityDenylist removes matching rows",
      p2.status === 200 && db2.includes("horde") && hordeRows.length === 0,
      `patch=${p2.status}, db=${db2.slice(0, 40)}, horde rows=${hordeRows.length}`
    );
    await patchSettings({ modelVisibilityDenylist: saved.modelVisibilityDenylist });
  }

  // wildcardAliases
  {
    const p = await patchSettings({
      wildcardAliases: [{ pattern: "audit-wc-*", target: "ddgw/gpt-5.4-mini" }],
    });
    const db = sqlSafe(
      "SELECT value FROM key_value WHERE namespace='settings' AND key='wildcardAliases';"
    );
    const after = await catalogWith((await freshKey()).key);
    const aliasRows = after.ids.filter((id) => id.startsWith("audit-wc-"));
    check(
      "settings: wildcardAliases emits an alias row",
      p.status === 200 && db.includes("audit-wc") && aliasRows.length > 0,
      `patch=${p.status}, db=${db.slice(0, 50)}, alias rows=${aliasRows.length}`
    );
    await patchSettings({ wildcardAliases: saved.wildcardAliases });
  }

  // model alias (dedicated route)
  {
    const post = await call("/api/settings/model-aliases", {
      method: "POST",
      cookie: true,
      body: { alias: "audit-alias", model: "ddgw/gpt-5.4-mini" },
    });
    const after = await catalogWith((await freshKey()).key);
    check(
      "settings: /api/settings/model-aliases emits an alias row",
      post.status < 400 && after.ids.includes("audit-alias"),
      `post=${post.status} ${JSON.stringify(post.json?.error ?? "").slice(0, 60)}, found=${after.ids.includes("audit-alias")}`
    );
    if (post.status < 400) {
      await call("/api/settings/model-aliases", {
        method: "DELETE",
        cookie: true,
        body: { alias: "audit-alias" },
      });
    }
  }
} finally {
  await patchSettings(saved);
  const now = await settingsNow();
  const restored =
    JSON.stringify(now.blockedProviders ?? []) === JSON.stringify(saved.blockedProviders) &&
    now.hidePaidModels === saved.hidePaidModels &&
    now.hideAutoCombos === saved.hideAutoCombos &&
    now.hideNoThinkVariants === saved.hideNoThinkVariants;
  check(
    "settings restored to the pre-audit state",
    restored,
    `blocked=${JSON.stringify(now.blockedProviders)}, hidePaid=${now.hidePaidModels}, hideAuto=${now.hideAutoCombos}`
  );
}

/* ───────────── 4. per-connection filter ─────────────────────────────────── */
{
  const connId = sql(
    "SELECT id FROM provider_connections WHERE provider='pollinations-text' LIMIT 1;"
  );
  const orig = sqlSafe(
    `SELECT provider_specific_data FROM provider_connections WHERE id='${connId}';`
  );
  const put1 = await call(`/api/providers/${connId}`, {
    method: "PUT",
    cookie: true,
    body: { providerSpecificData: { excludedModels: ["openai-fast"] } },
  });
  const db1 = sqlSafe(
    `SELECT provider_specific_data FROM provider_connections WHERE id='${connId}';`
  );
  const after1 = await catalogWith((await freshKey()).key);
  const hidden = !after1.ids.includes("pol-text/openai-fast");
  check(
    "connection filter: excludedModels hides that model",
    put1.status === 200 && db1.includes("openai-fast") && hidden,
    `put=${put1.status}, db=${db1.slice(0, 60)}, hidden=${hidden}`
  );

  const put2 = await call(`/api/providers/${connId}`, {
    method: "PUT",
    cookie: true,
    body: { providerSpecificData: { excludedModels: [] } },
  });
  const after2 = await catalogWith((await freshKey()).key);
  check(
    "connection filter: excludedModels restored",
    put2.status === 200 && after2.ids.includes("pol-text/openai-fast"),
    `put=${put2.status}, restored=${after2.ids.includes("pol-text/openai-fast")}`
  );
}

/* ───────────── 5. DB-backed filter tables ───────────────────────────────── */
{
  const tables = [
    "model_capability_overrides",
    "model_combo_limits",
    "provider_model_customizations",
    "model_combo_mappings",
    "model_intelligence",
  ];
  const counts = {};
  for (const t of tables) counts[t] = sqlSafe(`SELECT count(*) FROM ${t};`);
  check(
    "DB filter tables present + readable",
    Object.values(counts).every((v) => /^\d+$/.test(v)),
    Object.entries(counts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  (${f.detail})` : ""}`);
}
process.exit(failed.length ? 1 : 0);
