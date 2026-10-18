/**
 * db/providerModelCustomizations.ts — operator-curated model metadata for the
 * "Manage Models" dashboard tab (Tab 4 of the Providers page).
 *
 * Owned table: `provider_model_customizations`.
 * One row per (provider_id, original_model_id). The `custom_alias` column is the
 * API-facing alias the client sends as `model`; it resolves back to
 * `original_model_id` so routing is unchanged. `is_active` gates exposure to the
 * curated `/v1/models` surface + combo candidate pool.
 */

import { getDbInstance } from "./core";
import { backupDbFile } from "./backup";
import { setModelAlias, deleteModelAlias } from "./models/aliases";
import { setModelContextOverride, removeModelContextOverride } from "./modelContextOverrides";
import { invalidateAliasCache } from "@/lib/modelAliasResolver";
import { finishModelCatalogWriteWithoutBackup } from "./models/modelCatalogWriteSignals";

export interface ProviderModelCustomization {
  id: number;
  providerId: string;
  originalModelId: string;
  customName: string | null;
  customAlias: string | null;
  isActive: boolean;
  isTested: boolean;
  testStatus: "verified" | "failed" | null;
  testHttpStatus: number | null;
  testLatencyMs: number | null;
  testResponse: string | null;
  contextWindow: number | null;
  capabilities: string[] | null;
  /**
   * Manual FREE/PAID badge override (migration 208). NULL = auto-detect from
   * the shipped free-model catalog; true forces FREE, false forces PAID.
   */
  isFreeOverride: boolean | null;
  /**
   * Pricing & Tier Label (migration 210 & 211)
   */
  originalInputCost?: number | null;
  originalCacheCost?: number | null;
  originalOutputCost?: number | null;
  pricingTier?: "free" | "paid" | null;
  inputCost?: number | null;
  cacheCost?: number | null;
  outputCost?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Look up the customization row for a concrete provider+model.
 * Returns undefined when no customization exists (the model is uncurated).
 */
export function getCustomization(
  providerId: string,
  originalModelId: string
): ProviderModelCustomization | undefined {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT * FROM provider_model_customizations WHERE provider_id = ? AND original_model_id = ?"
    )
    .get(providerId, originalModelId) as RowShape | undefined;

  return row ? fromRow(row) : undefined;
}

/**
 * Look up the customization row by a client-supplied custom alias
 * (the value the client sends as `model`).
 */
export function getCustomizationByAlias(alias: string): ProviderModelCustomization | undefined {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT * FROM provider_model_customizations WHERE custom_alias = ? LIMIT 1")
    .get(alias) as RowShape | undefined;

  return row ? fromRow(row) : undefined;
}

/**
 * Resolve a custom alias (or bare model id) to the original model id used for
 * upstream routing. Called by the routing alias pipeline.
 */
export function resolveAliasToModelId(alias: string): string | undefined {
  const row = getCustomizationByAlias(alias);
  if (row) return row.originalModelId;
  return undefined;
}

/**
 * All active customizations — used to feed the combined alias map consumed by
 * the routing engine (`getCombinedModelAliases` in open-sse/services/model.ts).
 */
export function getActiveCustomAliasMap(): Record<string, string> {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT custom_alias, original_model_id FROM provider_model_customizations WHERE is_active = 1 AND custom_alias IS NOT NULL"
    )
    .all() as Array<{ custom_alias: string; original_model_id: string }>;

  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.custom_alias) {
      map[r.custom_alias] = r.original_model_id;
    }
  }
  return map;
}

/**
 * Every customization for a given provider (for the Manage Models tab UI).
 */
export function getCustomizationsForProvider(providerId: string): ProviderModelCustomization[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT * FROM provider_model_customizations WHERE provider_id = ? ORDER BY original_model_id ASC"
    )
    .all(providerId) as RowShape[];

  return rows.map(fromRow);
}

/**
 * All active customizations across providers (for curated public catalog and limits).
 */
export function getAllActiveCustomizations(): ProviderModelCustomization[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT * FROM provider_model_customizations WHERE is_active = 1 ORDER BY provider_id, original_model_id"
    )
    .all() as RowShape[];

  return rows.map(fromRow);
}

