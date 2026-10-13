import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { buildErrorBody } from "@cheaproute/open-sse/utils/error.ts";
import { getSettings, updateSettings } from "@/lib/db/settings";

/**
 * BYOK master toggle (spec §3 Tab 5 / §7).
 *
 * GET  → { success, byokEnabled }
 * POST → { success, byokEnabled }  (body: { byokEnabled: boolean })
 *
 * When OFF, every pass-through key (`x-upstream-key` /
 * `x-claude-key` / …) is rejected with 403 at the route gate
 * (src/lib/byok.ts::assertByokAllowed) and never injected
 * upstream (src/sse/services/auth.ts::materializeConnection).
 */

const byokUpdateSchema = z.object({
  byokEnabled: z.boolean(),
});

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const settings = await getSettings();
    return NextResponse.json({
      success: true,
      byokEnabled: settings.byokEnabled !== false,
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
    return NextResponse.json(
      buildErrorBody(400, "Invalid JSON body"),
      { status: 400 }
    );
  }

  const parsed = byokUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await updateSettings({ byokEnabled: parsed.data.byokEnabled });
    return NextResponse.json({
      success: true,
      byokEnabled: parsed.data.byokEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      buildErrorBody(500, error instanceof Error ? error.message : String(error)),
      { status: 500 }
    );
  }
}
