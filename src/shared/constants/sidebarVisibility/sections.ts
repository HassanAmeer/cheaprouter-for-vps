import type {
  SidebarItemDefinition,
  SidebarSectionDefinition,
} from "./types";

// ─── Item arrays ────────────────────────────────────────────────────────────

// Top standalone items: Home, Users — no section header
const TOP_STANDALONE_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "home",
    href: "/home",
    i18nKey: "home",
    subtitleKey: "homeSubtitle",
    icon: "home",
    exact: true,
  },
  {
    id: "users",
    href: "/dashboard/users",
    i18nKey: "users",
    labelFallback: "Users",
    subtitleKey: "usersSubtitle",
    subtitleFallback: "Reseller users, plans & BYOK keys",
    icon: "groups",
  },
];

// CheapProxy section: Providers, Combos, API Keys, Usage
const CHEAP_PROXY_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "providers",
    href: "/dashboard/providers",
    i18nKey: "providers",
    subtitleKey: "providersSubtitle",
    icon: "dns",
  },
  {
    id: "combos",
    href: "/dashboard/combos",
    i18nKey: "combos",
    subtitleKey: "combosSubtitle",
    icon: "layers",
  },
  {
    id: "api-manager",
    href: "/dashboard/api-manager",
    i18nKey: "apiManager",
    subtitleKey: "apiManagerSubtitle",
    icon: "vpn_key",
  },
  {
    id: "usage",
    href: "/dashboard/usage",
    i18nKey: "usage",
    labelFallback: "Usage",
    subtitleKey: "usageSubtitle",
    subtitleFallback: "Token & provider consumption",
    icon: "data_usage",
  },
];

// API section: Endpoints + Docs
const API_NAV_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "api-endpoints",
    href: "/dashboard/endpoint",
    i18nKey: "apiEndpoints",
    labelFallback: "API Endpoints",
    subtitleKey: "apiEndpointsSubtitle",
    subtitleFallback: "Visual endpoint catalog & integration guides",
    icon: "api",
  },
  {
    id: "api-docs",
    href: "/dashboard/endpoint/api-reference",
    i18nKey: "apiDocs",
    labelFallback: "API Docs",
    subtitleKey: "apiDocsSubtitle",
    subtitleFallback: "Interactive developer documentation",
    icon: "menu_book",
  },
];

// Info section: Costs/Pricing + Free Provider Rankings
const INFO_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "costs-pricing",
    href: "/dashboard/costs/pricing",
    i18nKey: "costsPricing",
    subtitleKey: "costsPricingSubtitle",
    icon: "price_change",
  },
  {
    id: "free-provider-rankings",
    href: "/dashboard/free-provider-rankings",
    i18nKey: "freeProviderRankings",
    subtitleKey: "freeProviderRankingsSubtitle",
    icon: "leaderboard",
  },
];

// Dev Tools section: Logs, Proxy Logs, Console Logs
const DEVTOOLS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "logs",
    href: "/dashboard/logs",
    i18nKey: "logs",
    subtitleKey: "logsSubtitle",
    icon: "description",
  },
  {
    id: "logs-proxy",
    href: "/dashboard/logs/proxy",
    i18nKey: "logsProxy",
    subtitleKey: "logsProxySubtitle",
    icon: "lan",
  },
  {
    id: "logs-console",
    href: "/dashboard/logs/console",
    i18nKey: "consoleLogs",
    subtitleKey: "consoleLogsSubtitle",
    icon: "terminal",
  },
];

// Bottom standalone: Theme — no section header
const BOTTOM_STANDALONE_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "settings-appearance",
    href: "/dashboard/settings/appearance",
    i18nKey: "settingsAppearance",
    subtitleKey: "settingsAppearanceSubtitle",
    icon: "palette",
  },
];

// ─── Sections ────────────────────────────────────────────────────────────────

export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  // 1. Top standalone: Home, Users, Usage
  {
    id: "top",
    titleKey: "home",
    titleFallback: "Home",
    children: TOP_STANDALONE_ITEMS,
    showTitle: false,
  },
  // 2. CheapProxy: Providers, Combos, API Keys
  {
    id: "cheap-proxy",
    titleKey: "cheapProxySection",
    titleFallback: "CheapProxy",
    children: CHEAP_PROXY_ITEMS,
  },
  // 3. API: Endpoints + Docs
  {
    id: "api",
    titleKey: "apiSection",
    titleFallback: "API",
    children: API_NAV_ITEMS,
  },
  // 4. Info: Costs + Rankings
  {
    id: "info",
    titleKey: "costsSection",
    titleFallback: "Info",
    children: INFO_ITEMS,
  },
  // 5. Dev Tools: Logs
  {
    id: "devtools",
    titleKey: "devtoolsSection",
    titleFallback: "Dev Tools",
    children: DEVTOOLS_ITEMS,
  },
  // 6. Bottom standalone: Theme (no section label)
  {
    id: "bottom",
    titleKey: "settings",
    titleFallback: "Settings",
    children: BOTTOM_STANDALONE_ITEMS,
    showTitle: false,
  },
] as const;
