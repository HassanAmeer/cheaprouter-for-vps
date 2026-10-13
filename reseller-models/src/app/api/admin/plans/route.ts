import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/plans — list all plans. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = getDb().prepare("SELECT * FROM plans ORDER BY token_budget ASC").all() as Array<
    Record<string, unknown>
  >;
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
  const tokenBudget = num(body?.tokenBudget);
  const rpmLimit = num(body?.rpmLimit);
  const validityDays = num(body?.validityDays);
  if (
    (tokenBudget !== null && (!Number.isFinite(tokenBudget) || tokenBudget < 0)) ||
    (rpmLimit !== null && (!Number.isFinite(rpmLimit) || rpmLimit < 0)) ||
    (validityDays !== null && (!Number.isFinite(validityDays) || validityDays < 0))
  ) {
    return NextResponse.json({ error: "Budgets must be zero or greater" }, { status: 400 });
  }
  const models = Array.isArray(body?.models) ? body.models.map(String) : null;

  const db = getDb();
  const existing = db.prepare("SELECT id FROM plans WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE plans SET token_budget = ?, rpm_limit = ?, validity_days = ?, models = ? WHERE id = ?`
    ).run(
      tokenBudget,
      rpmLimit,
      validityDays,
      models ? JSON.stringify(models) : null,
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
      `INSERT INTO plans (name, token_budget, rpm_limit, validity_days, models)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, tokenBudget, rpmLimit, validityDays, models ? JSON.stringify(models) : null);
  const row = db.prepare("SELECT * FROM plans WHERE id = ?").get(info.lastInsertRowid) as Record<
    string,
    unknown
  >;
  return NextResponse.json({ plan: rowToPlan(row) }, { status: 201 });
}
