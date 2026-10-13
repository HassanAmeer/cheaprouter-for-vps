import type {
  SidebarItemDefinition,
  SidebarSectionDefinition,
} from "./types";

// ─── Item arrays ────────────────────────────────────────────────────────────

const HOME_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "home",
    href: "/home",
    i18nKey: "home",
    subtitleKey: "homeSubtitle",
    icon: "home",
    exact: true,
  },
];

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
    href: "/docs",
    i18nKey: "apiDocs",
    labelFallback: "API Docs",
    subtitleKey: "apiDocsSubtitle",
    subtitleFallback: "Interactive developer documentation",
    icon: "menu_book",
  },
];

const OMNI_PROXY_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "api-manager",
    href: "/dashboard/api-manager",
    i18nKey: "apiManager",
    subtitleKey: "apiManagerSubtitle",
    icon: "vpn_key",
  },
  {
    id: "providers",
    href: "/dashboard/providers",
    i18nKey: "providers",
    subtitleKey: "providersSubtitle",
    icon: "dns",
  },
  {
    id: "model-catalog",
    href: "/dashboard/models",
    i18nKey: "modelCatalog",
    labelFallback: "Models & Combos",
    subtitleKey: "modelCatalogSubtitle",
    subtitleFallback: "Browse models and combos across providers",
    icon: "view_list",
  },
  {
    id: "combos",
    href: "/dashboard/combos",
    i18nKey: "combos",
    subtitleKey: "combosSubtitle",
    icon: "layers",
  },
];

const COSTS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "usage",
    href: "/dashboard/usage",
    i18nKey: "usage",
    labelFallback: "Usage",
    subtitleKey: "usageSubtitle",
    subtitleFallback: "Token & provider consumption",
    icon: "data_usage",
  },
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

const SETTINGS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "settings-appearance",
    href: "/dashboard/settings/appearance",
    i18nKey: "settingsAppearance",
    subtitleKey: "settingsAppearanceSubtitle",
    icon: "palette",
  },
];

const MULTI_TENANT_ITEMS: readonly SidebarItemDefinition[] = [
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

// ─── Sections ────────────────────────────────────────────────────────────────

export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  // Dedicated top-level API navigation — pinned to the very top of the sidebar
  // so operators land on the Endpoint catalog or API Docs first.
  {
    id: "api",
    titleKey: "apiSection",
    titleFallback: "API",
    children: API_NAV_ITEMS,
    showTitle: false,
  },
  {
    id: "home",
    titleKey: "home",
    titleFallback: "Home",
    children: HOME_ITEMS,
    showTitle: false,
  },
  {
    id: "cheap-proxy",
    titleKey: "cheapProxySection",
    titleFallback: "CheapProxy",
    children: OMNI_PROXY_ITEMS,
  },
  {
    id: "multi-tenant",
    titleKey: "multiTenantSection",
    titleFallback: "Reseller",
    children: MULTI_TENANT_ITEMS,
  },
  {
    id: "costs",
    titleKey: "costsSection",
    titleFallback: "Info",
    children: COSTS_ITEMS,
  },
  {
    id: "devtools",
    titleKey: "devtoolsSection",
    titleFallback: "Dev Tools",
    children: DEVTOOLS_ITEMS,
  },
  {
    id: "settings",
    titleKey: "settings",
    titleFallback: "Setting",
    children: SETTINGS_ITEMS,
  },
] as const;