/**
 * All customizations across providers (for a global curation listing).
 */
export function getAllCustomizations(): ProviderModelCustomization[] {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT * FROM provider_model_customizations ORDER BY provider_id, original_model_id")
    .all() as RowShape[];

  return rows.map(fromRow);
}

/**
 * Sync a custom alias into the shared `modelAliases` key-value namespace so the
 * routing engine resolves it. The alias target uses the canonical
 * `"providerId/originalModelId"` form that `getModelInfoCore`/
 * `resolveModelAliasWithSeedFallback` already understand.
 *
 * Only active rows with a non-empty alias are written; inactive/deleted rows
 * are purged so they never shadow live routing.
 */
function syncAlias(params: {
  providerId: string;
  originalModelId: string;
  alias: string | null;
  active: boolean;
  oldAlias?: string | null;
}): void {
  if (params.oldAlias && params.oldAlias !== params.alias) {
    deleteModelAlias(params.oldAlias).catch(() => {});
  }
  if (params.alias && params.active) {
    setModelAlias(params.alias, `${params.providerId}/${params.originalModelId}`);
  } else {
    if (params.alias) {
      deleteModelAlias(params.alias).catch(() => {});
    }
  }
  invalidateAliasCache();
  finishModelCatalogWriteWithoutBackup();
}

/**
 * Upsert a customization row. Creates a row if none exists for
 * (provider_id, original_model_id); otherwise updates the editable fields.
 */
