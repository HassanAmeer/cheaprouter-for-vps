export type ProviderTab = "apikey" | "oauth" | "free" | "compatible" | "all";

export type ProviderTabsConfig = Array<{
  id: ProviderTab;
  key: string;
  fallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  icon: string;
  colorClass: string;
}>;

export const PROVIDER_TABS_CONFIG: ProviderTabsConfig = [
  {
    id: "apikey",
    key: "apiKeyProvidersTab",
    fallback: "API Key",
    descriptionKey: "apiKeyProvidersTabDesc",
    descriptionFallback:
      "Connect providers like OpenAI, Anthropic, Gemini, Groq and more with an API key.",
    icon: "key",
    colorClass: "bg-amber-500",
  },
  {
    id: "oauth",
    key: "oauthProvidersTab",
    fallback: "OAuth",
    descriptionKey: "oauthProvidersTabDesc",
    descriptionFallback:
      "OAuth and IDE providers (Cursor, Kiro, Claude, etc.) authenticated via browser.",
    icon: "account_circle",
    colorClass: "bg-blue-500",
  },
  {
    id: "free",
    key: "freeProvidersTab",
    fallback: "Free & No-Auth",
    descriptionKey: "freeProvidersTabDesc",
    descriptionFallback:
      "Providers with free tiers or local/no-auth access.",
    icon: "star",
    colorClass: "bg-green-500",
  },
  {
    id: "compatible",
    key: "compatibleProvidersTab",
    fallback: "Compatible Gateways",
    descriptionKey: "compatibleProvidersTabDesc",
    descriptionFallback:
      "Custom OpenAI, Anthropic, Claude Code-compatible and special-use providers.",
    icon: "hub",
    colorClass: "bg-orange-500",
  },
  {
    id: "all",
    key: "allProvidersTab",
    fallback: "All Providers",
    descriptionKey: "allProvidersTabDesc",
    descriptionFallback:
      "Browse every provider and category with full search and filters.",
    icon: "apps",
    colorClass: "bg-primary",
  },
];

export function tabToCategories(tab: ProviderTab): string[] {
  switch (tab) {
    case "apikey":
      return ["apikey"];
    case "oauth":
      return ["oauth", "ide"];
    case "free":
      return ["free", "no-auth"];
    case "compatible":
      return ["compatible", "web", "upstream-proxy", "webfetch", "cloudagent", "local", "search", "audio"];
    case "all":
      return [
        "apikey",
        "oauth",
        "ide",
        "free",
        "no-auth",
        "compatible",
        "web",
        "upstream-proxy",
        "webfetch",
        "cloudagent",
        "local",
        "search",
        "audio",
      ];
    default:
      return [];
  }
}
