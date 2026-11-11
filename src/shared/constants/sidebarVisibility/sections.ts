import type { SidebarItemDefinition, SidebarSectionDefinition } from "./types";

// ─── Item arrays ────────────────────────────────────────────────────────────

// Top standalone items: Home — no section header
const TOP_STANDALONE_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "home",
    href: "/home",
    i18nKey: "home",
    subtitleKey: "homeSubtitle",
    icon: "home",
    exact: true,
  },
];

// ROUTING — the things that decide WHERE a request goes.
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
    id: "manage-models",
    href: "/dashboard/manage-models",
    i18nKey: "manageModels",
    labelFallback: "Models",
    subtitleKey: "manageModelsSubtitle",
    subtitleFallback: "Activate, alias & test models",
    icon: "tune",
  },
  {
    id: "limits",
    href: "/dashboard/limits",
    i18nKey: "limits",
    labelFallback: "Quotas",
    subtitleKey: "limitsSubtitle",
    subtitleFallback: "Model & combo token limits",
    icon: "speed",
  },
];

// ACCESS — who may call what.
const ACCESS_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "api-manager",
    href: "/dashboard/api-manager",
    i18nKey: "apiManager",
    subtitleKey: "apiManagerSubtitle",
    icon: "vpn_key",
  },
  {
    id: "api-endpoints",
    href: "/dashboard/endpoint",
    i18nKey: "apiEndpoints",
    labelFallback: "Endpoints",
    subtitleKey: "apiEndpointsSubtitle",
    subtitleFallback: "Catalog, keys & reference",
    icon: "api",
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

// ADMIN — multi-tenant / tenant administration.
const ADMIN_ITEMS: readonly SidebarItemDefinition[] = [
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

// API Reference — the interactive developer docs for the gateway.
const API_NAV_ITEMS: readonly SidebarItemDefinition[] = [
  {
    id: "api-docs",
    href: "/dashboard/endpoint/api-reference",
    i18nKey: "apiDocs",
    labelFallback: "API Reference",
    subtitleKey: "apiDocsSubtitle",
    subtitleFallback: "Interactive developer documentation",
    icon: "menu_book",
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
  {
    id: "playground",
    href: "/dashboard/playground",
    i18nKey: "playground",
    labelFallback: "Playground",
    subtitleKey: "playgroundSubtitle",
    subtitleFallback: "Live multimodal testbench",
    icon: "science",
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
  // 1. Top standalone: Home
  {
    id: "top",
    titleKey: "home",
    titleFallback: "Home",
    children: TOP_STANDALONE_ITEMS,
    showTitle: false,
  },
  // 2. Routing: Providers, Combos, Models, Quotas
  {
    id: "cheap-proxy",
    titleKey: "routingSection",
    titleFallback: "Routing",
    children: CHEAP_PROXY_ITEMS,
  },
  // 3. Access: API Keys, Endpoints, Usage
  {
    id: "api",
    titleKey: "accessSection",
    titleFallback: "Access",
    children: [...ACCESS_ITEMS, ...API_NAV_ITEMS],
  },
  // 4. Tools: Logs + Playground
  {
    id: "devtools",
    titleKey: "toolsSection",
    titleFallback: "Tools",
    children: DEVTOOLS_ITEMS,
  },
  // 5. Admin: Users + Appearance
  {
    id: "bottom",
    titleKey: "adminSection",
    titleFallback: "Admin",
    children: [...ADMIN_ITEMS, ...BOTTOM_STANDALONE_ITEMS],
    showTitle: true,
  },
] as const;
