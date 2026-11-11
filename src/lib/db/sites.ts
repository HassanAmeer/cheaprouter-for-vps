/**
 * db/sites.ts — per-site (multi-website) operational persistence.
 *
 * Site IDENTITY (name + subdomains) lives in `config/sites.json` and is read by
 * the in-memory resolver (`src/lib/sites/siteRegistry.ts`) on the request hot
 * path. This module owns the DB side:
 *
 *   - `sites`          — one row per site (mirrors the JSON identity + settings)
 *   - `site_providers` — per-site exposed providers + model allowlist
 *   - `site_routes`    — per-site dispatchable routes
 *
 * Provider CONNECTIONS (credentials) are GLOBAL — there is deliberately no
 * `site_id` on `provider_connections`. Only the exposure/allowlist is per-site.
 *
 * All functions are defensive: a missing table (migration not applied yet) or a
 * closed DB returns the safe default instead of throwing, so the request path
 * can call them unconditionally.
 */

import { getDbInstance } from "./core";

export interface SiteProviderRow {
  siteId: string;
  provider: string;
  models: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SiteRouteRow {
  siteId: string;
  routeId: string;
  createdAt: string;
}

export interface SiteRecord {
  id: string;
  name: string;
  subdomains: string[];
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((entry) => String(entry)).filter(Boolean);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapSiteRow(row: Record<string, unknown>): SiteRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    subdomains: parseJsonArray(row.subdomains),
    isActive: row.is_active === 1 || row.is_active === true,
    settings: parseJsonObject(row.settings),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function hasTable(tableName: string): boolean {
  try {
    const db = getDbInstance();
    const row = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { 1?: number } | undefined;
    return Boolean(row);
  } catch {
    return false;
  }
}

/** True when the multi-tenant schema is present (migration 212 applied). */
export function isSiteSchemaReady(): boolean {
  return (
    hasTable("sites") && hasTable("site_providers") && hasTable("site_routes")
  );
}

/** List all site records (DB view of the registry). */
export function listSiteRecords(): SiteRecord[] {
  if (!isSiteSchemaReady()) return [];
  try {
    const db = getDbInstance();
    const rows = db.prepare("SELECT * FROM sites ORDER BY created_at ASC, id ASC").all();
    return (rows as Record<string, unknown>[]).map(mapSiteRow);
  } catch {
    return [];
  }
}

/** Get one site record, or null. */
export function getSiteRecord(siteId: string): SiteRecord | null {
  if (!siteId || !isSiteSchemaReady()) return null;
  try {
    const db = getDbInstance();
    const row = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId) as
      | Record<string, unknown>
      | undefined;
    return row ? mapSiteRow(row) : null;
  } catch {
    return null;
  }
}

/**
 * Insert or update a site record. Called when a site is created/edited so the
 * DB mirrors `config/sites.json`.
 */
export function upsertSiteRecord(input: {
  id: string;
  name: string;
  subdomains: string[];
  isActive?: boolean;
  settings?: Record<string, unknown>;
}): SiteRecord | null {
  if (!input.id || !isSiteSchemaReady()) return null;
  try {
    const db = getDbInstance();
    const now = new Date().toISOString();
    const existing = getSiteRecord(input.id);
    const settings = JSON.stringify(input.settings ?? existing?.settings ?? {});
    const subdomains = JSON.stringify(input.subdomains ?? []);
    const isActive = input.isActive === false ? 0 : 1;

    if (existing) {
      db.prepare(
        `UPDATE sites SET name = ?, subdomains = ?, is_active = ?, settings = ?, updated_at = ?
         WHERE id = ?`
      ).run(input.name || existing.name, subdomains, isActive, settings, now, input.id);
    } else {
      db.prepare(
        `INSERT INTO sites (id, name, subdomains, is_active, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(input.id, input.name, subdomains, isActive, settings, now, now);
    }
    return getSiteRecord(input.id);
  } catch {
    return null;
  }
}

/** Delete a site record and its per-site rows. */
export function deleteSiteRecord(siteId: string): boolean {
  if (!siteId || !isSiteSchemaReady()) return false;
  try {
    const db = getDbInstance();
    db.transaction(() => {
      db.prepare("DELETE FROM sites WHERE id = ?").run(siteId);
      db.prepare("DELETE FROM site_providers WHERE site_id = ?").run(siteId);
      db.prepare("DELETE FROM site_routes WHERE site_id = ?").run(siteId);
    })();
    return true;
  } catch {
    return false;
  }
}

/** Per-site exposed providers (empty = inherit the global pool). */
export function listSiteProviders(siteId: string): SiteProviderRow[] {
  if (!siteId || !isSiteSchemaReady()) return [];
  try {
    const db = getDbInstance();
    const rows = db
      .prepare("SELECT * FROM site_providers WHERE site_id = ? ORDER BY provider ASC")
      .all(siteId) as Record<string, unknown>[];
    return rows.map((row) => ({
      siteId: String(row.site_id ?? siteId),
      provider: String(row.provider ?? ""),
      models: parseJsonArray(row.models),
      isEnabled: row.is_enabled === 1 || row.is_enabled === true,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    }));
  } catch {
    return [];
  }
}

/**
 * Replace the provider allowlist for a site. An empty list means "inherit the
 * global pool" (no restriction).
 */
export function setSiteProviders(
  siteId: string,
  providers: Array<{ provider: string; models?: string[]; isEnabled?: boolean }>
): boolean {
  if (!siteId || !isSiteSchemaReady()) return false;
  try {
    const db = getDbInstance();
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare("DELETE FROM site_providers WHERE site_id = ?").run(siteId);
      const insert = db.prepare(
        `INSERT OR REPLACE INTO site_providers
           (site_id, provider, models, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const entry of providers) {
        const provider = String(entry.provider ?? "").trim();
        if (!provider) continue;
        const models = JSON.stringify(entry.models ?? []);
        const isEnabled = entry.isEnabled === false ? 0 : 1;
        insert.run(siteId, provider, models, isEnabled, now, now);
      }
    })();
    return true;
  } catch {
    return false;
  }
}

/** Per-site routes. */
export function listSiteRoutes(siteId: string): SiteRouteRow[] {
  if (!siteId || !isSiteSchemaReady()) return [];
  try {
    const db = getDbInstance();
    const rows = db
      .prepare("SELECT * FROM site_routes WHERE site_id = ? ORDER BY route_id ASC")
      .all(siteId) as Record<string, unknown>[];
    return rows.map((row) => ({
      siteId: String(row.site_id ?? siteId),
      routeId: String(row.route_id ?? ""),
      createdAt: String(row.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

/** Replace the route allowlist for a site (empty = no restriction). */
export function setSiteRoutes(siteId: string, routeIds: string[]): boolean {
  if (!siteId || !isSiteSchemaReady()) return false;
  try {
    const db = getDbInstance();
    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare("DELETE FROM site_routes WHERE site_id = ?").run(siteId);
      const insert = db.prepare(
        "INSERT OR REPLACE INTO site_routes (site_id, route_id, created_at) VALUES (?, ?, ?)"
      );
      for (const routeId of new Set(routeIds.map((id) => String(id).trim()).filter(Boolean))) {
        insert.run(siteId, routeId, now);
      }
    })();
    return true;
  } catch {
    return false;
  }
}

/** Read the per-site settings object. */
export function getSiteSettings(siteId: string): Record<string, unknown> {
  return getSiteRecord(siteId)?.settings ?? {};
}

/** Merge a patch into the per-site settings object. */
export function updateSiteSettings(
  siteId: string,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const current = getSiteSettings(siteId);
  const next = { ...current, ...patch };
  upsertSiteRecord({
    id: siteId,
    name: getSiteRecord(siteId)?.name ?? siteId,
    subdomains: getSiteRecord(siteId)?.subdomains ?? [],
    settings: next,
  });
  return next;
}

/** Camel-case a site row from a joined query (used by usage/log reads). */
export function mapSiteJoinedRow(row: Record<string, unknown>): SiteRecord | null {
  if (!row || !row.id) return null;
  return mapSiteRow(row);
}
