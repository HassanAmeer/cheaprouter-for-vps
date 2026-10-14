export * from "./sidebarVisibility/types";
export { SIDEBAR_SECTIONS } from "./sidebarVisibility/sections";

import { SIDEBAR_SECTIONS } from "./sidebarVisibility/sections";
import { HIDEABLE_SIDEBAR_ITEM_IDS } from "./sidebarVisibility/types";
import type {
  HideableSidebarItemId,
  SidebarItemId,
  SidebarSectionId,
  SidebarItemDefinition,
  SidebarSectionChild,
  SidebarSectionDefinition,
  SidebarPresetDefinition,
} from "./sidebarVisibility/types";

export const SIDEBAR_ICON_ACCENTS: Partial<Record<SidebarItemId, string>> = {
  home: "#60A5FA",
  usage: "#10B981",
  "api-manager": "#F59E0B",
  "api-endpoints": "#38BDF8",
  "api-docs": "#818CF8",
  providers: "#818CF8",
  "manage-models": "#06B6D4",
  limits: "#F43F5E",
  combos: "#A855F7",
  users: "#14B8A0",
  "costs-pricing": "#FB923C",
  "free-provider-rankings": "#10B981",
  logs: "#CBD5E1",
  "logs-proxy": "#A3E635",
  "logs-console": "#FACC15",
  playground: "#EAB308",
  "settings-appearance": "#D946EF",
};

export const SIDEBAR_SUBITEM_ICON_ACCENTS: Record<string, string> = {};

function getDeterministicIconAccent(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

export function getSidebarIconAccent(id: string): string {
  return (
    SIDEBAR_ICON_ACCENTS[id as SidebarItemId] ||
    SIDEBAR_SUBITEM_ICON_ACCENTS[id] ||
    getDeterministicIconAccent(id)
  );
}

export function isSidebarItemVisibleForFlags(
  item: Pick<SidebarItemDefinition, "featureFlagKey">,
  flags: Record<string, boolean>
): boolean {
  if (!item.featureFlagKey) return true;
  return flags[item.featureFlagKey] !== false;
}

export function getSectionItems(
  section: SidebarSectionDefinition | { children: readonly SidebarSectionChild[] }
): readonly SidebarItemDefinition[] {
  return section.children.flatMap((child) =>
    "type" in child && child.type === "group" ? child.items : [child as SidebarItemDefinition]
  );
}

// ─── Section master toggle ────────────────────────────────────────────────────

export const PROTECTED_SIDEBAR_ITEM_IDS: ReadonlySet<SidebarItemId> = new Set<SidebarItemId>([
  "home",
]);

export const HIDDEN_SIDEBAR_SECTIONS_SETTING_KEY = "hiddenSidebarSections";

export const HIDEABLE_SIDEBAR_SECTION_IDS: readonly SidebarSectionId[] = SIDEBAR_SECTIONS.filter(
  (section) =>
    !getSectionItems(section).some((item) =>
      PROTECTED_SIDEBAR_ITEM_IDS.has(item.id as SidebarItemId)
    )
).map((section) => section.id);

export function isSidebarSectionHideable(
  section: Pick<SidebarSectionDefinition, "id" | "children">
): boolean {
  return HIDEABLE_SIDEBAR_SECTION_IDS.includes(section.id as SidebarSectionId);
}

export function normalizeHiddenSidebarSections(value: unknown): SidebarSectionId[] {
  if (!Array.isArray(value)) return [];

  const hidden = new Set<SidebarSectionId>();
  for (const id of value) {
    if (typeof id === "string" && HIDEABLE_SIDEBAR_SECTION_IDS.includes(id as SidebarSectionId)) {
      hidden.add(id as SidebarSectionId);
    }
  }
  return HIDEABLE_SIDEBAR_SECTION_IDS.filter((id) => hidden.has(id));
}

export function isSidebarSectionHidden(
  sectionId: SidebarSectionId,
  hiddenSections: readonly SidebarSectionId[]
): boolean {
  return hiddenSections.includes(sectionId);
}

export function toggleSidebarSectionVisibility(
  hiddenSections: readonly SidebarSectionId[],
  sectionId: SidebarSectionId,
  show: boolean
): SidebarSectionId[] {
  const next = hiddenSections.filter((id) => id !== sectionId);
  if (!show) {
    if (!HIDEABLE_SIDEBAR_SECTION_IDS.includes(sectionId)) return [...hiddenSections];
    next.push(sectionId);
  }
  return next;
}

export function resolveRuntimeSidebarSections(
  sections: readonly SidebarSectionDefinition[],
  _runtime?: { radarAdminUrl?: unknown }
): SidebarSectionDefinition[] {
  return [...sections];
}

// ─── Ordering & preset setting keys ──────────────────────────────────────────

export const HIDDEN_SIDEBAR_ITEMS_SETTING_KEY = "hiddenSidebarItems";
export const SIDEBAR_SECTION_ORDER_KEY = "sidebarSectionOrder";
export const SIDEBAR_ITEM_ORDER_KEY = "sidebarItemOrder";
export const SIDEBAR_PRESET_KEY = "sidebarActivePreset";
export const SIDEBAR_SETTINGS_UPDATED_EVENT = "cheaproute:settings-updated";

export const ESSENTIALS_ADVANCED_TOOL_IDS: ReadonlySet<HideableSidebarItemId> = new Set([
  "playground",
  "logs",
  "combos",
]);

export const SIDEBAR_PRESETS: readonly SidebarPresetDefinition[] = [
  { id: "all", icon: "select_all", hiddenItems: [] },
];

// ─── Ordering utilities ───────────────────────────────────────────────────────

export function applySectionOrder(
  sections: readonly SidebarSectionDefinition[],
  order: SidebarSectionId[]
): SidebarSectionDefinition[] {
  if (order.length === 0) return [...sections];
  const knownIds = new Set(sections.map((s) => s.id));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...sections].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? validOrder.length + sections.indexOf(a);
    const bi = orderMap.get(b.id) ?? validOrder.length + sections.indexOf(b);
    return ai - bi;
  });
}

export function applyItemOrder(
  children: readonly SidebarSectionChild[],
  order: string[]
): SidebarSectionChild[] {
  if (order.length === 0) return [...children];
  const getChildId = (c: SidebarSectionChild): string =>
    "type" in c && c.type === "group" ? c.id : (c as SidebarItemDefinition).id;
  const knownIds = new Set(children.map(getChildId));
  const validOrder = order.filter((id) => knownIds.has(id));
  const orderMap = new Map(validOrder.map((id, i) => [id, i]));
  return [...children].sort((a, b) => {
    const aId = getChildId(a);
    const bId = getChildId(b);
    const ai = orderMap.get(aId) ?? validOrder.length + children.indexOf(a);
    const bi = orderMap.get(bId) ?? validOrder.length + children.indexOf(b);
    return ai - bi;
  });
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export function normalizeHiddenSidebarItems(value: unknown): HideableSidebarItemId[] {
  if (!Array.isArray(value)) return [];

  const hiddenItems = new Set<HideableSidebarItemId>();

  for (const item of value) {
    if (
      typeof item === "string" &&
      HIDEABLE_SIDEBAR_ITEM_IDS.includes(item as HideableSidebarItemId)
    ) {
      hiddenItems.add(item as HideableSidebarItemId);
    }
  }

  return HIDEABLE_SIDEBAR_ITEM_IDS.filter((item) => hiddenItems.has(item));
}
