import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildErrorBody } from "@cheaproute/open-sse/utils/error.ts";
import { DEFAULT_MODEL_TEST_TIMEOUT_MS, runSingleModelTest } from "@/lib/api/modelTestRunner";
import {
  getCustomization,
  getCustomizationsForProvider,
  getAllCustomizations,
  upsertCustomization,
  setModelActive,
  setAllModelsActive,
  deleteCustomization,
} from "@/lib/db/providerModelCustomizations";
import { getProviderConnections } from "@/lib/db/providers";
import { getSyncedAvailableModels } from "@/lib/db/models";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  action: z.literal("save"),
  providerId: z.string().min(1),
  originalModelId: z.string().min(1),
  customName: z.string().max(200).nullable().optional(),
  customAlias: z.string().max(200).nullable().optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isFreeOverride: z.boolean().nullable().optional(),
  pricingTier: z.enum(["free", "paid"]).optional(),
  originalInputCost: z.number().nonnegative().nullable().optional(),
  originalCacheCost: z.number().nonnegative().nullable().optional(),
  originalOutputCost: z.number().nonnegative().nullable().optional(),
  inputCost: z.number().nonnegative().optional(),
  cacheCost: z.number().nonnegative().optional(),
  outputCost: z.number().nonnegative().optional(),
});

const activeSchema = z.object({
  action: z.literal("setActive"),
  providerId: z.string().min(1),
  originalModelId: z.string().min(1),
  active: z.boolean(),
});

const setAllActiveSchema = z.object({
  action: z.literal("setAllActive"),
  providerId: z.string().min(1),
  modelIds: z.array(z.string().min(1)),
  active: z.boolean(),
});

const liveTestSchema = z.object({
  action: z.literal("liveTest"),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  prompt: z.string().min(1).max(2000).optional(),
});

