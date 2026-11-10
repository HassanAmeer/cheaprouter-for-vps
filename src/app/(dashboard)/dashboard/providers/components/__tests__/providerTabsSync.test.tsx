// @vitest-environment jsdom
//
// The providers tab bar keeps its own copy of the active tab. When the page
// switched tabs on its own (e.g. the empty state's "Browse All Providers"
// button) the bar kept highlighting the OLD tab while the content already
// showed the new one — the user could not tell where they were.
//
// These tests pin the sync between the page-owned tab and the tab bar.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderTabs } from "../ProviderTabs";
import type { ProviderTab } from "../../hooks/useProviderTabs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/providers",
  useSearchParams: () => new URLSearchParams(),
}));

const cleanupCallbacks: Array<() => void> = [];

function renderTabs(initialTab: ProviderTab, onTabChange?: (tab: ProviderTab) => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const render = (tab: ProviderTab) => {
    act(() => {
      root.render(<ProviderTabs initialTab={tab} onTabChange={onTabChange} />);
    });
  };
  render(initialTab);

  const unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  cleanupCallbacks.push(unmount);
  return { container, render };
}

function selectedTabLabel(container: HTMLElement): string {
  const selected = container.querySelector('[role="tab"][aria-selected="true"]');
  return (selected?.textContent ?? "").trim();
}

describe("ProviderTabs — active tab sync", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("follows a tab change that came from the page", () => {
    const { container, render } = renderTabs("connected");
    const before = selectedTabLabel(container);

    // The page switched the tab itself (empty-state button).
    render("all-providers");

    const after = selectedTabLabel(container);
    expect(after).not.toBe(before);
  });

  it("reports the clicked tab to the page", () => {
    const onTabChange = vi.fn();
    const { container } = renderTabs("all-providers", onTabChange);

    const buttons = Array.from(container.querySelectorAll('[role="tab"]'));
    const target = buttons.find(
      (b) => (b.textContent ?? "").trim() !== selectedTabLabel(container)
    );
    expect(target).toBeDefined();

    act(() => {
      target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onTabChange).toHaveBeenCalled();
  });
});
