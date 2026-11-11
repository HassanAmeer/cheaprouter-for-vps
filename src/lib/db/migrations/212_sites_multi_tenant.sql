-- 212_sites_multi_tenant.sql
-- Multi-website (per-site) separation.
--
-- Site IDENTITY (name + subdomains) lives in `config/sites.json` — the file the
-- in-memory resolver reads on the request hot path (src/lib/sites/siteRegistry.ts).
-- This migration adds the OPERATIONAL side of a site: which providers/models it
-- exposes, which routes it may use, and site attribution on keys, call logs and
-- usage history.
--
-- Provider CONNECTIONS (credentials) stay GLOBAL — one pool shared by every
-- site. Only the exposure/allowlist is per-site.

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- JSON array of hostnames (mirrors config/sites.json; kept for DB-only reads).
  subdomains TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  -- JSON object: per-site operational settings (default route, limits, ...).
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Per-site exposed providers + model allowlist.
-- A site with NO rows inherits the global pool (everything exposed).
-- `models` is a JSON array; empty = every model of that provider.
CREATE TABLE IF NOT EXISTS site_providers (
  site_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  models TEXT NOT NULL DEFAULT '[]',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (site_id, provider)
);

-- Per-site routes (combo/route ids the site may dispatch).
CREATE TABLE IF NOT EXISTS site_routes (
  site_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (site_id, route_id)
);

-- Site attribution. NULL = global/unscoped (pre-existing rows and requests that
-- do not resolve to a site).
ALTER TABLE api_keys ADD COLUMN site_id TEXT;
ALTER TABLE call_logs ADD COLUMN site_id TEXT;
ALTER TABLE usage_history ADD COLUMN site_id TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_site_id ON api_keys(site_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_site_id ON call_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_site_id ON usage_history(site_id);
