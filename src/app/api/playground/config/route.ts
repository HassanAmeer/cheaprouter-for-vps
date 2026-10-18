import { NextResponse } from "next/server";
import { CORS_HEADERS, handleCorsOptions } from "@/shared/utils/cors";
import { getLatestActiveUserKey, ensureDefaultTestUserAndKey } from "@/lib/db/resellerUsers";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    let latestKey = getLatestActiveUserKey();
    if (!latestKey) {
      const seeded = await ensureDefaultTestUserAndKey();
      return NextResponse.json(
        {
          success: true,
          apiKey: seeded.apiKey,
          user: seeded.user,
        },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        apiKey: latestKey.apiKey,
        user: {
          id: latestKey.userId,
          name: latestKey.userName,
          email: latestKey.userEmail,
          rpmLimit: latestKey.rpmLimit,
          tokenBudget: latestKey.tokenBudget,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
