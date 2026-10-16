/** Minimal client for the CheapRouter gateway (programmatic reseller APIs). */

export function gatewayUrl(): string {
  return (process.env.CHEAPROUTE_URL ?? "http://localhost:20128").replace(/\/$/, "");
}

function adminHeaders(): Record<string, string> {
  const token = process.env.CHEAPROUTE_ADMIN_TOKEN ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface PublicProvider {
  id: string;
  name: string;
  icon?: string;
  iconUrl?: string;
  status?: string;
  hasConnection?: boolean;
  modelsCount?: number;
  models?: string[];
}

export interface PublicComboPricing {
  tier?: "free" | "paid";
  inputCost?: number | null;
  cacheCost?: number | null;
  outputCost?: number | null;
}

export interface PublicCombo {
  id?: string;
  name: string;
  displayName?: string;
  strategy?: string;
  models: string[];
  pricing?: PublicComboPricing;
}

export async function fetchPublicProviders(): Promise<{
  providers: PublicProvider[];
  combos: PublicCombo[];
  byokEnabled: boolean | null;
}> {
  const res = await fetch(`${gatewayUrl()}/api/v1/public/providers?all=true`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CheapRouter providers API returned ${res.status}`);
  const data = await res.json();
  // Master BYOK state is authoritative on CheapRouter; best-effort probe.
  let byokEnabled: boolean | null = null;
  try {
    const byok = await fetch(`${gatewayUrl()}/api/v1/reseller/byok`, { cache: "no-store" });
    if (byok.ok) byokEnabled = (await byok.json()).byokEnabled !== false;
  } catch {
    byokEnabled = null;
  }
  return {
    providers: data.providers ?? [],
    combos: data.combos ?? [],
    byokEnabled,
  };
}

export interface ProvisionKeyInput {
  name: string;
  allowedModels: string[];
  modelLimits: Record<string, { maxTokens: number }>;
  requestsPerMinute: number;
  expiresAt: string | null;
}

/**
 * Provision (or re-provision) a CheapRouter API key for a subscription.
 * Mirrors the POST /api/keys contract (allowedModels, modelLimits,
 * rateLimits.requestsPerMinute, expiresAt).
 */
export async function provisionApiKey(input: ProvisionKeyInput): Promise<string> {
  const res = await fetch(`${gatewayUrl()}/api/keys`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      name: input.name,
      modelAccessMode: input.allowedModels.length > 0 ? "restricted" : "all",
      allowedModels: input.allowedModels,
      modelLimits: input.modelLimits,
      rateLimits: { requestsPerMinute: input.requestsPerMinute },
      expiresAt: input.expiresAt,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `CheapRouter key provisioning failed (${res.status})`
    );
  }
  if (!data?.key) throw new Error("CheapRouter did not return an API key");
  return data.key as string;
}

export interface ResellerUsage {
  tokensUsed: number;
  tokenBudget: number | null;
  planTier: string;
}

/** Best-effort usage read from CheapRouter's reseller roster. */
export async function fetchResellerUsage(email: string): Promise<ResellerUsage | null> {
  try {
    const res = await fetch(
      `${gatewayUrl()}/api/v1/reseller/users?email=${encodeURIComponent(email)}`,
      { headers: adminHeaders(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = Array.isArray(data?.users) ? data.users[0] : data?.user;
    if (!user) return null;
    return {
      tokensUsed: Number(user.tokens_used ?? user.tokensUsed ?? 0),
      tokenBudget: user.token_budget ?? user.tokenBudget ?? null,
      planTier: String(user.plan_tier ?? user.planTier ?? "free"),
    };
  } catch {
    return null;
  }
}
