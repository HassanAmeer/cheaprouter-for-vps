import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — list all users with plans, key status, and account status. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at,
              p.id AS plan_id, p.name AS plan_name, p.price, p.description, p.features,
              p.token_budget, p.rpm_limit, p.validity_days, p.models, p.is_popular,
              s.cheaprouter_api_key IS NOT NULL AS has_key,
              s.cheaprouter_api_key,
              s.tokens_used,
              s.expires_at
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       LEFT JOIN plans p ON p.id = s.plan_id
       ORDER BY u.created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      status: (r.status as string) || "active",
      createdAt: r.created_at,
      tokensUsed: Number(r.tokens_used ?? 0),
      plan: r.plan_id
        ? rowToPlan({
            id: r.plan_id,
            name: r.plan_name,
            price: r.price,
            description: r.description,
            features: r.features,
            token_budget: r.token_budget,
            rpm_limit: r.rpm_limit,
            validity_days: r.validity_days,
            models: r.models,
            is_popular: r.is_popular,
            created_at: r.created_at,
          })
        : null,
      hasKey: r.has_key === 1,
      cheaprouterApiKey: r.cheaprouter_api_key as string | null,
      expiresAt: r.expires_at,
    })),
  });
}

/** POST /api/admin/users — create or update a user. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role === "admin" ? "admin" : "user";
  const status = body?.status === "banned" ? "banned" : "active";
  const password = typeof body?.password === "string" ? body.password.trim() : "";

  if (!email) return NextResponse.json({ error: "Email or username is required" }, { status: 400 });

  const db = getDb();
  const userId = body?.id ? Number(body.id) : null;
  const existing = userId
    ? (db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown> | undefined)
    : (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined);

  if (existing) {
    if (password) {
      db.prepare(
        "UPDATE users SET email = ?, name = ?, role = ?, status = ?, password_hash = ? WHERE id = ?"
      ).run(email, name || (existing.name as string), role, status, hashPassword(password), existing.id);
    } else {
      db.prepare("UPDATE users SET email = ?, name = ?, role = ?, status = ? WHERE id = ?").run(
        email,
        name || (existing.name as string),
        role,
        status,
        existing.id
      );
    }
    const updated = db.prepare("SELECT id, email, name, role, status, created_at FROM users WHERE id = ?").get(existing.id);
    return NextResponse.json({ user: updated });
  }

  if (!password) {
    return NextResponse.json({ error: "Password is required for new users" }, { status: 400 });
  }

  const info = db
    .prepare("INSERT INTO users (email, name, password_hash, role, status) VALUES (?, ?, ?, ?, ?)")
    .run(email, name || email, hashPassword(password), role, status);

  // Assign Free plan to new user
  const free = db.prepare("SELECT id FROM plans WHERE name = 'Free'").get() as { id: number } | undefined;
  if (free) {
    db.prepare(
      "INSERT INTO user_subscriptions (user_id, plan_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))"
    ).run(info.lastInsertRowid, free.id);
  }

  const newUser = db.prepare("SELECT id, email, name, role, status, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json({ user: newUser }, { status: 201 });
}

/** DELETE /api/admin/users — delete a user. */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as { id: number; email: string } | undefined;
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.email === "admin") {
    return NextResponse.json({ error: "The default administrator account cannot be deleted" }, { status: 400 });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM user_byok_keys WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM user_subscriptions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  })();

  return NextResponse.json({ success: true, deletedId: id });
}