export function upsertCustomization(params: {
  providerId: string;
  originalModelId: string;
  customName?: string | null;
  customAlias?: string | null;
  isActive?: boolean;
  isTested?: boolean;
  testStatus?: "verified" | "failed" | null;
  testHttpStatus?: number | null;
  testLatencyMs?: number | null;
  testResponse?: string | null;
  contextWindow?: number | null;
  capabilities?: string[] | null;
  isFreeOverride?: boolean | null;
  pricingTier?: "free" | "paid" | null;
  originalInputCost?: number | null;
  originalCacheCost?: number | null;
  originalOutputCost?: number | null;
  inputCost?: number | null;
  cacheCost?: number | null;
  outputCost?: number | null;
}): ProviderModelCustomization {
  const db = getDbInstance();
  const now = new Date().toISOString();

  const existing = getCustomization(params.providerId, params.originalModelId);

  const isoTs = params.testStatus ?? existing?.testStatus ?? null;
  const active = params.isActive ?? existing?.isActive ?? true;
  const tested = params.isTested ?? existing?.isTested ?? false;
  const caps = params.capabilities ?? existing?.capabilities ?? null;

  const customName =
    params.customName !== undefined ? params.customName : (existing?.customName ?? null);
  const customAlias =
    params.customAlias !== undefined ? params.customAlias : (existing?.customAlias ?? null);
  const testHttpStatus = params.testHttpStatus ?? existing?.testHttpStatus ?? null;
  const testLatencyMs = params.testLatencyMs ?? existing?.testLatencyMs ?? null;
  const testResponse = params.testResponse ?? existing?.testResponse ?? null;
  const contextWindow =
    params.contextWindow !== undefined ? params.contextWindow : (existing?.contextWindow ?? null);

  const pricingTier =
    params.pricingTier !== undefined
      ? params.pricingTier
      : (existing?.pricingTier ?? (params.isFreeOverride === false ? "paid" : "free"));
  const originalInputCost =
    params.originalInputCost !== undefined ? params.originalInputCost : (existing?.originalInputCost ?? null);
  const originalCacheCost =
    params.originalCacheCost !== undefined ? params.originalCacheCost : (existing?.originalCacheCost ?? null);
  const originalOutputCost =
    params.originalOutputCost !== undefined ? params.originalOutputCost : (existing?.originalOutputCost ?? null);
  const inputCost = params.inputCost !== undefined ? params.inputCost : (existing?.inputCost ?? 0);
  const cacheCost = params.cacheCost !== undefined ? params.cacheCost : (existing?.cacheCost ?? 0);
  const outputCost = params.outputCost !== undefined ? params.outputCost : (existing?.outputCost ?? 0);

  const freeOverride =
    params.isFreeOverride !== undefined
      ? params.isFreeOverride
      : params.pricingTier
        ? params.pricingTier === "free"
        : (existing?.isFreeOverride ?? null);

  backupDbFile("pre-write");

  if (existing) {
    db.prepare(
      `UPDATE provider_model_customizations
         SET custom_name = ?, custom_alias = ?, is_active = ?, is_tested = ?, test_status = ?,
             test_http_status = ?, test_latency_ms = ?, test_response = ?,
             context_window = ?, capabilities = ?, is_free_override = ?,
             pricing_tier = ?, input_cost = ?, cache_cost = ?, output_cost = ?,
             original_input_cost = ?, original_cache_cost = ?, original_output_cost = ?, updated_at = ?
       WHERE provider_id = ? AND original_model_id = ?`
    ).run(
      customName,
      customAlias,
      active ? 1 : 0,
      tested ? 1 : 0,
      isoTs,
      testHttpStatus,
      testLatencyMs,
      testResponse,
      contextWindow,
      caps ? JSON.stringify(caps) : null,
      freeOverride === null ? null : freeOverride ? 1 : 0,
      pricingTier,
      inputCost,
      cacheCost,
      outputCost,
      originalInputCost,
      originalCacheCost,
      originalOutputCost,
      now,
      params.providerId,
      params.originalModelId
    );
  } else {
    db.prepare(
      `INSERT INTO provider_model_customizations
         (provider_id, original_model_id, custom_name, custom_alias, is_active, is_tested,
          test_status, test_http_status, test_latency_ms, test_response, context_window,
          capabilities, is_free_override, pricing_tier, input_cost, cache_cost, output_cost,
          original_input_cost, original_cache_cost, original_output_cost, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      params.providerId,
      params.originalModelId,
      customName,
      customAlias,
      active ? 1 : 0,
      tested ? 1 : 0,
      isoTs,
      testHttpStatus,
      testLatencyMs,
      testResponse,
      contextWindow,
      caps ? JSON.stringify(caps) : null,
      freeOverride === null ? null : freeOverride ? 1 : 0,
      pricingTier,
      inputCost,
      cacheCost,
      outputCost,
      originalInputCost,
      originalCacheCost,
      originalOutputCost,
      now,
      now
    );
  }

  const row = db
    .prepare(
      "SELECT * FROM provider_model_customizations WHERE provider_id = ? AND original_model_id = ?"
    )
    .get(params.providerId, params.originalModelId) as RowShape;

  // Synchronize context window override into model_context_overrides table
  if (contextWindow !== null && contextWindow > 0) {
    setModelContextOverride(params.providerId, params.originalModelId, contextWindow, "manual");
  } else if (params.contextWindow === null) {
    removeModelContextOverride(params.providerId, params.originalModelId);
  }

  // Keep the routing alias namespace in sync with the curation row.
  syncAlias({
    providerId: params.providerId,
    originalModelId: params.originalModelId,
    alias: customAlias,
    active,
    oldAlias: existing?.customAlias,
  });

  return fromRow(row);
}

/**
 * Delete a customization row.
 */
export function deleteCustomization(providerId: string, originalModelId: string): boolean {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT custom_alias FROM provider_model_customizations WHERE provider_id = ? AND original_model_id = ?"
    )
    .get(providerId, originalModelId) as { custom_alias: string | null } | undefined;

  backupDbFile("pre-write");
  const info = db
    .prepare(
      "DELETE FROM provider_model_customizations WHERE provider_id = ? AND original_model_id = ?"
    )
    .run(providerId, originalModelId);

  // Drop the alias and context override so they no longer resolve.
  if (row?.custom_alias) {
    deleteModelAlias(row.custom_alias).catch(() => {});
  }
  removeModelContextOverride(providerId, originalModelId);
  invalidateAliasCache();
  finishModelCatalogWriteWithoutBackup();
  return info.changes > 0;
}

/**
 * Toggle the active flag for a model. Active models are exposed to the curated
 * `/v1/models` surface and the combo candidate pool.
 */
export function setModelActive(providerId: string, originalModelId: string, active: boolean): void {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT custom_alias FROM provider_model_customizations WHERE provider_id = ? AND original_model_id = ?"
    )
    .get(providerId, originalModelId) as { custom_alias: string | null } | undefined;

  backupDbFile("pre-write");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO provider_model_customizations
       (provider_id, original_model_id, is_active, is_tested, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(provider_id, original_model_id)
     DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`
  ).run(providerId, originalModelId, active ? 1 : 0, now, now);

  // Activate / deactivate the alias in the routing namespace.
  if (row?.custom_alias) {
    syncAlias({
      providerId,
      originalModelId,
      alias: active ? row.custom_alias : null,
      active,
    });
  }
}

/**
 * Bulk toggle the active flag for a list of models belonging to a provider.
 */
export function setAllModelsActive(providerId: string, modelIds: string[], active: boolean): void {
  if (modelIds.length === 0) return;
  const db = getDbInstance();
  backupDbFile("pre-write");
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO provider_model_customizations
       (provider_id, original_model_id, is_active, is_tested, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(provider_id, original_model_id)
     DO UPDATE SET is_active = excluded.is_active, updated_at = excluded.updated_at`
  );

  db.transaction(() => {
    for (const modelId of modelIds) {
      stmt.run(providerId, modelId, active ? 1 : 0, now, now);
    }
  })();
}

/**
 * If a provider has never had any customization rows in the database (brand new connection),
 * automatically activate its top initial models (up to count, default 3) so it is ready
 * out-of-the-box in Combos and Manage Models.
 */
export function ensureProviderInitialActiveModels(
  providerId: string,
  modelIds: string[],
  count = 3
): boolean {
  if (!providerId || modelIds.length === 0) return false;
  const db = getDbInstance();
  const existingCount =
    (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM provider_model_customizations WHERE provider_id = ?"
        )
        .get(providerId) as { count: number } | undefined
    )?.count ?? 0;

  if (existingCount > 0) return false;

  const initialIds = modelIds.slice(0, count);
  setAllModelsActive(providerId, initialIds, true);
  return true;
}

type RowShape = {
  id: number;
  provider_id: string;
  original_model_id: string;
  custom_name: string | null;
  custom_alias: string | null;
  is_active: number;
  is_tested: number;
  test_status: string | null;
  test_http_status: number | null;
  test_latency_ms: number | null;
  test_response: string | null;
  context_window: number | null;
  capabilities: string | null;
  is_free_override: number | null;
  pricing_tier?: string | null;
  original_input_cost?: number | null;
  original_cache_cost?: number | null;
  original_output_cost?: number | null;
  input_cost?: number | null;
  cache_cost?: number | null;
  output_cost?: number | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: RowShape): ProviderModelCustomization {
  return {
    id: row.id,
    providerId: row.provider_id,
    originalModelId: row.original_model_id,
    customName: row.custom_name,
    customAlias: row.custom_alias,
    isActive: row.is_active === 1,
    isTested: row.is_tested === 1,
    testStatus: (row.test_status as "verified" | "failed" | null) ?? null,
    testHttpStatus: row.test_http_status,
    testLatencyMs: row.test_latency_ms,
    testResponse: row.test_response,
    contextWindow: row.context_window,
    capabilities: row.capabilities ? JSON.parse(row.capabilities) : null,
    isFreeOverride: row.is_free_override === 1 ? true : row.is_free_override === 0 ? false : null,
    pricingTier:
      (row.pricing_tier as "free" | "paid" | null) ??
      (row.is_free_override === 0 ? "paid" : "free"),
    originalInputCost: row.original_input_cost != null ? Number(row.original_input_cost) : null,
    originalCacheCost: row.original_cache_cost != null ? Number(row.original_cache_cost) : null,
    originalOutputCost: row.original_output_cost != null ? Number(row.original_output_cost) : null,
    inputCost: row.input_cost != null ? Number(row.input_cost) : 0,
    cacheCost: row.cache_cost != null ? Number(row.cache_cost) : 0,
    outputCost: row.output_cost != null ? Number(row.output_cost) : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
