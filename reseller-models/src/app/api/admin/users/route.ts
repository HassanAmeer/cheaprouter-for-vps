import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/users — roster with plan badge + usage %. */
export async function GET() {
  try {
    requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              p.id AS plan_id, p.name AS plan_name, p.token_budget, p.rpm_limit,
              p.validity_days, p.models,
              s.cheaprouter_api_key IS NOT NULL AS has_key,
              s.expires_at
       FROM users u
       LEFT JOIN user_subscriptions s ON s.user_id = u.id
       LEFT JOIN plans p ON p.id = s.plan_id
       ORDER BY u.created_at ASC`
    )
    .all() as Array<Record<string, unknown>>;
  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      createdAt: r.created_at,
      plan: r.plan_id
        ? {
            id: r.plan_id,
            name: r.plan_name,
            tokenBudget: r.token_budget,
            rpmLimit: r.rpm_limit,
            validityDays: r.validity_days,
            models: (() => {
              try {
                const m = JSON.parse(String(r.models));
                return Array.isArray(m) ? m : null;
              } catch {
                return null;
              }
            })(),
          }
        : null,
      hasKey: r.has_key === 1,
      expiresAt: r.expires_at,
    })),
  });
}
