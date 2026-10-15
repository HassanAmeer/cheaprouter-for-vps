import { NextResponse } from "next/server";
import { z } from "zod";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { buildErrorBody } from "@cheaproute/open-sse/utils/error.ts";
import {
  getResellerUsers,
  getUserByokKeys,
  upsertResellerUser,
  upsertUserByokKey,
  setUserByokPaused,
  deleteUserByokKey,
  getResellerUserKeys,
  createResellerUserKey,
  deleteResellerUserKey,
  getAvailableModelsAndCombos,
} from "@/lib/db/resellerUsers";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

const createKeyUserSchema = z.object({
  id: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  name: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
  email: z.string().min(1).optional(),
  userEmail: z.string().min(1).optional(),
  planTier: z.string().default("free"),
  allowedModels: z.array(z.string()).optional().default([]),
  tokenBudget: z.number().nullable().optional(),
  rpmLimit: z.number().int().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

const byokSchema = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
  maskedKey: z.string().min(1),
});

const pauseSchema = z.object({
  userId: z.string().min(1),
  providerId: z.string().min(1),
  paused: z.boolean(),
});

export async function GET() {
  try {
    const userKeys = getResellerUserKeys();
    const available = await getAvailableModelsAndCombos();
    const legacyUsers = getResellerUsers();
    const users = legacyUsers.map((u) => ({
      ...u,
      byokKeys: getUserByokKeys(u.id),
    }));

    return NextResponse.json(
      {
        success: true,
        userKeys,
        users,
        availableModels: available,
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
      planTier: data.planTier || "free",
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
    const keyId = url.searchParams.get("id");
    if (keyId) {
      const deleted = await deleteResellerUserKey(Number(keyId));
      return NextResponse.json({ success: true, deleted }, { status: 200, headers: CORS_HEADERS });
    }

    const userId = url.searchParams.get("userId");
    const providerId = url.searchParams.get("providerId");
    if (userId && providerId) {
      const deleted = deleteUserByokKey(userId, providerId);
      return NextResponse.json(
        { success: true, deleted },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, error: "id parameter required to delete user key" },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
