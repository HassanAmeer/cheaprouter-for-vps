// @vitest-environment jsdom
//
// Website scope dropdown (Providers page).
//
// The dropdown is the single place where the operator picks the active site,
// edits what the site exposes, and adds a new site (name + subdomains,
// `POST /api/sites`). These tests lock in that contract.

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteScopeBar } from "@/shared/components/SiteScopeBar";

const searchParams = new URLSearchParams();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/providers",
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "glm", name: "GLM" },
];

const cleanupCallbacks: Array<() => void> = [];

function renderBar() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<SiteScopeBar providers={PROVIDERS} />);
  });
  const unmount = () => {
    act(() => root.unmount());
    container.remove();
  };
  cleanupCallbacks.push(unmount);
  return { container, unmount };
}

async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function buttonByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    (button.textContent || "").includes(text)
  );
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  } as unknown as Response;
}

describe("SiteScopeBar", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    searchParams.delete("site");
    replace.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ sites: [] }));
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lists the sites from /api/sites in the dropdown", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        sites: [
          { id: "tokendeal", name: "Tokendeal", subdomains: ["router.tokendeal.cloud"] },
          { id: "demo", name: "Demo", subdomains: [] },
        ],
      })
    );
    const { container } = renderBar();
    await flushLoad();

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Website scope"]');
    expect(select).not.toBeNull();
    const options = Array.from(select!.options).map((option) => option.value);
    expect(options).toEqual(["", "tokendeal", "demo"]);
    // Subdomains of the active site show as helper text once selected.
    expect(container.textContent).toContain("Credentials are shared by every site");
  });

  it("writes ?site=<id> when a site is selected", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sites: [{ id: "tokendeal", name: "Tokendeal", subdomains: [] }] })
    );
    const { container } = renderBar();
    await flushLoad();

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Website scope"]');
    await act(async () => {
      select!.value = "tokendeal";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(replace).toHaveBeenCalledWith("/dashboard/providers?site=tokendeal", { scroll: false });
  });

  it("adds a website from the domain alone (no name field) through POST /api/sites", async () => {
    const { container } = renderBar();
    await flushLoad();

    act(() => {
      buttonByText(container, "Add website")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    // One field only — the display label is derived from the domain.
    expect(container.querySelector('input[aria-label="Site name"]')).toBeNull();
    const domainInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Website domain"]'
    )!;
    expect(domainInput).not.toBeNull();

    await act(async () => {
      domainInput.value = "router.tokendeal.cloud";
      domainInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        site: { id: "tokendeal", name: "Tokendeal", subdomains: ["router.tokendeal.cloud"] },
        sites: [{ id: "tokendeal", name: "Tokendeal", subdomains: ["router.tokendeal.cloud"] }],
      })
    );

    await act(async () => {
      buttonByText(container, "Add website")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST"
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(String((postCall![1] as RequestInit).body));
    // No `name` key: the server derives it from the first domain.
    expect(body).toEqual({ subdomains: ["router.tokendeal.cloud"] });
    // The new site is selected right away so its exposure can be edited.
    expect(replace).toHaveBeenCalledWith("/dashboard/providers?site=tokendeal", { scroll: false });
  });

  it("keeps the form open and shows the validation error when the site is invalid", async () => {
    const { container } = renderBar();
    await flushLoad();

    act(() => {
      buttonByText(container, "Add website")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const domainInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Website domain"]'
    )!;

    await act(async () => {
      domainInput.value = "https://example.com";
      domainInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    act(() => {
      buttonByText(container, "Add website")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(container.textContent).toMatch(/host like/i);
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === "POST")).toBe(
      false
    );
  });

  it("edits the exposure allowlist of the active site with the provider picker", async () => {
    searchParams.set("site", "tokendeal");
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/sites") {
        return Promise.resolve(
          jsonResponse({ sites: [{ id: "tokendeal", name: "Tokendeal", subdomains: [] }] })
        );
      }
      if (url.startsWith("/api/sites/") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(
          jsonResponse({
            site: { id: "tokendeal", name: "Tokendeal", subdomains: [] },
            providers: [],
            routes: [],
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { container } = renderBar();
    await flushLoad();

    const picker = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Add an exposed provider"]'
    );
    expect(picker).toBeInstanceOf(HTMLSelectElement);
    const options = Array.from(picker!.options).map((option) => option.value);
    expect(options).toContain("openai");
    expect(options).toContain("glm");

    await act(async () => {
      picker!.value = "glm";
      picker!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const patchCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/sites/tokendeal" &&
        (init as RequestInit | undefined)?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const body = JSON.parse(String((patchCall![1] as RequestInit).body));
    expect(body).toEqual({ providers: [{ provider: "glm", isEnabled: true }] });
  });
});
