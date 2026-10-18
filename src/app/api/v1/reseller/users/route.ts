import { NextResponse } from "next/server";
import { z } from "zod";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { buildErrorBody } from "@cheaproute/open-sse/utils/error.ts";
import { getSettings } from "@/lib/db/settings";
import {
  getResellerUsers,
  getUserByokKeys,
  upsertResellerUser,
  upsertUserByokKey,
  setUserByokPaused,
  deleteUserByokKey,
  deleteUserByokKeyById,
  getAllUserByokKeys,
  getResellerUserKeys,
  createResellerUserKey,
  deleteResellerUserKey,
  deleteResellerUser,
  getResellerUser,
  updateUserQuota,
  setUserBanStatus,
  getAvailableModelsAndCombos,
} from "@/lib/db/resellerUsers";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

const createKeyUserSchema = z.object({
  action: z.string().optional(),
  id: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  name: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
  email: z.string().min(1).optional(),
  userEmail: z.string().min(1).optional(),
  plan: z.string().optional(),
  planTier: z.string().optional(),
  allowedModels: z.array(z.string()).optional().default([]),
  tokenBudget: z.number().nullable().optional(),
  rpmLimit: z.number().int().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  providerId: z.string().min(1).optional(),
  maskedKey: z.string().min(1).optional(),
});

const byokSchema = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
  maskedKey: z.string().optional(),
  apiKey: z.string().optional(),
  key: z.string().optional(),
  userName: z.string().nullable().optional(),
  userEmail: z.string().nullable().optional(),
});

