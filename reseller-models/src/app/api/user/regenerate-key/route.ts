import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { provisionApiKey } from "@/lib/cheaproute";

/** POST /api/user/regenerate-key — reissue my CheapRouter API key for the current plan. */
export async function POST() {
  let user;
  try {
    user = requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const sub = db
    .prepare(
      `SELECT p.*, s.expires_at FROM user_subscriptions s
       JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ?`
    )
    .get(user.id) as (Record<string, unknown> & { expires_at: string | null }) | undefined;
  if (!sub) return NextResponse.json({ error: "No subscription" }, { status: 404 });
  const plan = rowToPlan(sub);

  const allowedModels = plan.models ?? [];
  const modelLimits: Record<string, { maxTokens: number }> = {};
  if (allowedModels.length > 0 && plan.token_budget) {
    const share = Math.floor(plan.token_budget / allowedModels.length);
    for (const m of allowedModels) modelLimits[m] = { maxTokens: share };
  }
  try {
    const key = await provisionApiKey({
      name: `${user.email}-${plan.name}`,
      allowedModels,
      modelLimits,
      requestsPerMinute: plan.rpm_limit ?? 30,
      expiresAt: sub.expires_at,
    });
    db.prepare("UPDATE user_subscriptions SET cheaprouter_api_key = ? WHERE user_id = ?").run(
      key,
      user.id
    );
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regeneration failed" },
      { status: 502 }
    );
  }
}
