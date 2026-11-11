/**
 * GET /api/models/metadata?provider=<id>[&ids=a,b,c]
 *
 * REAL per-model metadata for the dashboard: context window + capabilities,
 * with the source of each fact, resolved from the SAME places the router
 * resolves them:
 *
 *   operator override → models.dev (measured) → live provider discovery
 *   → provider registry → static model specs
 *
 * Why this exists: the provider page rendered NAME-HEURISTIC capability chips
 * (a model called "*-vl" was assumed to see images) and a mostly empty context
 * column, because a browser component cannot read the DB where the real facts
 * live. The router already knew the truth; the UI was guessing.
 *
 * Performance note: the resolution reads the synced capability rows ONCE (a
 * bulk snapshot) and then answers every model from memory. Calling the full
 * per-model resolver here cost ~1s per model (it re-entered the cold DB path
 * per lookup), which made the page unusable for big providers.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getModelsByProviderId } from "@cheaproute/open-sse/config/providerModels";
import { PROVIDER_ID_TO_ALIAS } from "@cheaproute/open-sse/config/providerModels";
import { getActiveSyncedCatalog } from "@/lib/db/models/activeSyncedCatalog";
import { getCustomModels } from "@/lib/db/models";
import { createModelCapabilityResolutionSnapshot } from "@/lib/modelCapabilities";
import { resolveProviderId } from "@/shared/constants/providers";
import { MODEL_SPECS } from "@/shared/constants/modelSpecs";
import type { ResolvedModelMetadata } from "@/shared/types/modelMetadata";

export const dynamic = "force-dynamic";

/** Hard cap so one huge provider cannot blow up the response. */
const MAX_MODELS = 4000;

interface DevCapabilityRow {
  tool_call?: boolean | null;
  reasoning?: boolean | null;
  attachment?: boolean | null;
  structured_output?: boolean | null;
  modalities_input?: string;
  modalities_output?: string;
  limit_context?: number | null;
  limit_input?: number | null;
  limit_output?: number | null;
  knowledge_cutoff?: string | null;
  release_date?: string | null;
  status?: string | null;
  family?: string | null;
  open_weights?: boolean | null;
}

async function collectModelIds(provider: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const model of getModelsByProviderId(provider)) ids.add(model.id);

  try {
    const catalog = await getActiveSyncedCatalog(provider, false);
    for (const model of catalog?.models ?? []) {
      if (model?.id) ids.add(model.id);
    }
  } catch {
    // A missing live catalog must not break the registry part.
  }

  try {
    const custom = await getCustomModels(provider);
    for (const model of custom ?? []) {
      if (model?.id) ids.add(model.id);
    }
  } catch {
    // ignore
  }

  return Array.from(ids);
}