const pauseSchema = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
  paused: z.boolean(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId")?.trim();

    if (targetUserId) {
      const user = getResellerUser(targetUserId);
      if (!user) {
        return NextResponse.json(
          { success: false, error: `User with ID '${targetUserId}' not found.` },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      const userByokKeys = getUserByokKeys(targetUserId);
      const userKeys = getResellerUserKeys().filter((k) => k.userId === targetUserId);
      return NextResponse.json(
        {
          success: true,
          user: {
            ...user,
            byokKeys: userByokKeys,
            userKeys,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    const userKeys = getResellerUserKeys();
    const byokKeys = getAllUserByokKeys();
    const available = await getAvailableModelsAndCombos();
    const legacyUsers = getResellerUsers();
    const users = legacyUsers.map((u) => ({
      ...u,
      byokKeys: getUserByokKeys(u.id),
    }));

    let publishedProviders: string[] = [];
    try {
      const settings = await getSettings();
      publishedProviders = Array.isArray(settings.publishedProviders)
        ? (settings.publishedProviders as string[])
        : [];
    } catch {}

    return NextResponse.json(
      {
        success: true,
        userKeys,
        byokKeys,
        users,
        availableModels: available,
        publishedProviders,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if this is a BYOK key creation / registration request
    if (body?.action === "addByok" || (body?.providerId && (body?.maskedKey || body?.apiKey || body?.key))) {
      const parsedByok = byokSchema.safeParse(body);
      if (!parsedByok.success) {
        return NextResponse.json(
          { success: false, error: "Invalid BYOK payload", issues: parsedByok.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const raw = parsedByok.data.maskedKey || parsedByok.data.apiKey || parsedByok.data.key || "";
      const maskedKey = raw.includes("...")
        ? raw
        : raw.length > 10
        ? `${raw.slice(0, 6)}...${raw.slice(-4)}`
        : raw;

      if (!maskedKey) {
        return NextResponse.json(
          { success: false, error: "A key or maskedKey is required" },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const key = upsertUserByokKey({
        userId: parsedByok.data.userId,
        providerId: parsedByok.data.providerId,
        maskedKey,
        userName: parsedByok.data.userName,
        userEmail: parsedByok.data.userEmail,
      });
      return NextResponse.json({ success: true, key }, { status: 201, headers: CORS_HEADERS });
    }

    // Pause / Resume BYOK Provider Key via POST
    if (body?.action === "pauseByok") {
      const parsed = pauseSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Invalid payload", issues: parsed.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      setUserByokPaused(parsed.data.userId, parsed.data.providerId, parsed.data.paused);
      return NextResponse.json(
        { success: true, paused: parsed.data.paused },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Delete BYOK Provider Key via POST
    if (body?.action === "deleteByok") {
      if (body.byokId || body.id) {
        const deleted = deleteUserByokKeyById(Number(body.byokId || body.id));
        return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
      }
      const uid = (body.userId || body.uid)?.trim();
      const provId = (body.providerId || body.provider)?.trim();
      if (uid && provId) {
        const deleted = deleteUserByokKey(uid, provId);
        return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
      }
      return NextResponse.json(
        { success: false, error: "byokId or (userId and providerId) is required to delete BYOK key." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Delete / Revoke Reseller User API Key via POST
    if (body?.action === "deleteKey" || body?.action === "revokeKey") {
      const keyId = body.id || body.keyId;
      if (!keyId) {
        return NextResponse.json(
          { success: false, error: "keyId / id is required to delete user API key." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const deleted = await deleteResellerUserKey(Number(keyId));
      return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
    }

    // Delete Entire Reseller User Account via POST
    if (body?.action === "deleteUser") {
      const uid = (body.userId || body.id)?.trim();
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "userId is required to delete user account." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const deleted = await deleteResellerUser(uid);
      return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
    }

    // Update Quota / Plan (when user purchases plan or admin updates in GUI)
    if (body?.action === "updateQuota") {
      const uid = (body.userId || body.id)?.trim();
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "userId is required to update quota." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const updated = updateUserQuota({
        userId: uid,
        plan: body.plan || body.planTier,
        tokenBudget: typeof body.tokenBudget === "number" ? body.tokenBudget : undefined,
        rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : undefined,
        modelQuotas: body.modelQuotas,
        resetUsage: body.resetUsage === true,
      });
      return NextResponse.json({ success: true, user: updated }, { status: 200, headers: CORS_HEADERS });
    }

    // Toggle Ban Status
    if (body?.action === "setBanStatus") {
      const uid = (body.userId || body.id)?.trim();
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "userId is required to set ban status." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      setUserBanStatus(uid, body.isBanned === true);
      return NextResponse.json(
        { success: true, userId: uid, isBanned: body.isBanned === true },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Seed Default / Test User with 100M tokens per model & optional API key
    if (body?.action === "seedUser") {
      const uid =
        (body.userId || body.id)?.trim() ||
        `usr_pro_test_${Math.floor(1000 + Math.random() * 9000)}`;
      const name = (body.userName || body.name)?.trim() || "Pro Test User";
      const email = (body.userEmail || body.email)?.trim() || "pro.test@cheaproute.local";
      const plan = (body.plan || body.planTier)?.trim() || "Pro";
      const rpmLimit =
        typeof body.rpmLimit === "number"
          ? body.rpmLimit
          : body.rpmLimit
          ? Number(body.rpmLimit)
          : 30;

      const available = await getAvailableModelsAndCombos();
      const allPipedModelIds = [
        ...available.combos.map((c) => c.id),
        ...available.models.map((m) => m.id),
      ];

      const selectedIds: string[] =
        Array.isArray(body.selectedModelIds) && body.selectedModelIds.length > 0
          ? body.selectedModelIds
          : allPipedModelIds;

      const tokensPerModel =
        typeof body.tokensPerModel === "number" && body.tokensPerModel > 0
          ? body.tokensPerModel
          : 100_000_000;

      const modelQuotas: Record<string, number> = {};
      selectedIds.forEach((id: string) => {
        modelQuotas[id] = tokensPerModel;
      });

      const tokenBudget =
        typeof body.tokenBudget === "number" && body.tokenBudget > 0
          ? body.tokenBudget
          : selectedIds.length * tokensPerModel;

      const user = upsertResellerUser({
        id: uid,
        email,
        name,
        planTier: plan,
        tokenBudget,
        rpmLimit,
        modelQuotas,
        isBanned: false,
      });

      let apiKey: string | null = null;
      let userKey = null;
      if (body.generateApiKey !== false) {
        userKey = await createResellerUserKey({
          userId: uid,
          userName: name,
          userEmail: email,
          planTier: plan,
          allowedModels: selectedIds,
          tokenBudget,
          rpmLimit,
        });
        apiKey = userKey.apiKey;
      }

      return NextResponse.json(
        {
          success: true,
          user,
          apiKey,
          userKey,
          modelQuotas,
        },
        { status: 201, headers: CORS_HEADERS }
      );
    }

    // Register User with Plan & Quota without generating an API key
    if (body?.action === "upsertUser") {
      const uid = (body.userId || body.id)?.trim();
      const email = (body.userEmail || body.email)?.trim();
      if (!uid || !email) {
        return NextResponse.json(
          { success: false, error: "userId and email/phone are required." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const user = upsertResellerUser({
        id: uid,
        email,
        name: (body.userName || body.name)?.trim() || uid,
        planTier: body.plan || body.planTier || "free",
        tokenBudget: typeof body.tokenBudget === "number" ? body.tokenBudget : null,
        rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : null,
        modelQuotas: body.modelQuotas,
        isBanned: body.isBanned === true,
        tokensUsed: body.resetUsage === true ? 0 : undefined,
      });

      if (typeof body.isBanned === "boolean") {
        setUserBanStatus(uid, body.isBanned);
      }

      if (body.resetUsage === true) {
        try {
          const { getDbInstance } = await import("@/lib/db/core");
          getDbInstance().prepare("DELETE FROM user_model_usage WHERE user_id = ?").run(uid);
        } catch {}
      }

      return NextResponse.json({ success: true, user }, { status: 200, headers: CORS_HEADERS });
    }

    const parsed = createKeyUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const data = parsed.data;
    const userId = (data.userId || data.id)?.trim();
    let userEmail = (data.userEmail || data.email)?.trim();
    let userName = (data.userName || data.name)?.trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID (UID) is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existingUser = getResellerUser(userId);
    if (existingUser?.isBanned) {
      return NextResponse.json(
        { success: false, error: "Cannot generate API key: user account is currently banned." },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (!userEmail) {
      userEmail = existingUser?.email || "";
    }
    if (!userName) {
      userName = existingUser?.name || userId;
    }

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: "User email or phone is required to generate an API key." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const planTier = data.plan || data.planTier || existingUser?.planTier || "free";
    const tokenBudget = data.tokenBudget !== undefined ? data.tokenBudget : (existingUser?.tokenBudget ?? null);
    const rpmLimit = data.rpmLimit !== undefined ? data.rpmLimit : (existingUser?.rpmLimit ?? null);

    const userKey = await createResellerUserKey({
      userId,
      userName,
      userEmail,
      planTier,
      allowedModels: data.allowedModels || [],
      tokenBudget,
      rpmLimit,
      expiresAt: data.expiresAt ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        userKey,
        apiKey: userKey.apiKey,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "pauseByok") {
      const parsed = pauseSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Invalid payload", issues: parsed.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      setUserByokPaused(parsed.data.userId, parsed.data.providerId, parsed.data.paused);
      return NextResponse.json(
        { success: true, paused: parsed.data.paused },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === "updateQuota") {
      const uid = (body.userId || body.id)?.trim();
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "userId is required to update quota." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const updated = updateUserQuota({
        userId: uid,
        plan: body.plan || body.planTier,
        tokenBudget: typeof body.tokenBudget === "number" ? body.tokenBudget : undefined,
        rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : undefined,
        modelQuotas: body.modelQuotas,
        resetUsage: body.resetUsage === true,
      });
      return NextResponse.json({ success: true, user: updated }, { status: 200, headers: CORS_HEADERS });
    }

    if (action === "setBanStatus") {
      const uid = (body.userId || body.id)?.trim();
      if (!uid) {
        return NextResponse.json(
          { success: false, error: "userId is required to set ban status." },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      setUserBanStatus(uid, body.isBanned === true);
      return NextResponse.json(
        { success: true, userId: uid, isBanned: body.isBanned === true },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (action === "addByok") {
      const parsed = byokSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Invalid payload", issues: parsed.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const raw = parsed.data.maskedKey || parsed.data.apiKey || parsed.data.key || "";
      const maskedKey = raw.includes("...")
        ? raw
        : raw.length > 10
        ? `${raw.slice(0, 6)}...${raw.slice(-4)}`
        : raw;
      const key = upsertUserByokKey({
        userId: parsed.data.userId,
        providerId: parsed.data.providerId,
        maskedKey,
        userName: parsed.data.userName,
        userEmail: parsed.data.userEmail,
      });
      return NextResponse.json({ success: true, key }, { status: 201, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);

    // Delete BYOK key by row ID
    const byokId = url.searchParams.get("byokId");
    if (byokId) {
      const deleted = deleteUserByokKeyById(Number(byokId));
      return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
    }

    // Delete user API key by row ID
    const keyId = url.searchParams.get("id");
    if (keyId) {
      const deleted = await deleteResellerUserKey(Number(keyId));
      return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
    }

    // Delete BYOK key by userId & providerId
    const userId = url.searchParams.get("userId");
    const providerId = url.searchParams.get("providerId");
    if (userId && providerId) {
      const deleted = deleteUserByokKey(userId, providerId);
      return NextResponse.json(
        { success: true, deleted },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Delete entire user (all keys and profile) by userId
    if (userId) {
      const deleted = await deleteResellerUser(userId);
      return NextResponse.json(
        { success: true, deleted },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, error: "id, byokId or userId parameters required" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
