-- Migration 206: Provider Model Customizations (#reseller)
--
-- Stores operator-curated model metadata for the "Manage Models" dashboard tab:
--   provider_model_customizations
--     - provider_id         : which provider the model belongs to
--     - original_model_id   : the upstream/routing model id
--     - custom_name         : optional display name (falls back to the model's own name)
--     - custom_alias        : optional API-call alias (e.g. glm-5.3_flash);
--                             resolved back to original_model_id at routing time
--     - is_active           : only active models are exposed to combos / /v1/models execution
--     - is_tested           : whether the operator has run the live Test button
--     - test_status         : "verified" | "failed" | null
--     - test_http_status    : last upstream HTTP status from Live Test
--     - test_latency_ms     : last upstream latency (ms)
--     - test_response       : trimmed response preview (or error message) from Live Test
--     - context_window      : cached context window token count (for badge display)
--     - capabilities        : JSON array of capability badges
--                             (e.g. ["reasoning","vision","audio","code","function_calling"])
--
-- Unique constraint on (provider_id, original_model_id) lets the operator maintain
-- exactly one customization row per model. An index on custom_alias enables O(1)
-- lookup when the API receives a custom alias as the requested `model`.

CREATE TABLE IF NOT EXISTS provider_model_customizations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id     TEXT NOT NULL,
  original_model_id TEXT NOT NULL,
  custom_name     TEXT,
  custom_alias    TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  is_tested       INTEGER NOT NULL DEFAULT 0,
  test_status     TEXT,
  test_http_status INTEGER,
  test_latency_ms INTEGER,
  test_response   TEXT,
  context_window  INTEGER,
  capabilities    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pmc_provider_model
  ON provider_model_customizations(provider_id, original_model_id);

CREATE INDEX IF NOT EXISTS idx_pmc_alias
  ON provider_model_customizations(custom_alias)
  WHERE custom_alias IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pmc_active
  ON provider_model_customizations(is_active) WHERE is_active = 1;
