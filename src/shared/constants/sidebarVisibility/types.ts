export const HIDEABLE_SIDEBAR_ITEM_IDS = [
  // Home
  "home",
  // OmniProxy
  "endpoints",
  "api-manager",
  "providers",
  "model-catalog",
  "combos",
  // Info
  "usage",
  "costs-pricing",
  "free-provider-rankings",
  // Dev Tools
  "logs",
  "logs-proxy",
  "logs-console",
  "playground",
  // Setting
  "settings-appearance",
] as const;

export type HideableSidebarItemId = (typeof HIDEABLE_SIDEBAR_ITEM_IDS)[number];

export type AlwaysVisibleSidebarItemId = "home";

export type SidebarItemId = HideableSidebarItemId | AlwaysVisibleSidebarItemId;

export type SidebarSectionId =
  | "home"
  | "pinned"
  | "omni-proxy"
  | "costs"
  | "devtools"
  | "settings";

export interface SidebarItemDefinition {
  id: SidebarItemId;
  href: string;
  i18nKey: string;
  subtitleKey?: string;
  labelFallback?: string;
  subtitleFallback?: string;
  icon: string;
  exact?: boolean;
  external?: boolean;
  featureFlagKey?: string;
}

export interface SidebarItemGroup {
  type: "group";
  id: string;
  titleKey: string;
  titleFallback: string;
  items: readonly SidebarItemDefinition[];
}

export type SidebarSectionChild = SidebarItemDefinition | SidebarItemGroup;

export interface SidebarSectionDefinition {
  id: SidebarSectionId;
  titleKey: string;
  titleFallback: string;
  children: readonly SidebarSectionChild[];
  showTitle?: boolean;
  visibility?: "always" | "debug";
  defaultPinned?: boolean;
}

export type SidebarPresetId = "all";

export interface SidebarPresetDefinition {
  id: SidebarPresetId;
  icon: string;
  hiddenItems: HideableSidebarItemId[];
}

export type SidebarItemOrder = Partial<Record<SidebarSectionId, string[]>>;