const delSchema = z.object({
  action: z.literal("delete"),
  providerId: z.string().min(1),
  originalModelId: z.string().min(1),
});

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const providerId = url.searchParams.get("providerId");

    let customizations;
    if (providerId) {
      customizations = getCustomizationsForProvider(providerId);
    } else {
      customizations = getAllCustomizations();
    }

    // Attach connection info so the UI can confirm a key is wired before testing.
    const connections = await getProviderConnections();

    // Include custom provider nodes as well
    let providerNodes: Array<{ id: string; prefix?: string; name?: string }> = [];
    try {
      const { getProviderNodes } = await import("@/lib/db/providers");
      providerNodes =
        ((await getProviderNodes()) as Array<{ id: string; prefix?: string; name?: string }>) || [];
    } catch {
      // ignore
    }

    const { isProviderConnectionConnected } =
      await import("@/shared/utils/providerConnectionStatus");

    // Only active, genuinely connected connections (not paused, not disabled)
    const activeConnections = connections.filter((c) => isProviderConnectionConnected(c));
    const activeConnectedProviderSet = new Set(
      activeConnections
        .map((c) => (typeof c.provider === "string" ? c.provider : ""))
        .filter(Boolean)
    );

    // Paused custom provider nodes (isActive === false) must be strictly excluded
    const pausedNodeIds = new Set(
      providerNodes
        .filter((n: any) => n.isActive === false)
        .flatMap((n) => [n.id, n.prefix].filter(Boolean) as string[])
    );

    // Active custom provider nodes (configured with baseUrl or having an active connection)
    const activeNodeIds = providerNodes
      .filter((n: any) => n.isActive !== false)
      .filter((n: any) => {
        const hasBaseUrl = Boolean(n.baseUrl && String(n.baseUrl).trim().length > 0);
        const hasConn =
          (n.id && activeConnectedProviderSet.has(String(n.id))) ||
          (n.prefix && activeConnectedProviderSet.has(String(n.prefix)));
        return hasBaseUrl || hasConn;
      })
      .map((n: any) => (n.prefix ? String(n.prefix) : String(n.id || "")))
      .filter(Boolean);

    // Unblocked no-auth providers (displayed as Connected on the providers dashboard)
    const { getSettings } = await import("@/lib/db/settings");
    const settings = await getSettings().catch(() => ({}) as Record<string, unknown>);
    const { isProviderBlockedByIdOrAlias } = await import("@/shared/utils/noAuthProviders");
    const blockedProviders = (settings as any)?.blockedProviders;
    const { NOAUTH_PROVIDERS } = await import("@/shared/constants/providers");
    const unblockedNoAuthIds = Object.keys(NOAUTH_PROVIDERS).filter(
      (pid) => !isProviderBlockedByIdOrAlias(pid, blockedProviders) && !pausedNodeIds.has(pid)
    );

    const connectedProviderIds = Array.from(
      new Set([
        ...Array.from(activeConnectedProviderSet),
        ...activeNodeIds,
        ...unblockedNoAuthIds,
      ])
    ).filter((pid) => !pausedNodeIds.has(pid));

    const { getCustomModels } = await import("@/lib/db/models");
    const { getModelsByProviderId } = await import("@/shared/constants/models");

    const modelsByProvider: Record<string, any[]> = {};
    for (const pid of connectedProviderIds) {
      try {
        let synced = await getSyncedAvailableModels(pid);
        if (synced.length === 0) {
          const matched = providerNodes.find((n) => n.id === pid || n.prefix === pid);
          if (matched) {
            const altId = matched.id === pid ? matched.prefix : matched.id;
            if (altId) {
              synced = await getSyncedAvailableModels(altId);
            }
          }
        }
        let custom: any[] = [];
        try {
          custom = (await getCustomModels(pid)) || [];
        } catch {
          // ignore
        }
        if (custom.length === 0) {
          const matched = providerNodes.find((n) => n.id === pid || n.prefix === pid);
          if (matched) {
            const altId = matched.id === pid ? matched.prefix : matched.id;
            if (altId) {
              custom = (await getCustomModels(altId).catch(() => [])) || [];
            }
          }
        }
        const registry = getModelsByProviderId(pid) || [];

        const mergedMap = new Map<string, any>();
        for (const m of registry) {
          if (m?.id) mergedMap.set(m.id, { ...m, source: "system" });
        }
        for (const m of synced) {
          if (m?.id) mergedMap.set(m.id, { ...m, source: "imported" });
        }
        for (const m of custom) {
          if (m?.id) mergedMap.set(m.id, { ...m, source: m.source || "custom" });
        }

        if (mergedMap.size > 0) {
          modelsByProvider[pid] = Array.from(mergedMap.values());
        }
      } catch {
        // A provider with no synced snapshot just contributes an empty list.
      }
    }

    // 💡 Idea 1: Smart Initial Activation on First Connect
    // If a connected provider has NO customization rows in DB at all (never configured),
    // automatically activate its top 3 flagship models so it is ready out of the box in Combos.
    const { ensureProviderInitialActiveModels } =
      await import("@/lib/db/providerModelCustomizations");
    let refreshedNeeded = false;
    for (const pid of connectedProviderIds) {
      const models = modelsByProvider[pid] || [];
      if (models.length > 0) {
        const modelIds = models.map((m: any) => String(m.id || ""));
        const seeded = ensureProviderInitialActiveModels(pid, modelIds, 3);
        if (seeded) refreshedNeeded = true;
      }
    }

    if (refreshedNeeded) {
      customizations = providerId
        ? getCustomizationsForProvider(providerId)
        : getAllCustomizations();
    }

    // 💡 Idea 5: Identify cooling / rate-limited providers for live health dot
    const coolingProviderIds = activeConnections
      .filter((c: any) => {
        if (!c.rateLimitedUntil) return false;
        return new Date(c.rateLimitedUntil).getTime() > Date.now();
      })
      .map((c: any) => (typeof c.provider === "string" ? c.provider : ""))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      customizations,
      connections,
      modelsByProvider,
      connectedProviderIds,
      coolingProviderIds,
    });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // ── Save customization ──
    const saveResult = saveSchema.safeParse(body);
    if (saveResult.success) {
      const {
        providerId,
        originalModelId,
        customName,
        customAlias,
        contextWindow,
        isActive,
        isFreeOverride,
        pricingTier,
        originalInputCost,
        originalCacheCost,
        originalOutputCost,
        inputCost,
        cacheCost,
        outputCost,
      } = saveResult.data;
      const row = upsertCustomization({
        providerId,
        originalModelId,
        customName,
        customAlias,
        contextWindow,
        isActive,
        isFreeOverride,
        pricingTier,
        originalInputCost,
        originalCacheCost,
        originalOutputCost,
        inputCost,
        cacheCost,
        outputCost,
      });
      return NextResponse.json({ success: true, customization: row }, { status: 201 });
    }

    // ── Set active ──
    const activeResult = activeSchema.safeParse(body);
    if (activeResult.success) {
      const { providerId, originalModelId, active } = activeResult.data;
      setModelActive(providerId, originalModelId, active);
      const row = getCustomization(providerId, originalModelId);
      return NextResponse.json({ success: true, customization: row });
    }

    // ── Set all active / inactive ──
    const setAllActiveResult = setAllActiveSchema.safeParse(body);
    if (setAllActiveResult.success) {
      const { providerId, modelIds, active } = setAllActiveResult.data;
      setAllModelsActive(providerId, modelIds, active);
      const rows = getCustomizationsForProvider(providerId);
      return NextResponse.json({ success: true, customizations: rows });
    }

    // ── Live test ──
    const testResult = liveTestSchema.safeParse(body);
    if (testResult.success) {
      return await runLiveTest(testResult.data);
    }

    return NextResponse.json(
      { success: false, error: "Unknown action", issues: saveResult.error.issues },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const parsed = delSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { providerId, originalModelId } = parsed.data;
    const deleted = deleteCustomization(providerId, originalModelId);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500 }
    );
  }
}