/** Parse a models.dev modalities column (JSON array of strings). */
function parseModalities(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => String(m).toLowerCase());
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider");
  if (!provider) {
    return NextResponse.json({ error: { message: "provider is required" } }, { status: 400 });
  }

  const resolvedProvider = resolveProviderId(provider) || provider;
  const providerAlias = PROVIDER_ID_TO_ALIAS[provider] || provider;
  const requestedIds = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const ids = requestedIds.length ? requestedIds : await collectModelIds(provider);
  const limited = ids.slice(0, MAX_MODELS);

  // One bulk read of every capability source; everything below is in-memory.
  const snapshot = createModelCapabilityResolutionSnapshot();
  const devRows = snapshot.synced as unknown as Record<string, Record<string, DevCapabilityRow>>;

  const liveRows = new Map<string, Record<string, unknown>>();
  try {
    const catalog = await getActiveSyncedCatalog(provider, false);
    for (const model of (catalog?.models ?? []) as unknown as Array<Record<string, unknown>>) {
      if (!model?.id) continue;
      liveRows.set(String(model.id), model);
    }
  } catch {
    // ignore
  }

  const registryById = new Map(getModelsByProviderId(provider).map((m) => [m.id, m]));

  const out: Record<string, ResolvedModelMetadata> = {};

  for (const id of limited) {
    const registryModel = registryById.get(id);
    const liveRow = liveRows.get(id);
    const devRow: DevCapabilityRow | null =
      devRows?.[provider]?.[id] ??
      devRows?.[resolvedProvider]?.[id] ??
      devRows?.[providerAlias]?.[id] ??
      null;

    // ── context window: the first source that MEASURED it wins ───────────
    const override = snapshot.contextOverrides.get(provider)?.get(id);
    const devContext =
      typeof devRow?.limit_context === "number" && devRow.limit_context > 0
        ? devRow.limit_context
        : null;
    const liveContext =
      typeof liveRow?.contextWindow === "number" ? (liveRow.contextWindow as number) : null;
    const registryContext =
      typeof registryModel?.contextLength === "number" ? registryModel.contextLength : null;
    const specContext = MODEL_SPECS[id]?.contextWindow;

    let contextSource: ResolvedModelMetadata["contextSource"] = "none";
    let contextWindow: number | null = null;
    if (typeof override === "number" && override > 0) {
      contextSource = "registry";
      contextWindow = override;
    } else if (devContext) {
      contextSource = "models.dev";
      contextWindow = devContext;
    } else if (liveContext && liveContext > 0) {
      contextSource = "live";
      contextWindow = liveContext;
    } else if (registryContext && registryContext > 0) {
      contextSource = "registry";
      contextWindow = registryContext;
    } else if (specContext && specContext > 0) {
      contextSource = "registry";
      contextWindow = specContext;
    }

    // ── capabilities: only MEASURED values are reported; the UI falls back
    //    to the name heuristic for everything else (and says so). ─────────
    const devModalitiesIn = parseModalities(devRow?.modalities_input);
    const devModalitiesOut = parseModalities(devRow?.modalities_output);
    const liveEndpoints = Array.isArray(liveRow?.supportedEndpoints)
      ? (liveRow.supportedEndpoints as unknown[]).map((e) => String(e).toLowerCase())
      : [];

    const measured = (
      devValue: boolean | null | undefined,
      registryValue: boolean | undefined,
      liveValue: boolean | undefined
    ): boolean | null => {
      if (devValue === true || devValue === false) return devValue;
      if (typeof registryValue === "boolean") return registryValue;
      if (typeof liveValue === "boolean") return liveValue;
      return null;
    };

    const vision = measured(
      devRow?.attachment ?? null,
      registryModel?.supportsVision,
      liveRow?.supportsVision as boolean | undefined
    );
    const reasoning = measured(
      devRow?.reasoning ?? null,
      registryModel?.supportsReasoning,
      liveRow?.supportsThinking as boolean | undefined
    );
    const tools = measured(
      devRow?.tool_call ?? null,
      registryModel?.toolCalling,
      liveEndpoints.includes("tools") ? true : undefined
    );

    const modalitiesInput = devModalitiesIn.length
      ? devModalitiesIn
      : ((liveRow?.supportedEndpoints as unknown[] | undefined)?.map((e) =>
          String(e).toLowerCase()
        ) ?? []);
    const modalitiesOutput = devModalitiesOut;

    const audio = measured(
      null,
      undefined,
      liveEndpoints.some((e) => e.startsWith("audio")) ? true : undefined
    );
    const video = measured(null, undefined, liveEndpoints.includes("videos") ? true : undefined);

    let capabilitySource: ResolvedModelMetadata["capabilitySource"] = "none";
    if (devRow) capabilitySource = "models.dev";
    else if (liveRow) capabilitySource = "live";
    else if (registryModel) capabilitySource = "registry";

    out[id] = {
      contextWindow,
      maxInputTokens: typeof devRow?.limit_input === "number" ? devRow.limit_input : null,
      maxOutputTokens: typeof devRow?.limit_output === "number" ? devRow.limit_output : null,
      capabilities: {
        vision,
        reasoning,
        tools,
        audio: audio ?? (modalitiesInput.includes("audio") ? true : null),
        video: video ?? (modalitiesOutput.includes("video") ? true : null),
        attachment: devRow?.attachment ?? null,
        structuredOutput: devRow?.structured_output ?? null,
        modalitiesInput,
        modalitiesOutput,
      },
      contextSource,
      capabilitySource,
      meta: {
        family: devRow?.family ?? null,
        status: devRow?.status ?? null,
        openWeights: devRow?.open_weights ?? null,
        knowledgeCutoff: devRow?.knowledge_cutoff ?? null,
        releaseDate: devRow?.release_date ?? null,
      },
    };
  }

  return NextResponse.json({
    provider,
    resolvedProvider,
    total: ids.length,
    returned: Object.keys(out).length,
    models: out,
  });
}
