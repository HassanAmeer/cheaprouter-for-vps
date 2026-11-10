/**
 * Model context-window resolution (shared by the dashboard tables and the
 * provider guide sheet).
 *
 * The provider detail table used to read only `contextWindowOverride`,
 * `max_input_tokens` and `inputTokenLimit` — so every STATIC catalog model
 * showed "—" in the CONTEXT LIMIT column, even though the registry (and the
 * static model specs) know the window. The guide sheet had the opposite
 * problem: it re-implemented its own chain.
 *
 * One chain, one place:
 *   operator override → synced row limit → registry model → registry provider
 *   default → static model spec → authoritative per-provider / per-model map.
 *
 * Client-safe: no DB, no server-only imports.
 */
import { getModelsByProviderId } from "@cheaproute/open-sse/config/providerModels";
import { getRegistryEntry } from "@cheaproute/open-sse/config/providerRegistry";
import {
  MODEL_SPECS,
  getAuthoritativeContextWindow,
  getAuthoritativeProviderContextWindow,
} from "@/shared/constants/modelSpecs";
import { resolveProviderId } from "@/shared/constants/providers";

export interface ModelContextWindowInput {
  providerId: string;
  modelId: string;
  /** Registry `contextLength` for this model (already known by the caller). */
  registryContextLength?: number;
  /** Operator override stored for this provider/model. */
  override?: number;
  /** Synced catalog row limits. */
  syncedMaxInputTokens?: number;
  syncedInputTokenLimit?: number;
}

/** Registry `contextLength` for one model of a provider (undefined if unknown). */
export function getRegistryModelContextLength(
  providerId: string,
  modelId: string
): number | undefined {
  const resolvedId = resolveProviderId(providerId);
  const models =
    getModelsByProviderId(providerId).length > 0
      ? getModelsByProviderId(providerId)
      : getModelsByProviderId(resolvedId);
  const model =
    models.find((entry) => entry.id === modelId) ??
    models.find((entry) => entry.id.split("/").pop() === modelId.split("/").pop());
  return typeof model?.contextLength === "number" ? model.contextLength : undefined;
}

/** Registry-wide default context window for a provider (undefined if unknown). */
export function getRegistryProviderContextLength(providerId: string): number | undefined {
  const resolvedId = resolveProviderId(providerId);
  const entry = getRegistryEntry(providerId) ?? getRegistryEntry(resolvedId);
  return typeof entry?.defaultContextLength === "number" ? entry.defaultContextLength : undefined;
}

/** Resolve the real context window of a model, or undefined when unknown. */
export function resolveModelContextWindow(input: ModelContextWindowInput): number | undefined {
  const { providerId, modelId } = input;

  const candidates: Array<number | null | undefined> = [
    input.override,
    input.syncedMaxInputTokens,
    input.syncedInputTokenLimit,
    input.registryContextLength ?? getRegistryModelContextLength(providerId, modelId),
    getRegistryProviderContextLength(providerId),
    MODEL_SPECS[modelId]?.contextWindow,
    getAuthoritativeProviderContextWindow(providerId, modelId),
    getAuthoritativeContextWindow(modelId),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }
  return undefined;
}

/** 1048576 → "1M", 131072 → "131K", unknown → "—". */
export function formatContextWindowLabel(tokens?: number | null): string {
  if (!tokens || tokens <= 0) return "—";
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(0)}K`;
  }
  return String(tokens);
}
