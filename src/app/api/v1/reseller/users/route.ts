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
} from "@/lib/db/resellerUsers";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

const upsertUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  planTier: z.string().default("free"),
  tokenBudget: z.number().int().nullable().optional(),
  rpmLimit: z.number().int().nullable().optional(),
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
    const users = getResellerUsers();
    const result = users.map((u) => ({
      ...u,
      byokKeys: getUserByokKeys(u.id),
    }));
     return NextResponse.json({ success: true, users: result }, { headers: CORS_HEADERS });
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
    const parsed = upsertUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const user = upsertResellerUser(parsed.data);
    return NextResponse.json({ success: true, user }, { status: 201, headers: CORS_HEADERS });
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
    const userId = url.searchParams.get("userId");
    const providerId = url.searchParams.get("providerId");
    if (!userId || !providerId) {
      return NextResponse.json(
        { success: false, error: "userId and providerId query params required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const deleted = deleteUserByokKey(userId, providerId);
    return NextResponse.json(
      { success: true, deleted },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
