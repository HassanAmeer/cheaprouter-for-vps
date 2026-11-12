/**
 * The website picker belongs in the sidebar nav, immediately below the
 * Providers entry — not in the brand row (where it used to sit inside the
 * `/home` <Link>, so clicking it navigated away) and not in the collapsed rail.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_PICKER_ANCHOR_HREF,
  shouldRenderSitePicker,
} from "../../src/shared/utils/sidebarSitePicker";

test("the picker anchors under the Providers entry", () => {
  assert.equal(SITE_PICKER_ANCHOR_HREF, "/dashboard/providers");
  assert.equal(shouldRenderSitePicker({ collapsed: false, href: "/dashboard/providers" }), true);
});

test("no picker under any other nav entry", () => {
  for (const href of [
    "/home",
    "/dashboard/combos",
    "/dashboard/manage-models",
    "/dashboard/usage",
    "/dashboard/endpoint",
  ]) {
    assert.equal(shouldRenderSitePicker({ collapsed: false, href }), false, href);
  }
});

test("no picker in the collapsed icon-only rail", () => {
  assert.equal(shouldRenderSitePicker({ collapsed: true, href: "/dashboard/providers" }), false);
});

test("no duplicate picker when Providers is pinned", () => {
  assert.equal(
    shouldRenderSitePicker({ collapsed: false, href: "/dashboard/providers", pinnedSection: true }),
    false
  );
});
