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
  deleteCustomization,
} from "@/lib/db/providerModelCustomizations";
import { getProviderConnections } from "@/lib/db/providers";
import { getSyncedAvailableModels } from "@/lib/db/models";
import type { SyncedAvailableModel } from "@/lib/db/models/synced";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  action: z.literal("save"),
  providerId: z.string().min(1),
  originalModelId: z.string().min(1),
  customName: z.string().max(200).nullable().optional(),
  customAlias: z.string().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
  isFreeOverride: z.boolean().nullable().optional(),
});

const activeSchema = z.object({
  action: z.literal("setActive"),
  providerId: z.string().min(1),
  originalModelId: z.string().min(1),
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

    // Gather synced available models per connected provider so the "Manage
    // Models" UI can render the full model list (with capability badges) for
    // each provider that actually has credentials configured.
    const connectedProviderIds = Array.from(
      new Set(
        connections.map((c) => (typeof c.provider === "string" ? c.provider : "")).filter(Boolean)
      )
    );
    const modelsByProvider: Record<string, SyncedAvailableModel[]> = {};
    for (const pid of connectedProviderIds) {
      try {
        const synced = await getSyncedAvailableModels(pid);
        if (synced.length > 0) {
          modelsByProvider[pid] = synced;
        }
      } catch {
        // A provider with no synced snapshot just contributes an empty list.
      }
    }

    return NextResponse.json({
      success: true,
      customizations,
      connections,
      modelsByProvider,
      connectedProviderIds,
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
      const { providerId, originalModelId, customName, customAlias, isActive, isFreeOverride } =
        saveResult.data;
      const row = upsertCustomization({
        providerId,
        originalModelId,
        customName,
        customAlias,
        isActive,
        isFreeOverride,
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
