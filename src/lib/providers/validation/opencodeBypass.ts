import { buildBypassHeaders, mintSession } from "../opencode-bypass";

export async function validateOpencodeBypassProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey?: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  try {
    const rawBase =
      typeof providerSpecificData?.baseUrl === "string" && providerSpecificData.baseUrl.trim()
        ? providerSpecificData.baseUrl.trim()
        : "https://opencode.ai/inference/v1";

    const session = mintSession();
    const headers: Record<string, string> = {
      ...buildBypassHeaders(session),
      Accept: "application/json",
    };

    if (apiKey && apiKey !== "anonymous") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const base = rawBase.replace(/\/+$/, "");
    const modelsUrl = base.endsWith("/models")
      ? base
      : base.endsWith("/inference/v1") || base.endsWith("/v1") || base.endsWith("/zen/v1")
        ? `${base}/models`
        : `${base}/inference/v1/models`;

    const res = await fetch(modelsUrl, {
      method: "GET",
      headers,
    });

    if (res.ok) {
      return { valid: true, error: null };
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key or unauthorized" };
    }

    // 403 FreeTierError or similar means endpoint is alive and reached
    if (res.status === 403 || res.status === 400 || res.status === 429) {
      return { valid: true, error: null };
    }

    if (res.status >= 500) {
      return { valid: false, error: `Provider unavailable (${res.status})` };
    }

    return { valid: true, error: null };
  } catch (error: any) {
    return { valid: false, error: error?.message || "Failed to reach OpenCode bypass endpoint" };
  }
}
