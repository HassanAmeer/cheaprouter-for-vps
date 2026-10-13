// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/i18n/messages/en.json";
import { hasByokHeader } from "@/lib/byokHeaders";
import { createKeySchema } from "@/shared/validation/schemas/keys";
import ManageModelsPanel from "../ManageModelsPanel";
import ResellerApiPanel from "../ResellerApiPanel";

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

describe("hasByokHeader (§9b)", () => {
  it("detects the generic x-upstream-key header", () => {
    expect(hasByokHeader(new Headers({ "x-upstream-key": "sk-user-123" }))).toBe(true);
  });

  it("detects provider-scoped headers", () => {
    expect(hasByokHeader(new Headers({ "x-claude-key": "sk-ant-1" }))).toBe(true);
  });

  it("returns false without BYOK headers", () => {
    expect(hasByokHeader(new Headers({ authorization: "Bearer srv" }))).toBe(false);
    expect(hasByokHeader(null)).toBe(false);
    expect(hasByokHeader(undefined)).toBe(false);
  });
});

describe("createKeySchema reseller provisioning (§8a)", () => {
  const base = { name: "User1-Pro-Plan", expiresAt: "2026-11-12T00:00:00Z" };

  it("accepts allowedModels + modelLimits + rateLimits + expiresAt", () => {
    const result = createKeySchema.safeParse({
      ...base,
      allowedModels: ["glm-5.3_flash", "deepseek-r1", "gemini-2.5-flash"],
      modelLimits: {
        "glm-5.3_flash": { maxTokens: 100000000 },
        "deepseek-r1": { maxTokens: 50000000 },
      },
      rateLimits: { requestsPerMinute: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive maxTokens", () => {
    const result = createKeySchema.safeParse({
      ...base,
      modelLimits: { "some-model": { maxTokens: 0 } },
    });
    expect(result.success).toBe(false);
  });
});

describe("ManageModelsPanel (Tab 4)", () => {
  const curationPayload = {
    connectedProviderIds: ["glm"],
    modelsByProvider: {
      glm: [{ id: "glm-5.3", name: "GLM 5.3", contextWindow: 200000 }],
    },
    customizations: [
      {
        providerId: "glm",
        originalModelId: "glm-5.3",
        customName: null,
        customAlias: "glm-5.3_flash",
        isActive: true,
        isTested: false,
        testStatus: null,
        testHttpStatus: null,
        testLatencyMs: null,
        testResponse: null,
        contextWindow: null,
        capabilities: null,
        isFreeOverride: null,
      },
    ],
  };

  it("renders connected provider group with activation checkbox and FREE/PAID badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => curationPayload }))
    );
    const container = renderComponent(<ManageModelsPanel />);
    await flush();
    await flush();
    expect(container.textContent).toContain("glm");
    expect(container.textContent).toContain("glm-5.3");
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    // FREE or PAID badge is always rendered for each model row.
    expect(/FREE|PAID/.test(container.textContent ?? "")).toBe(true);
  });

  it("shows an error alert when the curation API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }))
    );
    const container = renderComponent(<ManageModelsPanel />);
    await flush();
    await flush();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
});

describe("ResellerApiPanel (Tab 5)", () => {
  const publicPayload = {
    providers: [
      {
        id: "glm",
        name: "GLM",
        hasConnection: true,
        connectionCount: 1,
        modelsCount: 3,
        isPublished: true,
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        hasConnection: false,
        connectionCount: 0,
        modelsCount: 2,
        isPublished: false,
      },
    ],
  };

  it("renders exposure checkboxes reflecting published state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/v1/reseller/byok")) {
          return { ok: true, json: async () => ({ byokEnabled: true }) };
        }
        return { ok: true, json: async () => publicPayload };
      })
    );
    const container = renderComponent(
      <NextIntlClientProvider
        locale="en"
        messages={{
          endpoint: (messages as Record<string, unknown>).endpoint,
          providers: (messages as Record<string, unknown>).providers,
          common: (messages as Record<string, unknown>).common,
        }}
      >
        <ResellerApiPanel />
      </NextIntlClientProvider>
    );
    await flush();
    await flush();
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    // 2 provider checkboxes (BYOK toggle renders separately inside its card).
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    const glmBox = boxes.find((b) => b.closest("label")?.textContent?.includes("GLM")) as
      HTMLInputElement | undefined;
    expect(glmBox?.checked).toBe(true);
  });
});
