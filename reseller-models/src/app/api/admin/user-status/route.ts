import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { gatewayUrl } from "@/lib/cheaproute";

export const dynamic = "force-dynamic";

/** POST /api/admin/user-status — toggle or set active/banned status */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId = Number(body?.userId);
  const status = body?.status === "banned" ? "banned" : "active";

  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT id, email, role FROM users WHERE id = ?").get(userId) as
    | { id: number; email: string; role: string }
    | undefined;

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.email === "admin") {
    return NextResponse.json({ error: "Cannot ban default administrator" }, { status: 400 });
  }

  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);

  // Sync to CheapRoute gateway reseller roster (best-effort)
  try {
    await fetch(`${gatewayUrl()}/api/v1/reseller/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "setBanStatus",
        userId: String(userId),
        isBanned: status === "banned",
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {}

  return NextResponse.json({ success: true, userId, status });
}
