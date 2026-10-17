import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { gatewayUrl } from "@/lib/cheaproute";

export const dynamic = "force-dynamic";

/** GET /api/admin/overview — summary dashboard statistics & gateway health */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  // Metrics from local SQLite
  const totalUsersRow = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  const totalPlansRow = db.prepare("SELECT COUNT(*) AS count FROM plans").get() as { count: number };
  const activeSubsRow = db
    .prepare(
      `SELECT COUNT(*) AS count FROM user_subscriptions 
       WHERE expires_at IS NULL OR expires_at > datetime('now')`
    )
    .get() as { count: number };

  const tokensRow = db
    .prepare(
      `SELECT SUM(COALESCE(p.token_budget, 0)) AS totalTokens
       FROM user_subscriptions s
       JOIN plans p ON p.id = s.plan_id`
    )
    .get() as { totalTokens: number | null };

  // Check CheapRoute gateway connectivity
  let gatewayOnline = false;
  let gatewayLatencyMs = 0;
  let activeProvidersCount = 0;
  let activeModelsCount = 0;
  const targetUrl = `${gatewayUrl()}/api/v1/public/providers?all=true`;

  const startTime = Date.now();
  try {
    const res = await fetch(targetUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    gatewayLatencyMs = Date.now() - startTime;
    if (res.ok) {
      gatewayOnline = true;
      const data = await res.json().catch(() => ({}));
      const providers = Array.isArray(data.providers) ? data.providers : [];
      activeProvidersCount = providers.length;
      activeModelsCount = providers.reduce(
        (acc: number, p: { modelsCount?: number; models?: string[] }) =>
          acc + (p.modelsCount || (p.models ? p.models.length : 0)),
        0
      );
    }
  } catch {
    gatewayOnline = false;
    gatewayLatencyMs = Date.now() - startTime;
  }

  return NextResponse.json({
    metrics: {
      totalUsers: totalUsersRow?.count ?? 0,
      totalPlans: totalPlansRow?.count ?? 0,
      activeSubscriptions: activeSubsRow?.count ?? 0,
      totalTokensAllocated: tokensRow?.totalTokens ?? 0,
    },
    gateway: {
      url: gatewayUrl(),
      online: gatewayOnline,
      latencyMs: gatewayLatencyMs,
      activeProviders: activeProvidersCount,
      activeModels: activeModelsCount,
    },
  });
}
