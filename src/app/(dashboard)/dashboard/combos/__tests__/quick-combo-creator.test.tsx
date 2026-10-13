// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/i18n/messages/en.json";
import QuickComboCreator from "../QuickComboCreator";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.unstubAllGlobals();
});

function renderComponent(node: React.ReactElement) {
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

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const curationPayload = {
  connectedProviderIds: ["glm"],
  modelsByProvider: {
    glm: [
      { id: "glm-5.3", name: "GLM 5.3" },
      { id: "glm-4.6", name: "GLM 4.6" },
    ],
  },
  customizations: [],
};

describe("QuickComboCreator (§5)", () => {
  it("lists Manage-Models active candidates with failover/random switches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => curationPayload }))
    );
    const container = renderComponent(
      <NextIntlClientProvider
        locale="en"
        messages={{
          combos: (messages as Record<string, unknown>).combos,
          common: (messages as Record<string, unknown>).common,
        }}
      >
        <QuickComboCreator />
      </NextIntlClientProvider>
    );
    await flush();
    await flush();
    expect(container.textContent).toContain("Quick combo");
    expect(container.textContent).toContain("Auto failover");
    expect(container.textContent).toContain("Random");
    expect(container.textContent).toContain("glm/glm-5.3");
    expect(container.textContent).toContain("glm/glm-4.6");
  });

  it("creates a priority combo from checked candidates", async () => {
    const calls: Array<{ url: unknown; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: RequestInit) => {
        calls.push({ url, init });
        if (String(url).includes("/api/combos")) {
          return { ok: true, json: async () => ({ id: "auto-coding-combo" }) };
        }
        return { ok: true, json: async () => curationPayload };
      })
    );
    const onCreated = vi.fn();
    const container = renderComponent(
      <NextIntlClientProvider
        locale="en"
        messages={{
          combos: (messages as Record<string, unknown>).combos,
          common: (messages as Record<string, unknown>).common,
        }}
      >
        <QuickComboCreator onCreated={onCreated} />
      </NextIntlClientProvider>
    );
    await flush();
    await flush();

    const nameInput = container.querySelector(
      'input[placeholder="e.g. auto-coding-combo"]'
    ) as HTMLInputElement;
    await act(async () => {
      const { fireChange } = await import("./test-utils");
      fireChange(nameInput, "auto-coding-combo");
    });

    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    const glm53 = boxes.find((b) =>
      b.closest("label")?.textContent?.includes("glm/glm-5.3")
    ) as HTMLInputElement;
    expect(glm53).toBeDefined();
    await act(async () => {
      glm53.click();
    });

    const createBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Create combo")
    );
    await act(async () => {
      createBtn?.click();
    });
    await flush();

    const post = calls.find((c) => String(c.url).includes("/api/combos"));
    expect(post).toBeDefined();
    const body = JSON.parse(String(post?.init?.body ?? "{}"));
    expect(body.name).toBe("auto-coding-combo");
    expect(body.strategy).toBe("priority");
    expect(body.models).toContain("glm/glm-5.3");
    expect(onCreated).toHaveBeenCalledWith("auto-coding-combo");
  });
});
