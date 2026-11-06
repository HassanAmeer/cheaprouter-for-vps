import { buildBypassHeaders, mintSession, getBypassDispatcher } from "../opencode-bypass";

export async function validateOpencodeBypassProvider({
  apiKey,
  providerSpecificData = {},
}: {
  apiKey?: string;
  providerSpecificData?: Record<string, unknown>;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const rawBase =
      typeof providerSpecificData?.baseUrl === "string" && providerSpecificData.baseUrl.trim()
        ? providerSpecificData.baseUrl.trim()
        : "https://opencode.ai/inference/v1";

    const session = mintSession();
    const bypassHeaders = buildBypassHeaders(session);
    const headers: Record<string, string> = {
      ...bypassHeaders,
    };
    delete headers["accept"];
    headers["Accept"] = "application/json";

    if (apiKey && apiKey !== "anonymous") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const base = rawBase.replace(/\/+$/, "");
    const modelsUrl = base.endsWith("/models")
      ? base
      : base.endsWith("/inference/v1") || base.endsWith("/v1") || base.endsWith("/zen/v1")
        ? `${base}/models`
        : `${base}/inference/v1/models`;

    const customProxyUrl =
      typeof providerSpecificData?.proxyUrl === "string"
        ? (providerSpecificData.proxyUrl as string)
        : undefined;
    const dispatcher = getBypassDispatcher(customProxyUrl);

    const fetchOptions: RequestInit & { dispatcher?: any } = {
      method: "GET",
      headers,
      signal: controller.signal,
    };
    if (dispatcher) {
      fetchOptions.dispatcher = dispatcher;
    }

    const res = await fetch(modelsUrl, fetchOptions);

    if (res.ok) {
      return { valid: true, error: null };
    }

    if (res.status === 400) {
      return { valid: false, error: "Bad request to OpenCode endpoint (400)" };
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API key or unauthorized (401)" };
    }

    if (res.status === 403) {
      return { valid: false, error: "Free tier forbidden or invalid credentials (403)" };
    }

    if (res.status === 429) {
      return { valid: false, error: "Rate limited or IP blocked by OpenCode (429)" };
    }

    if (res.status >= 500) {
      return { valid: false, error: `Provider unavailable (${res.status})` };
    }

    return { valid: false, error: `Validation probe failed with status ${res.status}` };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { valid: false, error: "OpenCode validation timed out after 8000ms" };
    }
    return { valid: false, error: error?.message || "Failed to reach OpenCode bypass endpoint" };
  } finally {
    clearTimeout(timeoutId);
  }
}
