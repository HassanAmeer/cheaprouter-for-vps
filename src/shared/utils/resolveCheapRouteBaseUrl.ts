const DEFAULT_CHEAPROUTE_BASE_URL = "http://localhost:20128";

type CheapRouteBaseUrlEnv = {
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

export function resolveCheapRouteBaseUrl(env: CheapRouteBaseUrlEnv = process.env): string {
  const port = env.PORT || env.API_PORT || env.DASHBOARD_PORT;
  const fallback = port ? `http://localhost:${port}` : DEFAULT_CHEAPROUTE_BASE_URL;

  return (
    normalizeBaseUrl(env.CHEAPROUTE_BASE_URL) ||
    normalizeBaseUrl(env.BASE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ||
    fallback
  );
}

export { DEFAULT_CHEAPROUTE_BASE_URL };
