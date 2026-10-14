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
import DefaultCapabilitiesPromptModal, {
  getPromptForCapability,
} from "./DefaultCapabilitiesPromptModal";

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

export interface SyncedModelCapabilities {
  hasReasoning: boolean;
  hasVision: boolean;
  hasCode: boolean;
  hasSearch: boolean;
  hasAudio: boolean;
  hasChat: boolean;
}

export function getSyncedModelCapabilities(
  model: SyncedModel,
  cust?: Customization
): SyncedModelCapabilities {
  const mid = (model.id || "").toLowerCase();
  const caps = (cust?.capabilities ?? deriveCapabilities(model)).map((c) => c.toLowerCase());
  const endpoints = new Set((model.supportedEndpoints ?? []).map((e) => e.toLowerCase()));

  const hasReasoning =
    Boolean(model.supportsThinking) ||
    Boolean(model.alwaysThinking) ||
    caps.includes("reasoning") ||
    caps.includes("thinking") ||
    caps.includes("logic") ||
    mid.includes("think") ||
    mid.includes("reason") ||
    mid.includes("r1") ||
    mid.includes("o1") ||
    mid.includes("o3");

  const hasVision =
    Boolean(model.supportsVision) ||
    caps.includes("vision") ||
    caps.includes("image") ||
    caps.includes("multimodal") ||
    endpoints.has("images") ||
    mid.includes("vision") ||
    mid.includes("vl");

  const hasCode =
    caps.includes("code") ||
    caps.includes("coding") ||
    /code|coder|codex|devstral/i.test(model.id);

  const hasSearch =
    caps.includes("search") ||
    caps.includes("web_search") ||
    caps.includes("browsing") ||
    endpoints.has("search") ||
    mid.includes("search");

  const hasAudio =
    caps.includes("audio") ||
    caps.includes("stt") ||
    caps.includes("tts") ||
    endpoints.has("audio-transcriptions") ||
    endpoints.has("audio-speech") ||
    [...endpoints].some((e) => e.startsWith("audio")) ||
    mid.includes("audio") ||
    mid.includes("whisper");

  const hasChat =
    caps.includes("chat") ||
    caps.includes("text") ||
    endpoints.has("chat") ||
    (!mid.includes("embed") && !mid.includes("rerank") && !mid.includes("whisper"));

  return { hasReasoning, hasVision, hasCode, hasSearch, hasAudio, hasChat };
}

export const CAPABILITY_FILTER_BUTTONS = [
  { key: "all", label: "All", icon: "select_all" },
  { key: "text", label: "Text", icon: "chat" },
  { key: "code", label: "Code", icon: "code" },
  { key: "vision", label: "Vision", icon: "visibility" },
  { key: "reasoning", label: "Reasoning", icon: "psychology" },
  { key: "search", label: "Search", icon: "travel_explore" },
  { key: "audio", label: "Audio", icon: "volume_up" },
] as const;

