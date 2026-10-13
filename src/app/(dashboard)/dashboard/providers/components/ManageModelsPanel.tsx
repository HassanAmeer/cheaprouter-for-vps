"use client";

/**
 * ManageModelsPanel — Providers page Tab 4 "Manage Models" (reseller spec §6b–6e).
 *
 * Model studio scoped to CONNECTED providers only: collapsible provider
 * groups, per-model Active checkbox (only checked models flow downstream to
 * combos / API keys), one-click Model ID copy, FREE/PAID badge with manual
 * override, capability badges (context window + modalities), per-model live
 * Test with inline Verified/Failed preview, and custom alias fields
 * (display name + API call alias) persisted to
 * `provider_model_customizations` via `/api/v1/models/curation`.
 *
 * Aliases integrate with routing through the shared `modelAliases` namespace
 * (see providerModelCustomizations.ts::syncAlias) — a client-sent custom
 * alias resolves back to the original upstream model id at dispatch time.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/shared/components";
import { isCatalogFreeModel } from "@/shared/utils/freeModels";
import { matchesSearch } from "@/shared/utils/turkishText";

interface SyncedModel {
  id: string;
  name?: string;
  contextWindow?: number;
  inputTokenLimit?: number;
  supportedEndpoints?: string[];
  supportsThinking?: boolean;
  alwaysThinking?: boolean;
  supportsTools?: boolean;
  supportsVideo?: boolean;
  supportsVision?: boolean;
  isFree?: boolean;
}

interface Customization {
  providerId: string;
  originalModelId: string;
  customName: string | null;
  customAlias: string | null;
  isActive: boolean;
  isTested: boolean;
  testStatus: "verified" | "failed" | null;
  testHttpStatus: number | null;
  testLatencyMs: number | null;
  testResponse: string | null;
  contextWindow: number | null;
  capabilities: string[] | null;
  isFreeOverride?: boolean | null;
}

interface LiveTestResult {
  ok: boolean;
  httpStatus?: number;
  latencyMs?: number;
  preview?: string;
}

function formatContextWindow(tokens: number | null | undefined): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

function deriveCapabilities(model: SyncedModel): string[] {
  const caps: string[] = [];
  const endpoints = new Set(model.supportedEndpoints ?? []);
  if (model.supportsThinking || model.alwaysThinking) caps.push("Reasoning");
  if (model.supportsVision) caps.push("Vision");
  if (model.supportsTools) caps.push("Tools");
  if (endpoints.has("audio-transcriptions")) caps.push("STT");
  if (endpoints.has("audio-speech")) caps.push("TTS");
  if (
    !endpoints.has("audio-transcriptions") &&
    !endpoints.has("audio-speech") &&
    [...endpoints].some((e) => e.startsWith("audio"))
  ) {
    caps.push("Audio");
  }
  if (model.supportsVideo) caps.push("Video");
  if (/code|coder|codex|devstral/i.test(model.id)) caps.push("Code");
  return caps;
}

async function fetchCurationPayload(): Promise<{
  providerIds: string[];
  modelsByProvider: Record<string, SyncedModel[]>;
  customizations: Customization[];
}> {
  const res = await fetch("/api/v1/models/curation");
  if (!res.ok) throw new Error(`Curation API returned ${res.status}`);
  const data = await res.json();
  return {
    providerIds: Array.isArray(data?.connectedProviderIds) ? data.connectedProviderIds : [],
    modelsByProvider: data?.modelsByProvider ?? {},
    customizations: Array.isArray(data?.customizations) ? data.customizations : [],
  };
}

async function postCuration(payload: Record<string, unknown>): Promise<Customization | null> {
  const res = await fetch("/api/v1/models/curation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.customization as Customization) ?? null;
}

export default function ManageModelsPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, SyncedModel[]>>({});
  const [customizations, setCustomizations] = useState<Customization[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, LiveTestResult>>({});
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, { name: string; alias: string }>>(
    {}
  );
  const [savingAlias, setSavingAlias] = useState<string | null>(null);

  const applyPayload = useCallback(
    (payload: {
      providerIds: string[];
      modelsByProvider: Record<string, SyncedModel[]>;
      customizations: Customization[];
    }) => {
      setProviderIds(payload.providerIds);
      setModelsByProvider(payload.modelsByProvider);
      setCustomizations(payload.customizations);
      setExpanded((prev) => {
        const next: Record<string, boolean> = { ...prev };
        payload.providerIds.forEach((id, i) => {
          if (!(id in next)) next[id] = i === 0;
        });
        return next;
      });
    },
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchCurationPayload();
      applyPayload(payload);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load model curation");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  // Initial load: async work runs after the await inside the effect, so no
  // setState fires synchronously in the effect body (react-hooks rule).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const payload = await fetchCurationPayload();
        if (cancelled) return;
        applyPayload(payload);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load model curation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  const customizationByModel = useMemo(() => {
    const map = new Map<string, Customization>();
    for (const c of customizations) map.set(`${c.providerId}::${c.originalModelId}`, c);
    return map;
  }, [customizations]);

  const patchCustomization = useCallback((row: Customization) => {
    setCustomizations((prev) => {
      const key = `${row.providerId}::${row.originalModelId}`;
      const idx = prev.findIndex((c) => `${c.providerId}::${c.originalModelId}` === key);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(
    async (providerId: string, modelId: string, active: boolean) => {
      const row = await postCuration({
        action: "setActive",
        providerId,
        originalModelId: modelId,
        active,
      });
      if (row) patchCustomization(row);
      else void refresh();
    },
    [patchCustomization, refresh]
  );

  const handleCopy = useCallback((modelId: string) => {
    const done = () => {
      setCopiedId(modelId);
      window.setTimeout(() => setCopiedId((cur) => (cur === modelId ? null : cur)), 1500);
    };
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(modelId).then(done, done);
    } else {
      done();
    }
  }, []);

  const handleTest = useCallback(
    async (providerId: string, modelId: string) => {
      const key = `${providerId}::${modelId}`;
      setTestingId(key);
      try {
        const res = await fetch("/api/v1/models/curation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "liveTest", providerId, modelId }),
        });
        const data = await res.json().catch(() => null);
        setTestResults((prev) => ({
          ...prev,
          [key]: {
            ok: data?.status === "ok",
            httpStatus: data?.httpStatus,
            latencyMs: data?.latencyMs,
            preview: (data?.responsePreview ?? data?.error ?? "").slice(0, 500),
          },
        }));
        // The API persists the result onto the curation row — refresh badges.
        void refresh();
      } catch {
        setTestResults((prev) => ({
          ...prev,
          [key]: { ok: false, preview: "Test request failed" },
        }));
      } finally {
        setTestingId(null);
      }
    },
    [refresh]
  );

  const handleSaveAlias = useCallback(
    async (providerId: string, modelId: string) => {
      const key = `${providerId}::${modelId}`;
      const draft = aliasDrafts[key] ?? { name: "", alias: "" };
      setSavingAlias(key);
      try {
        const row = await postCuration({
          action: "save",
          providerId,
          originalModelId: modelId,
          customName: draft.name.trim() || null,
          customAlias: draft.alias.trim() || null,
        });
        if (row) patchCustomization(row);
      } finally {
        setSavingAlias(null);
      }
    },
    [aliasDrafts, patchCustomization]
  );

  const handleFreeOverride = useCallback(
    async (providerId: string, modelId: string, value: boolean | null) => {
      const row = await postCuration({
        action: "save",
        providerId,
        originalModelId: modelId,
        isFreeOverride: value,
      });
      if (row) patchCustomization(row);
      else void refresh();
    },
    [patchCustomization, refresh]
  );

  // Turkish-safe search via matchesSearch (empty query matches all).

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-text-muted">Loading connected-provider models…</p>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="p-6">
        <div
          role="alert"
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-400/40 bg-red-500/10 text-sm"
        >
          <span className="material-symbols-outlined text-[18px] text-red-500">error</span>
          <div className="flex-1">
            <p className="font-medium text-red-600 dark:text-red-300">
              Failed to load Manage Models: {loadError}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 text-xs font-medium text-text-main underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (providerIds.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-text-muted">
          No connected providers yet. Connect a provider first — its models will appear here for
          activation, aliasing, and testing.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted">
            search
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models by id or name…"
            className="w-full rounded-lg border border-border bg-bg-subtle pl-10 pr-3 py-2 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
        <p className="text-xs text-text-muted">
          Only checked models are active downstream (combos, API keys, /v1/models execution).
        </p>
      </div>

      {providerIds.map((providerId) => {
        const all = modelsByProvider[providerId] ?? [];
        const models = all.filter(
          (m) => matchesSearch(m.id, filter) || matchesSearch(m.name, filter)
        );
        const activeCount = all.filter(
          (m) => customizationByModel.get(`${providerId}::${m.id}`)?.isActive !== false
        ).length;
        const isOpen = expanded[providerId] !== false;
        return (
          <Card key={providerId} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [providerId]: !isOpen }))}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-subtle/60 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[20px] text-text-muted transition-transform">
                {isOpen ? "expand_less" : "expand_more"}
              </span>
              <span className="font-semibold text-text-main">{providerId}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-subtle border border-border text-text-muted">
                {activeCount}/{all.length} active
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border/60">
                {models.length === 0 && (
                  <p className="px-4 py-4 text-sm text-text-muted">
                    {all.length === 0
                      ? "No synced models for this provider yet — open the provider page and use Fetch All Models."
                      : "No models match the filter."}
                  </p>
                )}
                {models.map((m) => {
                  const key = `${providerId}::${m.id}`;
                  const cust = customizationByModel.get(key);
                  const isActive = cust?.isActive !== false;
                  const draft = aliasDrafts[key] ?? {
                    name: cust?.customName ?? "",
                    alias: cust?.customAlias ?? "",
                  };
                  const ctxTokens = cust?.contextWindow ?? m.contextWindow ?? m.inputTokenLimit;
                  const ctxLabel = formatContextWindow(ctxTokens ?? null);
                  const caps = cust?.capabilities ?? deriveCapabilities(m);
                  const autoFree = m.isFree === true || isCatalogFreeModel(providerId, m.id);
                  const isFree =
                    cust?.isFreeOverride === true
                      ? true
                      : cust?.isFreeOverride === false
                        ? false
                        : autoFree;
                  const test = testResults[key];
                  const cachedBadge = !test && cust?.isTested && cust.testStatus;
                  return (
                    <div key={m.id} className="px-4 py-3 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) =>
                            void handleToggleActive(providerId, m.id, e.target.checked)
                          }
                          aria-label={`Activate ${m.id}`}
                          className="size-4 accent-current"
                        />
                        <span className="font-mono text-sm text-text-main break-all">{m.id}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id)}
                          title="Copy model ID"
                          aria-label={`Copy model ID ${m.id}`}
                          className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-bg-subtle transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {copiedId === m.id ? "check" : "content_copy"}
                          </span>
                        </button>
                        <button
                          type="button"
                          title="Toggle FREE/PAID override (auto → FREE → PAID)"
                          onClick={() =>
                            void handleFreeOverride(
                              providerId,
                              m.id,
                              cust?.isFreeOverride == null
                                ? true
                                : cust.isFreeOverride === true
                                  ? false
                                  : null
                            )
                          }
                          className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            isFree
                              ? "bg-emerald-500/15 text-emerald-500"
                              : "bg-amber-500/15 text-amber-500"
                          }`}
                        >
                          {isFree ? "FREE" : "PAID"}
                          {cust?.isFreeOverride != null && (
                            <span className="ml-1 opacity-70 normal-case">manual</span>
                          )}
                        </button>
                        {ctxLabel && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-text-muted">
                            {ctxLabel} ctx
                          </span>
                        )}
                        {caps.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-text-muted"
                          >
                            {c}
                          </span>
                        ))}
                        <span className="flex-1" />
                        {(test || cachedBadge) && (
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              (test ? test.ok : cust?.testStatus === "verified")
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-red-500/15 text-red-500"
                            }`}
                          >
                            {(test ? test.ok : cust?.testStatus === "verified")
                              ? "Verified"
                              : "Failed"}
                            {(test?.httpStatus ?? cust?.testHttpStatus) != null &&
                              ` · ${test?.httpStatus ?? cust?.testHttpStatus}`}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleTest(providerId, m.id)}
                          disabled={testingId === key}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-main hover:border-primary/40 transition-colors disabled:opacity-50"
                        >
                          <span
                            className={`material-symbols-outlined text-[14px]${testingId === key ? " animate-spin" : ""}`}
                          >
                            play_arrow
                          </span>
                          {testingId === key ? "Testing…" : "Test"}
                        </button>
                      </div>

                      {(test?.preview || (cachedBadge && cust?.testResponse)) && (
                        <p className="text-xs text-text-muted bg-bg-subtle/70 border border-border/60 rounded-lg px-3 py-2 break-words whitespace-pre-wrap">
                          {(test?.preview ?? cust?.testResponse ?? "").slice(0, 500)}
                          {(test?.latencyMs ?? cust?.testLatencyMs) != null &&
                            ` — ${test?.latencyMs ?? cust?.testLatencyMs}ms`}
                        </p>
                      )}

                      {isActive && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          <label className="flex flex-col gap-1 text-xs text-text-muted">
                            <span>
                              Original name:{" "}
                              <span className="text-text-main font-mono">{m.name || m.id}</span>
                            </span>
                            <input
                              value={draft.name}
                              onChange={(e) =>
                                setAliasDrafts((prev) => ({
                                  ...prev,
                                  [key]: { ...draft, name: e.target.value },
                                }))
                              }
                              placeholder="Custom display name (blank = original)"
                              className="rounded-lg border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-text-muted">
                            <span>
                              Original API id:{" "}
                              <span className="text-text-main font-mono">{m.id}</span>
                            </span>
                            <span className="flex gap-2">
                              <input
                                value={draft.alias}
                                onChange={(e) =>
                                  setAliasDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, alias: e.target.value },
                                  }))
                                }
                                placeholder="Custom API call id / alias"
                                className="flex-1 rounded-lg border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveAlias(providerId, m.id)}
                                disabled={savingAlias === key}
                                className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-main hover:border-primary/40 transition-colors disabled:opacity-50"
                              >
                                {savingAlias === key ? "Saving…" : "Save"}
                              </button>
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
