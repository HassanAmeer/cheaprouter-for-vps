export type ProviderTab =
  | "all-providers"
  | "recent"
  | "connected"
  | "unconnected"
  | "reseller-api";

export type ProviderTabsConfig = Array<{
  id: ProviderTab;
  key: string;
  fallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  icon: string;
}>;

export const PROVIDER_TABS_CONFIG: ProviderTabsConfig = [
  {
    id: "all-providers",
    key: "allProvidersTab",
    fallback: "All Providers",
    descriptionKey: "allProvidersTabDesc",
    descriptionFallback: "Browse all 370+ supported providers with search and filters.",
    icon: "apps",
  },
  {
    id: "recent",
    key: "recentProvidersTab",
    fallback: "Recent Providers",
    descriptionKey: "recentProvidersTabDesc",
    descriptionFallback: "Providers you recently opened or tested.",
    icon: "history",
  },
  {
    id: "connected",
    key: "connectedProvidersTab",
    fallback: "Connected Providers",
    descriptionKey: "connectedProvidersTabDesc",
    descriptionFallback: "Providers with active credentials or API keys.",
    icon: "check_circle",
  },
  {
    id: "unconnected",
    key: "unconnectedProvidersTab",
    fallback: "Unconnected Providers",
    descriptionKey: "unconnectedProvidersTabDesc",
    descriptionFallback: "Providers not yet configured. Click to connect.",
    icon: "add_circle",
  },
  {
    id: "reseller-api",
    key: "resellerApiTab",
    fallback: "Reseller API Manage Providers",
    descriptionKey: "resellerApiTabDesc",
    descriptionFallback: "Control which providers are exposed publicly and manage BYOK.",
    icon: "storefront",
  },
];

/**
 * Maps a ProviderTab to the underlying provider category strings used for
 * filtering the provider list. Only relevant for the list-based tabs.
 */
export function tabToCategories(_tab: ProviderTab): string[] {
  // All category-based tabs show the full list; filtering is done by connection status
  return [
    "apikey",
    "oauth",
    "ide",
    "cli",
    "free",
    "no-auth",
    "noauth",
    "compatible",
    "web",
    "proxy",
    "upstream-proxy",
    "webfetch",
    "cloud",
    "cloudagent",
    "local",
    "search",
    "audio",
  ];
}