/**
 * Run a live upstream probe against the provider/model and persist the result
 * onto the customization row (so the Test badge stays green/red + cached).
 * Reuses CheapRouter's existing single-model test runner — no forked logic.
 */
async function runLiveTest(params: {
  providerId: string;
  modelId: string;
  prompt?: string;
}): Promise<NextResponse> {
  const result = await runSingleModelTest({
    providerId: params.providerId,
    modelId: params.modelId,
    prompt: params.prompt ?? "Hello, how are you?",
    timeoutMs: DEFAULT_MODEL_TEST_TIMEOUT_MS,
    streamChat: true,
  });

  const isOk = result.status === "ok" && (result.responseText || "").trim().length > 0;

  const testStatus = isOk ? "verified" : "failed";
  const testResponse =
    result.status === "ok"
      ? (result.responseText ?? "").slice(0, 500)
      : (result.error ?? "Upstream test failed").slice(0, 500);

  // Persist the live-test result onto the customization row (best-effort).
  // Only update an existing row — probing an uncurated model must not
  // create/activate/pin it (the Active checkbox is the activation control).
  if (getCustomization(params.providerId, params.modelId)) {
    upsertCustomization({
      providerId: params.providerId,
      originalModelId: params.modelId,
      isTested: true,
      testStatus,
      testHttpStatus: result.httpStatus,
      testLatencyMs: result.latencyMs,
      testResponse,
    });
  }

  if (isOk) {
    return NextResponse.json({
      success: true,
      status: "ok",
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      responsePreview: result.responseText?.slice(0, 500),
    });
  }

  return NextResponse.json(
    {
      success: true,
      status: result.status,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      error: result.error ?? "Upstream test failed",
      rateLimited: result.rateLimited,
      retryAfter: result.retryAfter,
    },
    { status: result.httpStatus }
  );
}
