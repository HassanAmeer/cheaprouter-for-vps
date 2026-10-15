const DEFAULT_CHEAPROUTE_BASE_URL = "http://localhost:20128";

type CheapRouteBaseUrlEnv = {
  CHEAPROUTE_API_BASE_URL?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
  CHEAPROUTE_BASE_URL?: string;
  BASE_URL?: string;
  NEXT_PUBLIC_BASE_URL?: string;
  PORT?: string | number;
  API_PORT?: string | number;
  DASHBOARD_PORT?: string | number;
};

function normalizeBaseUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function mapToApiOrigin(origin?: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === "router.tokendeal.cloud") {
      url.hostname = "api.tokendeal.cloud";
      return url.origin;
    }
    if (host.startsWith("router.")) {
      url.hostname = host.replace(/^router\./i, "api.");
      return url.origin;
    }
    return url.origin;
  } catch {
    return origin;
  }
}

export function resolveCheapRouteBaseUrl(env: CheapRouteBaseUrlEnv = process.env): string {
  const port = env.PORT || env.API_PORT || env.DASHBOARD_PORT;
  const fallback = port ? `http://localhost:${port}` : DEFAULT_CHEAPROUTE_BASE_URL;

  const resolved =
    normalizeBaseUrl(env.CHEAPROUTE_API_BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_API_BASE_URL) ||
    normalizeBaseUrl(env.CHEAPROUTE_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ||
    fallback;

  return mapToApiOrigin(resolved) || resolved;
}

export { DEFAULT_CHEAPROUTE_BASE_URL };
