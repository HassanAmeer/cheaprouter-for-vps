import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  getAntigravityPoolState,
  resumeSingleAntigravityAccount,
  setAntigravityAutoSwitchEnabled,
} from "@/sse/services/antigravityAutoSwitch";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const poolState = await getAntigravityPoolState(id);
    return NextResponse.json(poolState);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load Antigravity accounts" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      connectionId?: string;
      autoSwitchOnLimit?: boolean;
    };

    if (typeof body.autoSwitchOnLimit === "boolean") {
      await setAntigravityAutoSwitchEnabled(body.autoSwitchOnLimit);
    }

    if (typeof body.connectionId === "string" && body.connectionId.trim().length > 0) {
      await resumeSingleAntigravityAccount(body.connectionId.trim(), id);
    }

    const poolState = await getAntigravityPoolState(id);
    return NextResponse.json({ success: true, ...poolState });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update Antigravity accounts pool" },
      { status: 500 }
    );
  }
}
