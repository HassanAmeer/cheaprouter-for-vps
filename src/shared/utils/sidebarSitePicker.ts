/**
 * Placement rules for the sidebar website picker.
 *
 * The operator switches the active website from the sidebar, directly under the
 * Providers entry — that is where "which providers/models does this site
 * expose" is decided. Keeping the rule in one pure function (instead of inline
 * JSX conditions) is what the unit test locks in, so the picker cannot silently
 * drift back to the brand row or into the collapsed icon-only rail.
 */

/** The nav entry the compact website picker hangs under. */
export const SITE_PICKER_ANCHOR_HREF = "/dashboard/providers";

export interface SitePickerPlacement {
  /** Sidebar is in the icon-only rail. */
  collapsed: boolean;
  /** Nav entry being rendered. */
  href: string;
  /** The entry is being rendered inside the "pinned" section. */
  pinnedSection?: boolean;
}

/**
 * `true` when the compact website picker should be rendered right below the nav
 * item described by `href`.
 *
 * - only the Providers entry hosts it (one picker per sidebar)
 * - never in the collapsed rail: there is no room for a labelled control, and
 *   the icon-only rail is a temporary navigation mode, not a scope editor
 * - never in the "pinned" section: a pinned Providers item would otherwise
 *   render a second, identical picker
 */
export function shouldRenderSitePicker({
  collapsed,
  href,
  pinnedSection = false,
}: SitePickerPlacement): boolean {
  if (collapsed || pinnedSection) return false;
  return href === SITE_PICKER_ANCHOR_HREF;
}
