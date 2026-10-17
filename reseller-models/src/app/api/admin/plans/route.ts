import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/plans — list all plans. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = getDb()
    .prepare("SELECT * FROM plans ORDER BY price ASC, token_budget ASC")
    .all() as Array<Record<string, unknown>>;
  return NextResponse.json({ plans: rows.map(rowToPlan) });
}

/** POST /api/admin/plans — create or update a plan. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Plan name is required" }, { status: 400 });

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);
  const price = typeof body?.price === "number" ? body.price : Number(body?.price ?? 0);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const features = Array.isArray(body?.features)
    ? body.features.map(String).filter(Boolean)
    : [];
  const isPopular = body?.isPopular ? 1 : 0;
  const tokenBudget = num(body?.tokenBudget);
  const rpmLimit = num(body?.rpmLimit);
  const validityDays = num(body?.validityDays);

  if (
    (tokenBudget !== null && (!Number.isFinite(tokenBudget) || tokenBudget < 0)) ||
    (rpmLimit !== null && (!Number.isFinite(rpmLimit) || rpmLimit < 0)) ||
    (validityDays !== null && (!Number.isFinite(validityDays) || validityDays < 0)) ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return NextResponse.json(
      { error: "Price and budgets must be non-negative numbers" },
      { status: 400 }
    );
  }
  const models = Array.isArray(body?.models) ? body.models.map(String).filter(Boolean) : null;

  const db = getDb();
  const planId = body?.id ? Number(body.id) : null;
  const existing = planId
    ? (db.prepare("SELECT id FROM plans WHERE id = ?").get(planId) as { id: number } | undefined)
    : (db.prepare("SELECT id FROM plans WHERE name = ?").get(name) as { id: number } | undefined);

  if (existing) {
    db.prepare(
      `UPDATE plans SET
         name = ?,
         price = ?,
         description = ?,
         features = ?,
         token_budget = ?,
         rpm_limit = ?,
         validity_days = ?,
         models = ?,
         is_popular = ?
       WHERE id = ?`
    ).run(
      name,
      price,
      description,
      JSON.stringify(features),
      tokenBudget,
      rpmLimit,
      validityDays,
      models ? JSON.stringify(models) : null,
      isPopular,
      existing.id
    );
    const row = db.prepare("SELECT * FROM plans WHERE id = ?").get(existing.id) as Record<
      string,
      unknown
    >;
    return NextResponse.json({ plan: rowToPlan(row) });
  }

  const info = db
    .prepare(
      `INSERT INTO plans (name, price, description, features, token_budget, rpm_limit, validity_days, models, is_popular)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      price,
      description,
      JSON.stringify(features),
      tokenBudget,
      rpmLimit,
      validityDays,
      models ? JSON.stringify(models) : null,
      isPopular
    );
  const row = db.prepare("SELECT * FROM plans WHERE id = ?").get(info.lastInsertRowid) as Record<
    string,
    unknown
  >;
  return NextResponse.json({ plan: rowToPlan(row) }, { status: 201 });
}

/** DELETE /api/admin/plans — delete a plan. */
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Plan id is required" }, { status: 400 });

  const db = getDb();
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(id) as
    | { id: number; name: string }
    | undefined;
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  if (plan.name.toLowerCase() === "free") {
    return NextResponse.json({ error: "The default Free plan cannot be deleted" }, { status: 400 });
  }

  // Find Free plan id for fallback reassignment
  const freePlan = db.prepare("SELECT id FROM plans WHERE name = 'Free'").get() as
    | { id: number }
    | undefined;

  db.transaction(() => {
    if (freePlan) {
      db.prepare("UPDATE user_subscriptions SET plan_id = ? WHERE plan_id = ?").run(
        freePlan.id,
        id
      );
    }
    db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  })();

  return NextResponse.json({ success: true, deletedId: id });
}
