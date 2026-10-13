import { NextResponse } from "next/server";
import { getDb, rowToPlan } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { provisionApiKey } from "@/lib/cheaproute";

/**
 * POST /api/admin/assign-plan — set a user's plan and (re)provision their
 * CheapRouter API key: POST /api/keys with allowedModels, modelLimits,
 * rateLimits.requestsPerMinute, expiresAt.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const userId = Number(body?.userId);
  const planId = Number(body?.planId);
  if (!Number.isInteger(userId) || !Number.isInteger(planId)) {
    return NextResponse.json({ error: "userId and planId are required" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as
    | { id: number; email: string; name: string }
    | undefined;
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const planRow = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as
    | Record<string, unknown>
    | undefined;
  if (!planRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  const plan = rowToPlan(planRow);

  // Per-model budgets: split the plan token budget evenly across allowed
  // models (null models = all active models, no per-model split).
  const allowedModels = plan.models ?? [];
  const modelLimits: Record<string, { maxTokens: number }> = {};
  if (allowedModels.length > 0 && plan.token_budget) {
    const share = Math.floor(plan.token_budget / allowedModels.length);
    for (const m of allowedModels) modelLimits[m] = { maxTokens: share };
  }
  const validityDays = plan.validity_days;
  const expiresAt =
    validityDays && validityDays > 0
      ? new Date(Date.now() + validityDays * 86400_000).toISOString()
      : null;

  let cheaprouterApiKey: string | null = null;
  let provisionError: string | null = null;
  try {
    cheaprouterApiKey = await provisionApiKey({
      name: `${user.email}-${plan.name}`,
      allowedModels,
      modelLimits,
      requestsPerMinute: plan.rpm_limit ?? 30,
      expiresAt,
    });
  } catch (err) {
    provisionError = err instanceof Error ? err.message : "Key provisioning failed";
  }

  db.prepare(
    `INSERT INTO user_subscriptions (user_id, plan_id, cheaprouter_api_key, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id,
       cheaprouter_api_key = COALESCE(excluded.cheaprouter_api_key, user_subscriptions.cheaprouter_api_key),
       expires_at = excluded.expires_at`
  ).run(userId, planId, cheaprouterApiKey, expiresAt);

  const status = provisionError ? 502 : 200;
  return NextResponse.json(
    {
      ok: !provisionError,
      plan: plan.name,
      keyProvisioned: !provisionError,
      ...(provisionError ? { provisionError } : {}),
    },
    { status }
  );
}
