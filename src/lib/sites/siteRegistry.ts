/**
 * Site registry — the subdomain → site map.
 *
 * A "site" is one of the operator's frontends: a display NAME plus one or more
 * SUBDOMAINS. The subdomain list is the routing truth and lives in a plain
 * JSON file inside the project (`config/sites.json`) so it can be edited by
 * hand or by the dashboard's "+ Add site" button.
 *
 * WHY A FILE (and not the DB):
 *   The subdomain map is read on EVERY request (a request's Host tells us
 *   which site it belongs to). Reading it from SQLite would put a DB hit on
 *   the hot path. Here the file is parsed ONCE at boot into an in-memory
 *   `Map<host, siteId>` — resolution is then a single `Map.get()` with no
 *   disk and no DB access. The file is re-read only when a site is added.
 *
 * The operational side of a site (routes, exposed models, keys, limits,
 * usage) stays in the DB, keyed by `site_id`.
 *
 * Resolution order (see docs/specs/sites-sidebar-switcher.md):
 *   1. Host header  → in-memory map (free)
 *   2. API key      → api_keys.site_id
 *   3. X-CheapRoute-Site header
 *   4. default      → global scope
 */

import fs from "node:fs";
import path from "node:path";

export interface SiteDefinition {
  /** Stable id (used in URLs and as the DB key). */
  id: string;
  /** Display name the operator typed. */
  name: string;
  /** Hostnames that belong to this site. */
  subdomains: string[];
}

export interface SitesFile {
  sites: SiteDefinition[];
}

const SITES_FILE_CANDIDATES = ["config/sites.json", "sites.json"];

let cache: {
  sites: SiteDefinition[];
  byHost: Map<string, string>;
  filePath: string | null;
  /** mtime of the parsed file — used to detect hand edits (dashboard path only). */
  mtimeMs: number;
} | null = null;

function resolveSitesFilePath(): string | null {
  const override = process.env.CHEAPROUTE_SITES_FILE;
  const candidates = override
    ? [override]
    : SITES_FILE_CANDIDATES.map((rel) => path.join(process.cwd(), rel));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function normalizeHost(host: string): string {
  let value = host.trim().toLowerCase();
  if (value.startsWith("[")) {
    // IPv6 literal
    const end = value.indexOf("]");
    if (end !== -1) value = value.slice(1, end);
  } else {
    value = value.split(":")[0] ?? value;
  }
  return value.replace(/\.$/, "");
}

function parseSitesFile(filePath: string): SiteDefinition[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as SitesFile | null;
    if (!parsed || !Array.isArray(parsed.sites)) return [];
    const out: SiteDefinition[] = [];
    for (const entry of parsed.sites) {
      if (!entry || typeof entry.id !== "string" || !entry.id.trim()) continue;
      const subdomains = Array.isArray(entry.subdomains)
        ? entry.subdomains.map((s) => normalizeHost(String(s))).filter(Boolean)
        : [];
      out.push({
        id: entry.id.trim(),
        name:
          typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : entry.id.trim(),
        subdomains,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function buildCache(): NonNullable<typeof cache> {
  const filePath = resolveSitesFilePath();
  const sites = filePath ? parseSitesFile(filePath) : [];
  const byHost = new Map<string, string>();
  for (const site of sites) {
    for (const host of site.subdomains) byHost.set(host, site.id);
  }
  let mtimeMs = 0;
  try {
    if (filePath) mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    // ignore
  }
  return { sites, byHost, filePath, mtimeMs };
}

/** The in-memory registry (parsed once per process). */
export function getSiteRegistry(): NonNullable<typeof cache> {
  if (!cache) cache = buildCache();
  return cache;
}

/** Re-read the file (after a site was added/edited). */
export function reloadSiteRegistry(): SiteDefinition[] {
  cache = buildCache();
  return cache.sites;
}

/**
 * The site list for the DASHBOARD.
 *
 * Unlike the request-path resolver (which must stay I/O free), this re-checks
 * the file's mtime so a hand-edited `config/sites.json` shows up without a
 * restart. It is called from the dashboard/API only — never per request.
 */
export function listSites(): SiteDefinition[] {
  const registry = getSiteRegistry();
  const filePath = registry.filePath ?? resolveSitesFilePath();
  if (!filePath) return registry.sites;
  try {
    const stat = fs.statSync(filePath);
    if (registry.mtimeMs !== stat.mtimeMs) {
      cache = buildCache();
      cache.mtimeMs = stat.mtimeMs;
      return cache.sites;
    }
  } catch {
    // File vanished — keep the last known state.
  }
  return registry.sites;
}

/** Resolve a site id from a Host header (no DB, no disk). */
export function resolveSiteIdByHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  return getSiteRegistry().byHost.get(normalized) ?? null;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "site"
  );
}

export interface AddSiteResult {
  ok: boolean;
  site?: SiteDefinition;
  error?: string;
}

/**
 * Append a site to the JSON file and reload the in-memory map.
 *
 * Writes atomically (temp file + rename) so a crash mid-write can never
 * leave a truncated sites file behind.
 */
export function addSite(input: { name: string; subdomains: string[] }): AddSiteResult {
  const name = (input.name || "").trim();
  const subdomains = Array.from(
    new Set((input.subdomains || []).map((s) => normalizeHost(String(s))).filter(Boolean))
  );
  if (!name) return { ok: false, error: "Site name is required" };
  if (subdomains.length === 0) return { ok: false, error: "At least one subdomain is required" };

  const registry = getSiteRegistry();
  const filePath = registry.filePath ?? resolveSitesFilePath();
  if (!filePath) {
    return { ok: false, error: "No sites file found (set CHEAPROUTE_SITES_FILE)" };
  }

  // Unique id — derived from the FIRST subdomain's first label (so the id
  // matches the hostname people type) and falling back to the name.
  const firstLabel = subdomains[0]?.split(".")[0] ?? "";
  const baseId = slugify(firstLabel || name);
  const existingIds = new Set(registry.sites.map((s) => s.id));
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) id = `${baseId}-${suffix++}`;

  const taken = new Set<string>();
  for (const site of registry.sites) for (const host of site.subdomains) taken.add(host);
  const clash = subdomains.find((host) => taken.has(host));
  if (clash) return { ok: false, error: `Subdomain "${clash}" already belongs to another site` };

  const sites = [...registry.sites, { id, name, subdomains }];

  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, `${JSON.stringify({ sites }, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, filePath);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to write sites file",
    };
  }

  reloadSiteRegistry();
  return { ok: true, site: { id, name, subdomains } };
}
