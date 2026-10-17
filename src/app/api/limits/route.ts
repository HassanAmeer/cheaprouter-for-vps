import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  listModelLimits,
  upsertModelLimit,
  toggleModelLimitActive,
  addTokensToPool,
  deleteModelLimit,
} from "@/lib/db/modelLimits";

export const dynamic = "force-dynamic";

const limitSchema = z.object({
  id: z.string().optional(),
  targetType: z.enum(["model", "combo"]),
  targetId: z.string().min(1),
  targetName: z.string().optional(),
  providerId: z.string().nullable().optional(),
  capability: z.string().optional(),
  totalTokenPool: z.number().positive(),
  rpmLimit: z.number().int().positive().nullable().optional(),
  tpmLimit: z.number().int().positive().nullable().optional(),
  resetWindow: z.enum(["lifetime", "monthly", "weekly", "daily"]).optional(),
  onExhaustion: z.enum(["error", "fallback"]).optional(),
  fallbackTarget: z.string().nullable().optional(),
  customErrorMessage: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const limits = listModelLimits();

    // Fetch customizations to resolve custom names and aliases
    let customizations: any[] = [];
    try {
      const { getAllCustomizations } = await import("@/lib/db/providerModelCustomizations");
      customizations = getAllCustomizations();
    } catch {
      // Best-effort
    }
    const custMap = new Map<string, any>();
    for (const c of customizations) {
      if (c && c.originalModelId) {
        custMap.set(`${c.providerId}::${c.originalModelId}`, c);
        custMap.set(c.originalModelId, c);
      }
    }

    // Fetch list of available combos
    let combos: Array<{
      id: string;
      name: string;
      originalName: string;
      customName: string | null;
      customAlias: string | null;
      strategy?: string;
      modelsCount?: number;
      isActive: boolean;
      limitPolicy: any | null;
    }> = [];
    try {
      const { getCombos } = await import("@/lib/db/combos");
      const rawCombos = await getCombos();
      combos = (rawCombos || []).map((c: any) => {
        const id = String(c.id || c.name);
        const originalName = String(c.name || c.id);
        const customName = c.displayName || null;
        const customAlias = c.customAlias || null;
        const name = customName || originalName;
        const matchedLimit = limits.find(
          (l) =>
            l.targetType === "combo" &&
            (l.targetId === id || l.targetId === originalName || (customAlias && l.targetId === customAlias))
        ) || null;

        return {
          id,
          name,
          originalName,
          customName,
          customAlias,
          strategy: c.strategy || "priority",
          modelsCount: Array.isArray(c.models) ? c.models.length : 0,
          isActive: c.isActive !== false,
          limitPolicy: matchedLimit,
        };
      });
    } catch {
      // Best-effort
    }

    // Fetch list of available models
    let availableModels: Array<{
      id: string;
      name: string;
      originalName: string;
      customName: string | null;
      customAlias: string | null;
      provider?: string;
      isActive: boolean;
      contextWindow?: number | null;
      limitPolicy: any | null;
    }> = [];
    try {
      const { getAllCustomModels } = await import("@/lib/db/models");
      const customModelsMap = await getAllCustomModels();
      for (const [provider, models] of Object.entries(customModelsMap || {})) {
        if (Array.isArray(models)) {
          for (const m of models) {
            if (m && m.id) {
              const cust = custMap.get(`${provider}::${m.id}`) || custMap.get(m.id);
              const originalName = m.name || m.id;
              const customName = cust?.customName || null;
              const customAlias = cust?.customAlias || null;
              const name = customName || originalName;
              const matchedLimit = limits.find(
                (l) =>
                  l.targetType === "model" &&
                  (l.targetId === m.id ||
                    l.targetId === `${provider}/${m.id}` ||
                    (customAlias && l.targetId === customAlias))
              ) || null;

              availableModels.push({
                id: m.id,
                name,
                originalName,
                customName,
                customAlias,
                provider,
                isActive: cust ? cust.isActive === true : true,
                contextWindow: cust?.contextWindow ?? m.contextWindow ?? m.inputTokenLimit ?? null,
                limitPolicy: matchedLimit,
              });
            }
          }
        }
      }
    } catch {
      // Best-effort
    }

    // Also include common models from registry if list is empty
    if (availableModels.length === 0) {
      try {
        const { getModelsByProviderId } = await import("@/shared/constants/models");
        for (const pid of ["deepseek", "openai", "anthropic", "google", "groq"]) {
          const regModels = getModelsByProviderId(pid);
          for (const m of regModels || []) {
            if (m && m.id) {
              const cust = custMap.get(`${pid}::${m.id}`) || custMap.get(m.id);
              const originalName = m.name || m.id;
              const customName = cust?.customName || null;
              const customAlias = cust?.customAlias || null;
              const name = customName || originalName;
              const matchedLimit = limits.find(
                (l) =>
                  l.targetType === "model" &&
                  (l.targetId === m.id ||
                    l.targetId === `${pid}/${m.id}` ||
                    (customAlias && l.targetId === customAlias))
              ) || null;

              availableModels.push({
                id: m.id,
                name,
                originalName,
                customName,
                customAlias,
                provider: pid,
                isActive: cust ? cust.isActive === true : true,
                contextWindow:
                  cust?.contextWindow ??
                  (m as unknown as { context_length?: number; contextWindow?: number })
                    .context_length ??
                  (m as unknown as { context_length?: number; contextWindow?: number })
                    .contextWindow ??
                  null,
                limitPolicy: matchedLimit,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      limits,
      availableTargets: {
        combos,
        models: availableModels,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load limits" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const parsed = limitSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid limit policy payload",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const saved = upsertModelLimit(parsed.data);
    return NextResponse.json({ success: true, limit: saved });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save limit" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const rawBody = await request.json();
    const { id, action, tokens, isActive } = rawBody || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Limit policy ID is required" },
        { status: 400 }
      );
    }

    if (action === "toggleActive") {
      const updated = toggleModelLimitActive(id, Boolean(isActive));
      return NextResponse.json({ success: updated });
    }

    if (action === "resetTokens") {
      const { resetConsumedTokens } = await import("@/lib/db/modelLimits");
      const updated = resetConsumedTokens(id);
      return NextResponse.json({ success: Boolean(updated), limit: updated });
    }

    if (action === "addTokens") {
      const addedTokens = Number(tokens) || 0;
      if (addedTokens <= 0) {
        return NextResponse.json(
          { success: false, error: "Token amount must be greater than 0" },
          { status: 400 }
        );
      }
      const updated = addTokensToPool(id, addedTokens);
      return NextResponse.json({ success: Boolean(updated), limit: updated });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported PATCH action" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update limit" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing policy id in query parameter" },
        { status: 400 }
      );
    }

    const deleted = deleteModelLimit(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete limit" },
      { status: 500 }
    );
  }
}
