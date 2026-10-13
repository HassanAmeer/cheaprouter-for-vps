import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fetchResellerUsage } from "@/lib/cheaproute";

/** GET /api/user/subscription — active plan + quota progress + expiry countdown. */
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.*, s.cheaprouter_api_key IS NOT NULL AS has_key, s.expires_at
       FROM user_subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = ?`
    )
    .get(user.id) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "No subscription" }, { status: 404 });

  const plan = rowToPlan(row);
  const usage = await fetchResellerUsage(user.email);
  const tokensUsed = usage?.tokensUsed ?? 0;
  const budget = plan.token_budget;
  const usedPct = budget ? Math.min(100, Math.round((tokensUsed / budget) * 100)) : 0;
  const expiresAt = (row.expires_at as string | null) ?? null;
  const daysLeft =
    expiresAt == null
      ? null
      : Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86400_000));

  return NextResponse.json({
    plan: { ...plan, hasKey: row.has_key === 1 },
    usage: { tokensUsed, tokenBudget: budget, usedPct },
    expiresAt,
    daysLeft,
    expiryLabel:
      daysLeft == null ? "Unlimited" : daysLeft === 0 ? "Expires today" : `Expires in ${daysLeft} days`,
  });
}
