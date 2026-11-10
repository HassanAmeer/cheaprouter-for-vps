// @vitest-environment jsdom
//
// Provider detail page — guide affordance.
//
// The provider detail page used to render a dedicated "Quick Guide & Free
// Models" banner with its own "Open iOS Guide & Models" button. That banner
// duplicated the guide entry point that already exists in the page header:
// the small ⓘ icon rendered next to the provider name.
//
// These tests lock in the new contract:
//   1. The legacy banner + button are gone from the detail page.
//   2. The header ⓘ icon is present for every provider and opens the same
//      Cupertino guide sheet.
//   3. ?action=guide (the ProviderCard fallback deep-link) opens that sheet
//      too, so the info affordance works for all providers.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "openai" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/providers/openai",
  useSearchParams: () => searchParams,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values) {
      return Object.entries(values).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), key);
    }
    return key;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/store/notificationStore", () => ({
  useNotificationStore: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const { default: ProviderDetailPageClient } = await import("../ProviderDetailPageClient");

const INFO_BUTTON_SELECTOR = 'button[aria-label="Provider Info, Limits & How to Connect"]';

const cleanupCallbacks: Array<() => void> = [];

function emptyJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
    headers: { get: () => null },
  } as unknown as Response;
}

function renderProviderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ProviderDetailPageClient />);
  });

  const unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  cleanupCallbacks.push(unmount);
  return { container, unmount };
}

/** Flush the mount effects + the async connection/model fetches. */
async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Provider detail page — guide affordance", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    searchParams.delete("action");
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(emptyJsonResponse()));
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }))
    );
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("no longer renders the legacy 'Quick Guide & Free Models' banner", async () => {
    const { container } = renderProviderPage();
    await flushLoad();

    expect(container.textContent).not.toContain("Quick Guide & Free Models");
    expect(container.textContent).not.toContain("Open iOS Guide & Models");
    expect(container.textContent).not.toContain("Cupertino iOS Guide");
  });

  it("exposes the guide through the info icon next to the provider name", async () => {
    const { container } = renderProviderPage();
    await flushLoad();

    const infoButton = container.querySelector<HTMLButtonElement>(INFO_BUTTON_SELECTOR);
    expect(infoButton).not.toBeNull();

    await act(async () => {
      infoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // The Cupertino guide sheet is the only place with the 3-tab layout.
    expect(container.textContent).toContain("Requirements");
    expect(container.textContent).toContain("How to Connect");
  });

  it("opens the guide sheet from the ?action=guide deep link", async () => {
    searchParams.set("action", "guide");
    const { container } = renderProviderPage();
    await flushLoad();

    expect(container.textContent).toContain("Requirements");
    expect(container.textContent).toContain("How to Connect");
  });
});
