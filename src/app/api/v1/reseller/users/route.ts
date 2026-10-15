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

export async function GET() {
  try {
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

    const parsed = createKeyUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const data = parsed.data;
    const userId = (data.userId || data.id)?.trim();
    const userEmail = (data.userEmail || data.email)?.trim();
    const userName = (data.userName || data.name)?.trim() || userId;

    if (!userId || !userEmail) {
      return NextResponse.json(
        { success: false, error: "User ID (UID) and Email/Phone are required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const userKey = await createResellerUserKey({
      userId,
      userName,
      userEmail,
      planTier: data.plan || data.planTier || "free",
      allowedModels: data.allowedModels || [],
      tokenBudget: data.tokenBudget ?? null,
      rpmLimit: data.rpmLimit ?? null,
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

    if (action === "addByok") {
      const parsed = byokSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Invalid payload", issues: parsed.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const key = upsertUserByokKey(parsed.data);
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
