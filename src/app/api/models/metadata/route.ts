/**
 * GET /api/models/metadata?provider=<id>[&ids=a,b,c]
 *
 * REAL per-model metadata for the dashboard: context window + capabilities,
 * resolved by the SAME server resolver the /v1/models catalog uses —
 *
 *   operator overrides → models.dev synced capabilities → live-discovered rows
 *   → provider registry → static model specs
 *
 * Why this exists: the provider page rendered NAME-HEURISTIC capability chips
 * (a model called "*-vl" was assumed to see images) and a mostly empty context
 * column, because a browser component cannot read the DB where the real facts
 * live. The router already knew the truth; the UI was guessing.
 *
 * Every fact comes back with its source, so the UI can show what is measured
 * ("models.dev", "live", "registry") and what is only inferred ("none").
 */
import { NextRequest, NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getModelsByProviderId } from "@cheaproute/open-sse/config/providerModels";
import { getActiveSyncedCatalog } from "@/lib/db/models/activeSyncedCatalog";
import { getCustomModels } from "@/lib/db/models";
import {
  createModelCapabilityResolutionSnapshot,
  getResolvedModelCapabilities,
} from "@/lib/modelCapabilities";
import { getSyncedCapabilities } from "@/lib/modelsDevSync";
import { resolveProviderId } from "@/shared/constants/providers";
import type { ResolvedModelMetadata } from "@/shared/types/modelMetadata";

export const dynamic = "force-dynamic";

/** Hard cap so one huge provider cannot blow up the response. */
const MAX_MODELS = 4000;

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
  const requestedIds = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const ids = requestedIds.length ? requestedIds : await collectModelIds(provider);
  const limited = ids.slice(0, MAX_MODELS);

  const snapshot = createModelCapabilityResolutionSnapshot();
  const modelsDev = getSyncedCapabilities(provider);
  const modelsDevAlt = modelsDev[provider] ? modelsDev : getSyncedCapabilities(resolvedProvider);

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
    const caps = getResolvedModelCapabilities({ provider, model: id }, undefined, snapshot);
    const registryModel = registryById.get(id);
    const liveRow = liveRows.get(id);
    const devRow = (modelsDevAlt?.[id] ?? null) as {
      attachment?: boolean | null;
      reasoning?: boolean | null;
      tool_call?: boolean | null;
      limit_context?: number | null;
      modalities_input?: string;
      modalities_output?: string;
    } | null;

    // ── context window: the first source that MEASURED it wins ───────────
    const devContext = typeof devRow?.limit_context === "number" ? devRow.limit_context : null;
    const liveContext = typeof liveRow?.contextWindow === "number" ? liveRow.contextWindow : null;
    const registryContext =
      typeof registryModel?.contextLength === "number" ? registryModel.contextLength : null;
    const specContext =
      typeof caps.contextWindow === "number" && caps.contextWindow > 0 ? caps.contextWindow : null;

    let contextSource: ResolvedModelMetadata["contextSource"] = "none";
    let contextWindow: number | null = null;
    if (devContext) {
      contextSource = "models.dev";
      contextWindow = devContext;
    } else if (liveContext) {
      contextSource = "live";
      contextWindow = liveContext;
    } else if (registryContext) {
      contextSource = "registry";
      contextWindow = registryContext;
    } else if (specContext) {
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
      : (caps.modalitiesInput ?? []).map((m) => String(m).toLowerCase());
    const modalitiesOutput = devModalitiesOut.length
      ? devModalitiesOut
      : (caps.modalitiesOutput ?? []).map((m) => String(m).toLowerCase());

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
      maxInputTokens: caps.maxInputTokens ?? null,
      maxOutputTokens: caps.maxOutputTokens ?? null,
      capabilities: {
        vision,
        reasoning: reasoning ?? null,
        tools,
        audio: (audio ?? modalitiesInput.includes("audio")) ? true : null,
        video: (video ?? modalitiesOutput.includes("video")) ? true : null,
        attachment: caps.attachment ?? null,
        structuredOutput: caps.structuredOutput ?? null,
        modalitiesInput,
        modalitiesOutput,
      },
      contextSource,
      capabilitySource,
      meta: {
        family: caps.family ?? null,
        status: caps.status ?? null,
        openWeights: caps.openWeights ?? null,
        knowledgeCutoff: caps.knowledgeCutoff ?? null,
        releaseDate: caps.releaseDate ?? null,
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
