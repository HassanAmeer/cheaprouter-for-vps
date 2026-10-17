import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { encryptKey, maskKey } from "@/lib/crypto";
import { gatewayUrl } from "@/lib/cheaproute";

async function authed() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/** GET /api/user/byok — list my keys (masked; never the raw secret). */
export async function GET() {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = getDb()
    .prepare(
      `SELECT id, provider_id, masked_key, is_paused, created_at
       FROM user_byok_keys WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(user.id);
  return NextResponse.json({ keys: rows });
}

/** POST /api/user/byok — add a key (stored encrypted, only masked ref exposed). */
export async function POST(request: Request) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const providerId = typeof body?.providerId === "string" ? body.providerId.trim() : "";
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!providerId || !key) {
    return NextResponse.json({ error: "providerId and key are required" }, { status: 400 });
  }
  if (key.length > 500) {
    return NextResponse.json({ error: "Key is too long" }, { status: 400 });
  }
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO user_byok_keys (user_id, provider_id, masked_key, encrypted_key)
         VALUES (?, ?, ?, ?)`
      )
      .run(user.id, providerId, maskKey(key), encryptKey(key));

    // Best-effort sync to CheapRoute gateway
    try {
      await fetch(`${gatewayUrl()}/api/v1/reseller/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addByok",
          userId: String(user.id),
          userEmail: user.email,
          userName: user.name,
          providerId,
          apiKey: key,
          maskedKey: maskKey(key),
        }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {}

    return NextResponse.json(
      { id: info.lastInsertRowid, providerId, maskedKey: maskKey(key) },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to store key" }, { status: 500 });
  }
}

/** PATCH /api/user/byok — pause / resume a key. */
export async function PATCH(request: Request) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  const paused = body?.paused === true;
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const result = getDb()
    .prepare("UPDATE user_byok_keys SET is_paused = ? WHERE id = ? AND user_id = ?")
    .run(paused ? 1 : 0, id, user.id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, paused });
}

/** DELETE /api/user/byok?id= — delete a key. */
export async function DELETE(request: Request) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const result = getDb()
    .prepare("DELETE FROM user_byok_keys WHERE id = ? AND user_id = ?")
    .run(id, user.id);
  if (result.changes === 0) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
