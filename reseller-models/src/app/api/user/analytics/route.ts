import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fetchResellerUsage } from "@/lib/cheaproute";
import { getDb, rowToPlan } from "@/lib/db";

/**
 * GET /api/user/analytics — RPM meter inputs + daily usage snapshot.
 * Reads CheapRouter's reseller roster best-effort; degrades to plan-only
 * data when the gateway is unreachable.
 */
export async function GET() {
  let user;
  try {
    user = requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sub = getDb()
    .prepare(
      `SELECT p.* FROM user_subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ?`
    )
    .get(user.id) as Record<string, unknown> | undefined;
  const plan = sub ? rowToPlan(sub) : null;
  const usage = await fetchResellerUsage(user.email);

  // 24h bar series: CheapRouter does not expose per-day history on this
  // endpoint, so seed the series from the current cumulative total (a single
  // non-zero final bar). Full history arrives with the log-export Ticket.
  const tokensUsed = usage?.tokensUsed ?? 0;
  const daily: Array<{ day: string; tokens: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    daily.push({
      day: d.toISOString().slice(5, 10),
      tokens: i === 0 ? tokensUsed : 0,
    });
  }

  return NextResponse.json({
    rpmLimit: plan?.rpm_limit ?? null,
    tokensUsed,
    tokenBudget: plan?.token_budget ?? null,
    daily,
    live: usage !== null,
  });
}
