// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddApiKeyModal from "../AddApiKeyModal";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cloudflare-ai" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

const cleanups: Array<() => void> = [];

function renderModal(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

describe("Cloudflare Workers AI Cupertino Right Sheet", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true }),
      })
    );
  });

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    vi.restoreAllMocks();
  });

  it("renders AddApiKeyModal as a Cupertino right slide-over sheet with 90% mobile width and close buttons", () => {
    const handleClose = vi.fn();
    const container = renderModal(
      <AddApiKeyModal
        isOpen={true}
        provider="cloudflare-ai"
        providerName="Cloudflare Workers AI"
        onSave={vi.fn().mockResolvedValue(undefined)}
        onClose={handleClose}
      />
    );

    // Verify slide-over sheet container with slide-in-from-right animation and 90vw mobile width
    const sheet = container.querySelector(".slide-in-from-right");
    expect(sheet).not.toBeNull();
    expect(sheet?.className).toContain("w-[90vw]");
    expect(sheet?.className).toContain("fixed");
    expect(sheet?.className).toContain("right-0");

    // Verify top drag handle pill
    const dragPill = container.querySelector(".w-10.h-1.rounded-full");
    expect(dragPill).not.toBeNull();

    // Verify Cloudflare Workers AI setup guide banner
    expect(container.textContent).toContain("Cloudflare Workers AI Setup Guide");
    expect(container.textContent).toContain("Open API Tokens");

    // Verify API Token input and Account ID input in main section
    const tokenInput = container.querySelector('input[placeholder="cfut_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]');
    expect(tokenInput).not.toBeNull();

    const accountIdInput = container.querySelector('input[placeholder="e.g. 394a5d02bb4a37a24f397c721aa16ccc"]');
    expect(accountIdInput).not.toBeNull();

    // Verify mobile bottom-right floating close button
    const mobileCloseButton = container.querySelector("button.sm\\:hidden");
    expect(mobileCloseButton).not.toBeNull();
  });
});
