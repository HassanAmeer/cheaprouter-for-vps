import { NextResponse } from "next/server";
import {
  getApiKeys,
  getApiKeysCount,
  createApiKey,
  updateApiKeyPermissions,
} from "@/lib/db/apiKeys";
import { isCloudEnabled } from "@/lib/db/settings";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { syncToCloud } from "@/lib/cloudSync";
import { createKeySchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { isApiKeyRevealEnabled, maskStoredApiKey } from "@/lib/apiKeyExposure";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { normalizeSelfServiceScopesForCreate } from "@/shared/constants/selfServiceScopes";
import * as log from "@/sse/utils/logger";

function parsePagination(request: Request) {
  const url = new URL(request.url);
  const limitValue = url.searchParams.get("limit");
  const offsetValue = url.searchParams.get("offset");

  const parsedLimit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  const parsedOffset = offsetValue ? Number.parseInt(offsetValue, 10) : 0;

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit && parsedLimit > 0 ? parsedLimit : null;
  const offset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  return { limit, offset };
}

// GET /api/keys - List API keys
export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { limit, offset } = parsePagination(request);
    const dbLimit = limit ?? undefined;
    const total = getApiKeysCount();
    const keys = await getApiKeys(dbLimit, offset);

    const resellerMap = new Map<string, { userId: string; userName: string | null }>();
    try {
      const { getResellerUserKeys } = await import("@/lib/db/resellerUsers");
      const resellerKeys = getResellerUserKeys();
      for (const rk of resellerKeys) {
        if (rk.apiKeyId) {
          resellerMap.set(rk.apiKeyId, { userId: rk.userId, userName: rk.userName });
        }
        if (rk.apiKey) {
          resellerMap.set(rk.apiKey, { userId: rk.userId, userName: rk.userName });
        }
      }
    } catch {}

    const maskedKeys = keys.map((k) => {
      const keyStr = typeof k.key === "string" ? k.key : "";
      const reseller = resellerMap.get(k.id) || (keyStr ? resellerMap.get(keyStr) : undefined);
      return {
        ...k,
        key: maskStoredApiKey(keyStr),
        userId: reseller?.userId || k.name || k.id,
        userName: reseller?.userName || k.name || "User",
      };
    });

    return NextResponse.json({
      keys: maskedKeys,
      total,
      allowKeyReveal: isApiKeyRevealEnabled(),
    });
  } catch (error) {
    log.error("keys", "Error fetching keys", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Zod validation
    const validation = validateBody(createKeySchema, body);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      name,
      userId,
      userName,
      modelAccessMode,
      allowedModels,
      allowedCombos,
      noLog,
      scopes,
      allowedConnections,
      allowUsageCommand,
      usageLimitEnabled,
      dailyUsageLimitUsd,
      weeklyUsageLimitUsd,
      chaosModeEnabled,
      expiresAt,
      modelLimits,
      rateLimits,
    } = validation.data;

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const normalizedScopes = normalizeSelfServiceScopesForCreate(scopes);
    const apiKey = await createApiKey(name, machineId, normalizedScopes, {
      modelAccessMode,
      allowedModels,
      allowedCombos,
      allowedConnections,
      expiresAt,
    });
    if (
      noLog === true ||
      allowUsageCommand === true ||
      usageLimitEnabled === true ||
      dailyUsageLimitUsd !== undefined ||
      weeklyUsageLimitUsd !== undefined ||
      chaosModeEnabled === true ||
      rateLimits?.requestsPerMinute !== undefined
    ) {
      await updateApiKeyPermissions(apiKey.id, {
        ...(noLog === true && { noLog: true }),
        ...(allowUsageCommand === true && { allowUsageCommand: true }),
        ...(usageLimitEnabled === true && { usageLimitEnabled: true }),
        ...(dailyUsageLimitUsd !== undefined && { dailyUsageLimitUsd }),
        ...(weeklyUsageLimitUsd !== undefined && { weeklyUsageLimitUsd }),
        ...(chaosModeEnabled === true && { chaosModeEnabled: true }),
        ...(rateLimits?.requestsPerMinute !== undefined && {
          maxRequestsPerMinute: rateLimits.requestsPerMinute,
        }),
      });
    }

    // Reseller per-model token budgets (§8a): one `model`-scope token-limit
    // row per entry (monthly window). Enforcement is per-model — an exhausted
    // model rejects only itself, never the sibling models on this key.
    if (modelLimits && typeof modelLimits === "object") {
      const { upsertTokenLimit } = await import("@/lib/db/tokenLimits");
      for (const [modelId, limit] of Object.entries(modelLimits)) {
        const maxTokens = (limit as { maxTokens?: unknown })?.maxTokens;
        if (typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0) {
          upsertTokenLimit({
            apiKeyId: apiKey.id,
            scopeType: "model",
            scopeValue: modelId,
            tokenLimit: Math.floor(maxTokens),
            resetInterval: "monthly",
          });
        }
      }
    }

    const effectiveUserId = userId?.trim() || name;
    const effectiveUserName = userName?.trim() || name;
    try {
      const { getDbInstance } = await import("@/lib/db/core");
      const { ensureResellerUserKeysTable } = await import("@/lib/db/resellerUsers");
      ensureResellerUserKeysTable();
      const db = getDbInstance();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO reseller_user_keys (
          user_id, user_name, user_email, plan_tier, api_key, api_key_id,
          allowed_models, token_budget, tokens_used, rpm_limit, expires_at,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, ?, ?)
      `).run(
        effectiveUserId,
        effectiveUserName,
        `${effectiveUserId.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"}@cheaproute.local`,
        "standard",
        apiKey.key,
        apiKey.id,
        JSON.stringify(allowedModels || []),
        null,
        rateLimits?.requestsPerMinute ?? null,
        expiresAt ?? null,
        now,
        now
      );
    } catch (e) {
      log.warn("keys", "Failed to sync created key to reseller_user_keys", e);
    }

    // Auto sync to Cloud if enabled — fire-and-forget. Cloud sync is a
    // background side-effect, not part of the key-creation contract, and it
    // performs an outbound network call. Awaiting it here blocked the HTTP
    // response on a slow/unreachable Cloud endpoint (e.g. a fresh/offline
    // install with a misconfigured or unreachable CLOUD_URL): the request
    // would hang until the fetch settled or timed out (#6570). Errors inside
    // syncKeysToCloudIfEnabled() are already caught and logged internally, so
    // this is safe to leave unawaited.
    void syncKeysToCloudIfEnabled();

    return NextResponse.json(
      {
        key: apiKey.key,
        name: apiKey.name,
        userId: effectiveUserId,
        userName: effectiveUserName,
        id: apiKey.id,
        machineId: apiKey.machineId,
        modelAccessMode: apiKey.modelAccessMode,
        allowedModels: apiKey.allowedModels,
        allowedCombos: apiKey.allowedCombos,
        allowedConnections: apiKey.allowedConnections,
        noLog: noLog === true,
        allowUsageCommand: allowUsageCommand === true,
        usageLimitEnabled: usageLimitEnabled === true,
        dailyUsageLimitUsd: dailyUsageLimitUsd ?? null,
        weeklyUsageLimitUsd: weeklyUsageLimitUsd ?? null,
        chaosModeEnabled: chaosModeEnabled === true,
        expiresAt: expiresAt ?? null,
        streamDefaultMode: "legacy",
        compressionEnabled: true,
        cacheDefaultMode: "legacy",
      },
      { status: 201 }
    );
  } catch (error) {
    log.error("keys", "Error creating key", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}

/**
 * Sync API keys to Cloud if enabled
 */
async function syncKeysToCloudIfEnabled() {
  try {
    const cloudEnabled = await isCloudEnabled();
    if (!cloudEnabled) return;

    const machineId = await getConsistentMachineId();
    await syncToCloud(machineId);
  } catch (error) {
    log.error("keys", "Error syncing keys to cloud", error);
  }
}
