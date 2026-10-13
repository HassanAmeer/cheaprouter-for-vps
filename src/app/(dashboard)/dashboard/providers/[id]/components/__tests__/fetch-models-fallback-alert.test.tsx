// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProviderModelsSection from "../ProviderModelsSection";
import { parseManualContextWindow, formatManualContextBadge } from "../CustomModelsSection";
import type { ProviderMessageTranslator } from "../../providerCredentialText";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
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

// providerText() falls back to the default string when t.has is absent.
const t = Object.assign((_key: string) => _key, {}) as unknown as ProviderMessageTranslator;

const asyncNoop = async () => {};
const noop = () => {};

function baseProps() {
  return {
    providerId: "glm",
    providerAlias: "glm",
    providerStorageAlias: "glm",
    providerDisplayAlias: "glm",
    providerInfo: null,
    isCcCompatible: false,
    isAnthropicCompatible: false,
    isAnthropicProtocolCompatible: false,
    isManagedAvailableModelsProvider: false,
    compatibleSupportsModelImport: false,
    allowModelImport: true,
    models: [{ id: "glm-5.3", name: "GLM 5.3" }],
    modelMeta: { customModels: [] },
    modelAliases: {},
    syncedAvailableModels: [],
    syncedCatalogAuthoritative: false,
    compatibleFallbackModels: [],
    copied: null,
    onCopy: noop,
    onSetAlias: asyncNoop,
    onDeleteAlias: asyncNoop,
    fetchProviderModelMeta: asyncNoop,
    connections: [],
    selectedConnection: null,
    canImportModels: true,
    importingModels: false,
    handleImportModels: asyncNoop,
    isAutoSyncEnabled: false,
    togglingAutoSync: false,
    handleToggleAutoSync: asyncNoop,
    isAutoFetchModelsEnabled: false,
    togglingAutoFetchModels: false,
    handleToggleAutoFetchModels: asyncNoop,
    handleCompatibleImportWithProgress: asyncNoop,
    compatSavingModelId: null,
    togglingModelId: null,
    bulkVisibilityAction: null,
    clearingModels: false,
    modelFilter: "",
    testingModelId: null,
    modelTestStatus: {},
    onModelTestStatusChange: noop,
    testingAll: false,
    testProgress: null,
    autoHideFailed: false,
    visibilityFilter: "all" as "visible" | "hidden" | "all",
    providerAliasEntries: [],
    setModelFilter: noop,
    setAutoHideFailed: noop,
    setVisibilityFilter: noop,
    saveModelCompatFlags: asyncNoop,
    handleToggleModelHidden: asyncNoop,
    handleBulkToggleModelHidden: asyncNoop,
    handleClearAllModels: asyncNoop,
    onTestModel: asyncNoop,
    handleTestAll: asyncNoop,
    effectiveModelNormalize: () => false,
    effectiveModelPreserveDeveloper: () => false,
    effectiveModelHidden: () => false,
    getUpstreamHeadersRecordForModel: () => ({}),
    t,
  };
}

describe("parseManualContextWindow (§3.2)", () => {
  it("parses plain counts and K/M shorthand", () => {
    expect(parseManualContextWindow("")).toBeNull();
    expect(parseManualContextWindow("200000")).toBe(200000);
    expect(parseManualContextWindow("128K")).toBe(128000);
    expect(parseManualContextWindow("1M")).toBe(1000000);
    expect(parseManualContextWindow("1.5m")).toBe(1500000);
  });

  it("rejects garbage", () => {
    expect(parseManualContextWindow("abc")).toBeNull();
    expect(parseManualContextWindow("-5")).toBeNull();
    expect(parseManualContextWindow("0")).toBeNull();
  });

  it("formats context badges", () => {
    expect(formatManualContextBadge(1000000)).toContain("1M");
    expect(formatManualContextBadge(128000)).toContain("128K");
  });
});

describe("ProviderModelsSection fetch fallback (§3a)", () => {
  it("renders the Fetch All Models button", () => {
    const container = renderComponent(
      <ProviderModelsSection {...baseProps()} importProgress={null} />
    );
    expect(container.textContent).toContain("Fetch All Models");
  });

  it("renders the orange fallback alert on upstream fetch failure", () => {
    const onDismiss = vi.fn();
    const container = renderComponent(
      <ProviderModelsSection
        {...baseProps()}
        importProgress={{ phase: "error", error: "upstream 500" }}
        onDismissImportError={onDismiss}
      />
    );
    const alert = container.querySelector('[data-testid="fetch-models-fallback-alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain(
      "Failed to fetch models from API. Please add models manually."
    );
    expect(alert?.textContent).toContain("upstream 500");
  });

  it("hides the alert when the fetch did not fail", () => {
    const container = renderComponent(
      <ProviderModelsSection {...baseProps()} importProgress={{ phase: "done" }} />
    );
    expect(container.querySelector('[data-testid="fetch-models-fallback-alert"]')).toBeNull();
  });
});