function matchesSyncedModelFilter(
  model: SyncedModel,
  filter: string,
  cust?: Customization
): boolean {
  if (filter === "all") return true;
  const caps = getSyncedModelCapabilities(model, cust);
  if (filter === "text") return caps.hasChat;
  if (filter === "code") return caps.hasCode;
  if (filter === "vision") return caps.hasVision;
  if (filter === "reasoning") return caps.hasReasoning;
  if (filter === "search") return caps.hasSearch;
  if (filter === "audio") return caps.hasAudio;
  return true;
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
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [selectedCapabilities, setSelectedCapabilities] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, LiveTestResult>>({});
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, { name: string; alias: string }>>(
    {}
  );
  const [savingAlias, setSavingAlias] = useState<string | null>(null);

  // ── Global Test Prompt State (Modal in Header) ───────────────────────────
  const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Hi");
  const [fetchingProviderId, setFetchingProviderId] = useState<string | null>(null);
  const [fetchErrorByProvider, setFetchErrorByProvider] = useState<Record<string, string>>({});

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

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      text: 0,
      code: 0,
      vision: 0,
      reasoning: 0,
      search: 0,
      audio: 0,
    };
    for (const pId of providerIds) {
      const pModels = modelsByProvider[pId] ?? [];
      for (const m of pModels) {
        counts.all++;
        const cust = customizationByModel.get(`${pId}::${m.id}`);
        const c = getSyncedModelCapabilities(m, cust);
        if (c.hasChat) counts.text++;
        if (c.hasCode) counts.code++;
        if (c.hasVision) counts.vision++;
        if (c.hasReasoning) counts.reasoning++;
        if (c.hasSearch) counts.search++;
        if (c.hasAudio) counts.audio++;
      }
    }
    return counts;
  }, [providerIds, modelsByProvider, customizationByModel]);

  const patchCustomization = useCallback((row: Customization) => {
    setCustomizations((prev) => {
      const key = `${row.providerId}::${row.originalModelId}`;
      const idx = prev.findIndex((c) => `${c.providerId}::${row.originalModelId}` === key);
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
      const selectedCap = selectedCapabilities[key] || "text";
      const promptToRun = getPromptForCapability(selectedCap, testPrompt);
      setTestingId(key);
      try {
        const res = await fetch("/api/v1/models/curation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "liveTest",
            providerId,
            modelId,
            prompt: promptToRun,
          }),
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
    [refresh, testPrompt, selectedCapabilities]
  );

  const handleFetchModelsForProvider = useCallback(
    async (pId: string) => {
      setFetchingProviderId(pId);
      setFetchErrorByProvider((prev) => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      try {
        const res = await fetch(`/api/providers/${encodeURIComponent(pId)}/models?refresh=true`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP ${res.status}: Failed to fetch models from API`
          );
        }
        const data = await res.json().catch(() => ({}));
        const fetchedModels = Array.isArray(data?.models) ? data.models : [];
        if (fetchedModels.length > 0) {
          await fetch("/api/provider-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: pId,
              models: fetchedModels.map((m: any) => ({
                id: m.id || m.model || m.name,
                name: m.name || m.id,
                source: "imported",
                apiFormat: m.apiFormat || "chat-completions",
                supportedEndpoints: Array.isArray(m.supportedEndpoints)
                  ? m.supportedEndpoints
                  : ["chat"],
              })),
            }),
          });
        }
        await refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to fetch models from API";
        setFetchErrorByProvider((prev) => ({ ...prev, [pId]: msg }));
      } finally {
        setFetchingProviderId(null);
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
      {/* ── Top Header Bar with Capabilities Test Suite Trigger ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h2 className="text-base font-semibold text-text-main">Manage Models Studio</h2>
          <p className="text-xs text-text-muted">
            Configure active models, custom aliases, live capability verification, and billing
            tiers.
          </p>
        </div>
        <div className="self-end sm:self-auto">
          <DefaultCapabilitiesPromptModal
            testPrompt={testPrompt}
            onPromptChange={setTestPrompt}
            isOpen={showCapabilityPrompt}
            onToggle={() => setShowCapabilityPrompt((prev) => !prev)}
          />
        </div>
      </div>

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

      {/* Capability Filter Buttons Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1 scrollbar-none">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mr-1 shrink-0">
          Filter:
        </span>
        {CAPABILITY_FILTER_BUTTONS.map((opt) => {
          const isActive = capabilityFilter === opt.key;
          const count = filterCounts[opt.key] ?? 0;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setCapabilityFilter(opt.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-text-main text-bg font-semibold shadow-xs"
                  : "bg-bg-subtle text-text-muted hover:text-text-main hover:bg-bg border border-border"
              }`}
            >
              {opt.icon && (
                <span className="material-symbols-outlined text-[14px] leading-none">
                  {opt.icon}
                </span>
              )}
              <span>{opt.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive
                    ? "bg-bg/20 text-bg font-bold"
                    : "bg-bg border border-border text-text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {providerIds.map((providerId) => {
        const all = modelsByProvider[providerId] ?? [];
        const models = all.filter((m) => {
          const cust = customizationByModel.get(`${providerId}::${m.id}`);
          if (
            capabilityFilter !== "all" &&
            !matchesSyncedModelFilter(m, capabilityFilter, cust)
          ) {
            return false;
          }
          return (
            matchesSearch(m.id, filter) || (Boolean(m.name) && matchesSearch(m.name!, filter))
          );
        });
        const activeCount = all.filter(
          (m) => customizationByModel.get(`${providerId}::${m.id}`)?.isActive !== false
        ).length;
        const isOpen = expanded[providerId] !== false;
        return (
          <Card key={providerId} className="p-0 overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-subtle/60 transition-colors">
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [providerId]: !isOpen }))}
                className="flex items-center gap-3 text-left flex-1"
              >
                <span className="material-symbols-outlined text-[20px] text-text-muted transition-transform">
                  {isOpen ? "expand_less" : "expand_more"}
                </span>
                <span className="font-semibold text-text-main">{providerId}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-bg-subtle border border-border text-text-muted">
                  {activeCount}/{all.length} active
                </span>
              </button>

              <button
                type="button"
                disabled={fetchingProviderId === providerId}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleFetchModelsForProvider(providerId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-bg-subtle hover:bg-bg hover:border-primary/40 text-text-main text-xs font-medium transition disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
                title={`Fetch live models for ${providerId} from /v1/models`}
              >
                <span
                  className={`material-symbols-outlined text-[15px] ${
                    fetchingProviderId === providerId ? "animate-spin" : ""
                  }`}
                >
                  {fetchingProviderId === providerId ? "progress_activity" : "cloud_sync"}
                </span>
                <span>
                  {fetchingProviderId === providerId ? "Fetching..." : "Fetch All Models"}
                </span>
              </button>
            </div>

            {/* Provider Fetch Error Alert */}
            {fetchErrorByProvider[providerId] && (
              <div className="px-4 py-2.5 bg-red-950/30 border-y border-red-800/40 text-red-200 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-red-400 text-[17px] flex-shrink-0 mt-0.5">
                  error
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-red-300">Model Discovery Failed</span>
                  <span className="font-mono text-[11px] text-red-200/90 break-all">
                    {fetchErrorByProvider[providerId]}
                  </span>
                </div>
              </div>
            )}

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
                  const capsMeta = getSyncedModelCapabilities(m, cust);
                  const selectedCap = selectedCapabilities[key] || "text";
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

                        {/* Interactive Capability Selection for Testing */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {capsMeta.hasChat && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({ ...prev, [key]: "text" }))
                              }
                              title={`Text: Dialogue & instruction prompt (${
                                selectedCap === "text"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "text"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                chat
                              </span>
                              {selectedCap === "text" && (
                                <span className="uppercase text-[9px] font-semibold">text</span>
                              )}
                            </button>
                          )}
                          {capsMeta.hasCode && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({ ...prev, [key]: "code" }))
                              }
                              title={`Code: Programming & syntax prompt (${
                                selectedCap === "code"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "code"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                code
                              </span>
                              {selectedCap === "code" && (
                                <span className="uppercase text-[9px] font-semibold">code</span>
                              )}
                            </button>
                          )}
                          {capsMeta.hasVision && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({ ...prev, [key]: "vision" }))
                              }
                              title={`Vision: Multimodal image analysis prompt (${
                                selectedCap === "vision"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "vision"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                visibility
                              </span>
                              {selectedCap === "vision" && (
                                <span className="uppercase text-[9px] font-semibold">vision</span>
                              )}
                            </button>
                          )}
                          {capsMeta.hasReasoning && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({
                                  ...prev,
                                  [key]: "reasoning",
                                }))
                              }
                              title={`Reasoning: Chain-of-thought prompt (${
                                selectedCap === "reasoning"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "reasoning"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                psychology
                              </span>
                              {selectedCap === "reasoning" && (
                                <span className="uppercase text-[9px] font-semibold">reason</span>
                              )}
                            </button>
                          )}
                          {capsMeta.hasSearch && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({
                                  ...prev,
                                  [key]: "search",
                                }))
                              }
                              title={`Search: Grounded web search prompt (${
                                selectedCap === "search"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "search"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                travel_explore
                              </span>
                              {selectedCap === "search" && (
                                <span className="uppercase text-[9px] font-semibold">search</span>
                              )}
                            </button>
                          )}
                          {capsMeta.hasAudio && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCapabilities((prev) => ({ ...prev, [key]: "audio" }))
                              }
                              title={`Audio: Speech transcription prompt (${
                                selectedCap === "audio"
                                  ? "Active for test"
                                  : "Click to select for test"
                              })`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                selectedCap === "audio"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 ring-1 ring-emerald-500/30 font-semibold scale-105"
                                  : "bg-bg-subtle border border-border text-text-muted hover:text-text-main"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">
                                volume_up
                              </span>
                              {selectedCap === "audio" && (
                                <span className="uppercase text-[9px] font-semibold">audio</span>
                              )}
                            </button>
                          )}
                        </div>
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
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-main hover:border-primary/40 transition-colors disabled:opacity-50 cursor-pointer"
                          title={`Test model with ${selectedCap.toUpperCase()} capability prompt`}
                        >
                          <span
                            className={`material-symbols-outlined text-[14px]${
                              testingId === key ? " animate-spin" : ""
                            }`}
                          >
                            {testingId === key ? "progress_activity" : "play_arrow"}
                          </span>
                          {testingId === key ? `Testing (${selectedCap})…` : `Test (${selectedCap})`}
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
