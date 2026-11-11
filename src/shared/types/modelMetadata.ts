/**
 * Shape of the REAL per-model metadata served by `/api/models/metadata`.
 *
 * The provider dashboard used to render name-heuristic capability chips and a
 * mostly empty context column. The facts actually live in the server (DB
 * overrides, models.dev sync, live discovery, the provider registry) — this
 * contract lets the browser render the same truth, and says where each fact
 * came from.
 *
 * `contextSource` / `capabilitySource`:
 *   - "models.dev" — measured upstream by the models.dev catalog (real)
 *   - "live"       — reported by the provider itself during discovery (real)
 *   - "registry"   — CheapRoute's curated provider registry (real, static)
 *   - "none"       — nothing knows it yet → the UI must not guess
 */
export type ResolvedMetadataSource = "models.dev" | "live" | "registry" | "none";

export interface ResolvedModelCapabilities {
  vision: boolean | null;
  reasoning: boolean | null;
  tools: boolean | null;
  audio: boolean | null;
  video: boolean | null;
  attachment: boolean | null;
  structuredOutput: boolean | null;
  modalitiesInput: string[];
  modalitiesOutput: string[];
}

export interface ResolvedModelMetadata {
  contextWindow: number | null;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  capabilities: ResolvedModelCapabilities;
  contextSource: ResolvedMetadataSource;
  capabilitySource: ResolvedMetadataSource;
  meta: {
    family: string | null;
    status: string | null;
    openWeights: boolean | null;
    knowledgeCutoff: string | null;
    releaseDate: string | null;
  };
}

export type ResolvedModelMetadataMap = Record<string, ResolvedModelMetadata>;
