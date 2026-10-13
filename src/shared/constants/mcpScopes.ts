/**
 * MCP Authorization Scopes — Defines permission scopes for each MCP tool.
 *
 * Each tool requires specific scopes to execute. API keys can be configured
 * with a subset of scopes to limit tool access (least-privilege).
 */

// ============ Scope Definitions ============

/** All available MCP scopes */
export const MCP_SCOPE_LIST = [
  "read:health",
  "read:combos",
  "write:combos",
  "read:quota",
  "read:usage",
  "read:models",
  "read:radar",
  "execute:completions",
  "execute:search",
  "write:budget",
  "write:resilience",
  "pricing:write",
  "read:cache",
  "write:cache",
  "read:compression",
  "write:compression",
  "read:proxies",
] as const;

export type McpScope = (typeof MCP_SCOPE_LIST)[number];

// ============ Tool → Scope Mapping ============

/** Maps each MCP tool to its required scopes */
export const MCP_TOOL_SCOPES: Record<string, readonly McpScope[]> = {
  // Phase 1: Essential Tools
  cheaproute_get_health: ["read:health"],
  cheaproute_list_combos: ["read:combos"],
  cheaproute_get_combo_metrics: ["read:combos"],
  cheaproute_switch_combo: ["write:combos"],
  cheaproute_check_quota: ["read:quota"],
  cheaproute_route_request: ["execute:completions"],
  cheaproute_web_search: ["execute:search"],
  cheaproute_x_search: ["execute:search"],
  cheaproute_web_fetch: ["execute:search"],
  cheaproute_cost_report: ["read:usage"],
  cheaproute_list_models_catalog: ["read:models"],
  cheaproute_radar_catalog: ["read:radar"],

  // Phase 2: Advanced Tools
  cheaproute_simulate_route: ["read:health", "read:combos"],
  cheaproute_set_budget_guard: ["write:budget"],
  cheaproute_set_resilience_profile: ["write:resilience"],
  cheaproute_test_combo: ["execute:completions", "read:combos"],
  cheaproute_get_provider_metrics: ["read:health"],
  cheaproute_best_combo_for_task: ["read:combos", "read:health"],
  cheaproute_explain_route: ["read:health", "read:usage"],
  cheaproute_get_session_snapshot: ["read:usage"],
  cheaproute_db_health_check: ["read:health", "write:resilience"],
  cheaproute_sync_pricing: ["pricing:write"],
  cheaproute_cache_stats: ["read:cache"],
  cheaproute_cache_flush: ["write:cache"],
  cheaproute_compression_status: ["read:compression"],
  cheaproute_compression_configure: ["write:compression"],
  cheaproute_set_compression_engine: ["write:compression"],
  cheaproute_list_compression_combos: ["read:compression"],
  cheaproute_compression_combo_stats: ["read:compression"],
  cheaproute_ccr_store: ["write:compression"],
  cheaproute_ccr_retrieve: ["read:compression"],
  cheaproute_ccr_inspect: ["read:compression"],
  cheaproute_ccr_list: ["read:compression"],
  cheaproute_ccr_delete: ["write:compression"],
  cheaproute_ccr_stats: ["read:compression"],
  cheaproute_oneproxy_fetch: ["read:proxies"],
  cheaproute_oneproxy_rotate: ["read:proxies"],
  cheaproute_oneproxy_stats: ["read:proxies"],

  // Web-session pool observability (read) + lifecycle (write)
  cheaproute_pool_status: ["read:health"],
  cheaproute_pool_sessions: ["read:health"],
  cheaproute_pool_health: ["read:health"],
  cheaproute_pool_reset: ["write:resilience"],
  cheaproute_pool_warm: ["write:resilience"],
  // Stealth browser pool observability (#3368 PR7)
  cheaproute_browser_pool_status: ["read:health"],
} as const;
