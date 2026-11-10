/**
 * catalogPipedModels.ts — the "Pipe Models" (provider model customization) rows of
 * the `/v1/models` catalog.
 *
 * These rows are operator-defined per-model overrides (`provider_model_customizations`
 * — the dashboard's "Pipe Models" page). The catalog guarantees that every ACTIVE
 * customization of a connected provider is listed, even when the normal model
 * discovery did not produce that model id.
 *
 * That guarantee is a LISTING guarantee, not an access-control one: the rows are
 * re-added AFTER the per-API-key filter ran, so a key with a restricted
 * `allowedModels` list used to see models it may not call (dispatch answered 403,
 * the catalog advertised the model — the catalog contradicted the key).
 *
 * `ensurePipedModelRows` therefore takes an optional `authorize` callback: the
 * per-key model authorizer (the same predicate the main filter uses). When it is
 * supplied, a piped row is only re-added when that authorizer accepts it. Keys
 * without model restrictions pass no authorizer and keep the previous behaviour.
 */

/** Minimal shape of a provider-model customization row. */
export interface PipedModelCustomization {
  providerId: string;
  originalModelId: string;
  customAlias?: string | null;
  customName?: string | null;
  contextWindow?: number | null;
}

/** Minimal shape of a catalog model row. */
export interface CatalogModelRow {
  id?: unknown;
  owned_by?: unknown;
  root?: unknown;
  customAlias?: unknown;
  [key: string]: unknown;
}

/**
 * The catalog id a customization is published under: its custom alias when the
 * operator set one, otherwise `<provider>/<original model>`.
 */
export function pipedModelRowId(cust: PipedModelCustomization): string {
  return cust.customAlias || `${cust.providerId}/${cust.originalModelId}`;
}

/**
 * Whether the customization is already represented in the model list — either by
 * its custom alias or by a row carrying the same provider/model pair.
 */
export function isPipedModelRowPresent(
  models: CatalogModelRow[],
  cust: PipedModelCustomization
): boolean {
  return models.some((m) => {
    if (cust.customAlias && (m.id === cust.customAlias || m.customAlias === cust.customAlias)) {
      return true;
    }
    const pid = typeof m.owned_by === "string" ? m.owned_by : "";
    const root = typeof m.root === "string" ? m.root : "";
    const mid = typeof m.id === "string" ? m.id : "";
    const bareId = mid.includes("/") ? mid.slice(mid.indexOf("/") + 1) : mid;
    return (
      (pid === cust.providerId || !pid) &&
      (root === cust.originalModelId ||
        bareId === cust.originalModelId ||
        mid === cust.originalModelId)
    );
  });
}

/** The catalog row published for a customization. */
export function buildPipedModelRow(cust: PipedModelCustomization, timestamp: number) {
  return {
    id: pipedModelRowId(cust),
    object: "model",
    created: timestamp,
    owned_by: cust.providerId,
    permission: [],
    root: cust.originalModelId,
    parent: null,
    name: cust.customName || cust.originalModelId,
    display_name: cust.customName || cust.originalModelId,
    context_window: cust.contextWindow ?? null,
    context_length: cust.contextWindow ?? null,
  };
}

/**
 * Ensure every customization is present in `models`.
 *
 * @param authorize Optional per-key authorizer. When provided, a customization
 *   the authorizer rejects is NOT re-added — the catalog then honours the key's
 *   model allow-list / deny-list exactly like every other row.
 * @param isBlockedProvider Optional predicate for a blocked provider. A
 *   customization of a blocked provider is not re-added either — the block must
 *   not be undone by this "ensure present" pass.
 */
export async function ensurePipedModelRows(
  models: CatalogModelRow[],
  customizations: PipedModelCustomization[],
  opts: {
    timestamp: number;
    authorize?: (row: CatalogModelRow) => Promise<boolean>;
    isBlockedProvider?: (providerId: string) => boolean;
  }
): Promise<CatalogModelRow[]> {
  for (const cust of customizations) {
    if (opts.isBlockedProvider?.(cust.providerId)) continue;
    if (isPipedModelRowPresent(models, cust)) continue;
    const row = buildPipedModelRow(cust, opts.timestamp);
    if (opts.authorize && !(await opts.authorize(row))) continue;
    models.push(row);
  }
  return models;
}
