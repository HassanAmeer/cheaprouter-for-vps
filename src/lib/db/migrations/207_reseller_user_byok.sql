-- Migration 207: Reseller User & BYOK Tracking (#reseller)
--
-- CheapRouter tracks the reseller multi-tenant roster (so the dashboard's
-- dedicated "Users" tab can list tenants, their plan tier and token balance)
-- plus a pause/resume flag for each user's pass-through BYOK key.
--
-- NOTE: the reseller frontend (reseller-models/) owns the *real* key material
-- and sends it per-request via `x-upstream-key` headers. CheapRouter only
-- stores a masked reference + a pause toggle, per the stateless BYOK design.

CREATE TABLE IF NOT EXISTS reseller_users (
  id           TEXT PRIMARY KEY,           -- reseller user id (mirrors reseller DB)
  email        TEXT NOT NULL,
  name         TEXT,
  plan_tier    TEXT NOT NULL DEFAULT 'free',
  token_budget INTEGER,                    -- plan token ceiling (null = unlimited)
  tokens_used  INTEGER NOT NULL DEFAULT 0,
  rpm_limit    INTEGER,                    -- per-minute request cap (null = none)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reseller_users_email ON reseller_users(email);
CREATE INDEX IF NOT EXISTS idx_reseller_users_plan ON reseller_users(plan_tier);

CREATE TABLE IF NOT EXISTS user_byok_keys (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  provider_id    TEXT NOT NULL,
  masked_key     TEXT NOT NULL,            -- e.g. "sk-ant-api...3a9f"
  is_paused      INTEGER NOT NULL DEFAULT 0,
  last_used_at   TEXT,
  requests       INTEGER NOT NULL DEFAULT 0, -- per-key request count
  tokens         INTEGER NOT NULL DEFAULT 0, -- tokens routed through this key
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES reseller_users(id)
);

CREATE INDEX IF NOT EXISTS idx_ubk_user    ON user_byok_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ubk_provider ON user_byok_keys(provider_id);
CREATE INDEX IF NOT EXISTS idx_ubk_paused   ON user_byok_keys(is_paused);
