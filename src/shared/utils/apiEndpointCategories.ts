/**
 * Endpoint category classifier for API Documentation and Reference pages.
 * Classifies endpoints into:
 * 1. "api": Core AI / Inference APIs (Chat, Models, Embeddings, Images, Audio, Moderations, Rerank, Responses, Messages, etc.)
 * 2. "reseller": Reseller & Multi-Tenant Management APIs (User accounts, Quotas, BYOK, User Keys, Key Groups, Pools, Plans)
 * 3. "router-panel": Admin Dashboard & Router Panel APIs (Providers, Combos, Limits Bank, Usage, System, Health, Settings, Tunnels, Memory, etc.)
 */

export type EndpointCategory = "api" | "reseller" | "router-panel";

export interface EndpointCategoryMeta {
  id: EndpointCategory;
  label: string;
  badge: string;
  icon: string;
  description: string;
  accentColor: string;
}

export const ENDPOINT_CATEGORIES: readonly EndpointCategoryMeta[] = [
  {
    id: "api",
    label: "API",
    badge: "Core AI",
    icon: "auto_awesome",
    description: "Public client inference & AI gateway endpoints (Chat, Models, Embeddings, Media)",
    accentColor: "blue",
  },
  {
    id: "reseller",
    label: "Reseller API",
    badge: "Multi-Tenant",
    icon: "storefront",
    description: "Reseller management, user registration, quotas, BYOK provider keys & key pools",
    accentColor: "emerald",
  },
  {
    id: "router-panel",
    label: "Router Panel",
    badge: "Admin / System",
    icon: "tune",
    description: "Admin control panel, provider nodes, combos, limits bank, telemetry & settings",
    accentColor: "violet",
  },
] as const;

export function getEndpointCategory(path: string, tags: readonly string[] = []): EndpointCategory {
  const p = (path || "").toLowerCase();
  const tagList = (tags || []).map((t) => t.toLowerCase());

  // 1. Reseller API takes precedence for any reseller, user-account, key-management, or quota paths
  if (
    p.includes("/reseller") ||
    p.startsWith("/api/users") ||
    p.startsWith("/api/v1/reseller") ||
    p.startsWith("/api/keys") ||
    p.startsWith("/api/quota") ||
    tagList.some((t) =>
      ["reseller", "byok", "api keys", "keys", "quota", "user keys", "quotas"].includes(t)
    )
  ) {
    return "reseller";
  }

  // 2. Core API: Public / Client Inference & Model Endpoints
  if (
    p.startsWith("/v1/") ||
    p.startsWith("/api/v1/chat") ||
    p.startsWith("/api/v1/messages") ||
    p.startsWith("/api/v1/responses") ||
    p.startsWith("/api/v1/embeddings") ||
    p.startsWith("/api/v1/multimodal-embeddings") ||
    p.startsWith("/api/v1/images") ||
    p.startsWith("/api/v1/audio") ||
    p.startsWith("/api/v1/moderations") ||
    p.startsWith("/api/v1/rerank") ||
    p.startsWith("/api/v1/models") ||
    p.startsWith("/api/v1/search") ||
    p.startsWith("/api/v1/files") ||
    p.startsWith("/api/v1/batches") ||
    p.startsWith("/api/v1/ws") ||
    p.startsWith("/api/v1/completions") ||
    p.startsWith("/api/v1/session-leases") ||
    p.startsWith("/api/v1/providers/") ||
    p === "/api/v1" ||
    tagList.some((t) =>
      [
        "chat",
        "models",
        "embeddings",
        "images",
        "audio",
        "responses",
        "messages",
        "moderations",
        "rerank",
        "search",
        "batches",
        "files",
        "completions",
        "session leases",
      ].includes(t)
    )
  ) {
    return "api";
  }

  // 3. Router Panel: Admin Dashboard & System Control Endpoints
  return "router-panel";
}
