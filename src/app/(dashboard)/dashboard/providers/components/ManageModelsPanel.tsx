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
import { Card, ShimmerPageLoader } from "@/shared/components";
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

const SELECTED_CAPS_STORAGE_KEY = "cheaproute.modelSelectedCapabilities.v1";

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

  // ── Hydrate selected capability per model from localStorage ──────────────
  useEffect(() => {
    try {
      const raw = window.localStorage?.getItem(SELECTED_CAPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration, runs once
          setSelectedCapabilities(parsed);
        }
      }
    } catch {
      // Storage unavailable or invalid JSON
    }
  }, []);

  const handleSelectCapability = useCallback((key: string, capKey: string) => {
    setSelectedCapabilities((prev) => {
      const next = { ...prev, [key]: capKey };
      try {
        window.localStorage?.setItem(SELECTED_CAPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage quota / private mode
      }
      return next;
    });
  }, []);

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

  const handleToggleAll = useCallback(
    async (providerId: string, active: boolean) => {
      const models = modelsByProvider[providerId] ?? [];
      if (models.length === 0) return;
      const modelIds = models.map((m) => m.id);
      await postCuration({
        action: "setAllActive",
        providerId,
        modelIds,
        active,
      });
      void refresh();
    },
    [modelsByProvider, refresh]
  );

  const handleActivateWorking = useCallback(
    async (providerId: string) => {
      const models = modelsByProvider[providerId] ?? [];
      if (models.length === 0) return;
      const workingModelIds = models
        .filter((m) => {
          const key = `${providerId}::${m.id}`;
          const t = testResults[key];
          if (t && t.ok) return true;
          const cust = customizationByModel.get(key);
          return cust?.testStatus === "verified";
        })
        .map((m) => m.id);

      if (workingModelIds.length === 0) return;

      await postCuration({
        action: "setAllActive",
        providerId,
        modelIds: workingModelIds,
        active: true,
      });
      void refresh();
    },
    [modelsByProvider, testResults, customizationByModel, refresh]
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
        const isOk = data?.status === "ok";
        setTestResults((prev) => ({
          ...prev,
          [key]: {
            ok: isOk,
            httpStatus: data?.httpStatus,
            latencyMs: data?.latencyMs,
            preview: (data?.responsePreview ?? data?.error ?? "").slice(0, 500),
          },
        }));

        // 💡 Idea 2: Auto-activate model on successful test
        if (isOk) {
          await postCuration({
            action: "setActive",
            providerId,
            originalModelId: modelId,
            active: true,
          });
        }

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
                ...(Array.isArray(m.capabilities) ? { capabilities: m.capabilities } : {}),
                ...(typeof m.supportsVision === "boolean" ? { supportsVision: m.supportsVision } : {}),
                ...(typeof m.inputTokenLimit === "number" ? { inputTokenLimit: m.inputTokenLimit } : {}),
                ...(typeof m.outputTokenLimit === "number" ? { outputTokenLimit: m.outputTokenLimit } : {}),
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
    return <ShimmerPageLoader variant="table" />;
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/10">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Manage Models</h1>
              <p className="text-xs text-zinc-400">
                Configure active models, custom aliases, live capability verification, and billing tiers.
              </p>
            </div>
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
        <div className="p-6 rounded-2xl border border-white/10 bg-[#161618]/80 backdrop-blur-xl shadow-lg">
          <p className="text-xs text-zinc-400">
            No active connected providers found. Connect a provider first — its models will appear here for
            activation, aliasing, and testing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Top Header Bar with Cupertino Outline Trigger Button ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/10 shrink-0">
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white truncate">Manage Models</h1>
            <p className="text-xs text-zinc-400 truncate">
              Cupertino studio for active connected models, custom aliases & capability tests.
            </p>
          </div>
        </div>
        <div className="self-end sm:self-auto shrink-0">
          <DefaultCapabilitiesPromptModal
            testPrompt={testPrompt}
            onPromptChange={setTestPrompt}
            isOpen={showCapabilityPrompt}
            onToggle={() => setShowCapabilityPrompt((prev) => !prev)}
          />
        </div>
      </div>

      {/* ── Cupertino Inset Search & Modality Segmented Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-zinc-400">
            search
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models by id or name…"
            className="w-full h-8 rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-7 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all font-mono"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>

        {/* Capability Segmented Control Pills */}
        <div className="flex items-center gap-1 overflow-x-auto p-0.5 rounded-xl bg-black/40 border border-white/10 scrollbar-none shrink-0">
          {CAPABILITY_FILTER_BUTTONS.map((opt) => {
            const isActive = capabilityFilter === opt.key;
            const count = filterCounts[opt.key] ?? 0;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCapabilityFilter(opt.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-xs font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {opt.icon && (
                  <span className="material-symbols-outlined text-[13px] leading-none">
                    {opt.icon}
                  </span>
                )}
                <span>{opt.label}</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full font-mono bg-white/10 text-zinc-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Connected Provider Inset Group Cards ── */}
      <div className="space-y-2.5">
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
            (m) => customizationByModel.get(`${providerId}::${m.id}`)?.isActive === true
          ).length;
          const isOpen = expanded[providerId] !== false;

          return (
            <div
              key={providerId}
              className="rounded-2xl border border-white/10 bg-[#161618]/85 backdrop-blur-xl shadow-md overflow-hidden transition-all"
            >
              {/* Group Header */}
              <div className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-white/[0.03] transition-colors">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [providerId]: !isOpen }))}
                  className="flex items-center gap-2.5 text-left flex-1 cursor-pointer min-w-0"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] text-zinc-400 transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    chevron_right
                  </span>
                  <span className="font-semibold text-xs tracking-tight text-white truncate">
                    {providerId}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 shrink-0">
                    {activeCount}/{all.length} active
                  </span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleAll(providerId, true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                    title={`Select all models for ${providerId}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-emerald-400">done_all</span>
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleAll(providerId, false);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                    title={`Deselect all models for ${providerId}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-zinc-400">remove_done</span>
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleActivateWorking(providerId);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                    title={`Activate all models that passed tests for ${providerId}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-emerald-400">check_circle</span>
                    <span>Activate Working</span>
                  </button>
                  <button
                    type="button"
                    disabled={fetchingProviderId === providerId}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleFetchModelsForProvider(providerId);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 text-[11px] font-medium transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
                    title={`Fetch live models for ${providerId} from /v1/models`}
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${
                        fetchingProviderId === providerId ? "animate-spin" : ""
                      }`}
                    >
                      {fetchingProviderId === providerId ? "progress_activity" : "cloud_sync"}
                    </span>
                    <span>{fetchingProviderId === providerId ? "Syncing…" : "Fetch Models"}</span>
                  </button>
                </div>
              </div>

              {/* Provider Fetch Error Alert */}
              {fetchErrorByProvider[providerId] && (
                <div className="px-3.5 py-2 bg-red-950/40 border-y border-red-800/40 text-red-200 text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-red-300 text-[11px]">Sync Failed</span>
                    <span className="font-mono text-[10px] text-red-200/90 break-all">
                      {fetchErrorByProvider[providerId]}
                    </span>
                  </div>
                </div>
              )}

              {/* Models List */}
              {isOpen && (
                <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                  {models.length === 0 && (
                    <p className="px-4 py-3 text-xs text-zinc-400 font-mono">
                      {all.length === 0
                        ? "No synced models for this provider yet — click Fetch Models above."
                        : "No models match your search."}
                    </p>
                  )}
                  {models.map((m) => {
                    const key = `${providerId}::${m.id}`;
                    const cust = customizationByModel.get(key);
                    const isActive = cust ? cust.isActive === true : false;
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
                      <div key={m.id} className="px-3.5 py-2 space-y-1.5 hover:bg-white/[0.015] transition-colors">
                        {/* Compact Top Bar: Toggle, ID, Badges, Modality Pills, Test Button */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Cupertino iOS Switch for Active Status */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0" title={isActive ? "Active (downstream accessible)" : "Disabled"}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={(e) =>
                                void handleToggleActive(providerId, m.id, e.target.checked)
                              }
                              aria-label={`Activate ${m.id}`}
                              className="sr-only"
                            />
                            <div
                              className={`w-7.5 h-4.5 rounded-full transition-colors duration-200 ease-in-out p-0.5 flex items-center ${
                                isActive ? "bg-cyan-500 shadow-sm shadow-cyan-500/30" : "bg-white/20"
                              }`}
                            >
                              <div
                                className={`size-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
                                  isActive ? "translate-x-3" : "translate-x-0"
                                }`}
                              />
                            </div>
                          </label>

                          <span className="font-mono text-xs font-semibold text-white break-all select-all">
                            {m.id}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleCopy(m.id)}
                            title="Copy model ID"
                            aria-label={`Copy model ID ${m.id}`}
                            className="size-5 rounded hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedId === m.id ? "check" : "content_copy"}
                            </span>
                          </button>

                          {/* Cupertino FREE / PAID pill button */}
                          <button
                            type="button"
                            title="Toggle FREE/PAID tier override"
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
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all cursor-pointer active:scale-95 ${
                              isFree
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                            }`}
                          >
                            {isFree ? "FREE" : "PAID"}
                            {cust?.isFreeOverride != null && (
                              <span className="ml-1 opacity-70 normal-case text-[8px]">manual</span>
                            )}
                          </button>

                          {ctxLabel && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                              {ctxLabel} ctx
                            </span>
                          )}

                          {/* Cupertino Capability Selector Segmented Control */}
                          <div className="inline-flex items-center p-0.5 rounded-full bg-black/40 border border-white/10 gap-0.5">
                            {capsMeta.hasChat && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "text")}
                                title="Text capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "text"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  chat
                                </span>
                                {selectedCap === "text" && <span>text</span>}
                              </button>
                            )}
                            {capsMeta.hasCode && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "code")}
                                title="Code capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "code"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  code
                                </span>
                                {selectedCap === "code" && <span>code</span>}
                              </button>
                            )}
                            {capsMeta.hasVision && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "vision")}
                                title="Vision capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "vision"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  visibility
                                </span>
                                {selectedCap === "vision" && <span>vision</span>}
                              </button>
                            )}
                            {capsMeta.hasReasoning && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "reasoning")}
                                title="Reasoning capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "reasoning"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  psychology
                                </span>
                                {selectedCap === "reasoning" && <span>reason</span>}
                              </button>
                            )}
                            {capsMeta.hasSearch && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "search")}
                                title="Search capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "search"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  travel_explore
                                </span>
                                {selectedCap === "search" && <span>search</span>}
                              </button>
                            )}
                            {capsMeta.hasAudio && (
                              <button
                                type="button"
                                onClick={() => handleSelectCapability(key, "audio")}
                                title="Audio capability"
                                className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all inline-flex items-center gap-1 cursor-pointer ${
                                  selectedCap === "audio"
                                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 ring-1 ring-cyan-400/20 font-semibold"
                                    : "text-zinc-400 hover:text-white"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  volume_up
                                </span>
                                {selectedCap === "audio" && <span>audio</span>}
                              </button>
                            )}
                          </div>

                          <div className="flex-1" />

                          {/* Test Status Badge */}
                          {(test || cachedBadge) && (
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                (test ? test.ok : cust?.testStatus === "verified")
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/15 text-red-400 border-red-500/30"
                              }`}
                            >
                              {(test ? test.ok : cust?.testStatus === "verified")
                                ? "Verified"
                                : "Failed"}
                              {(test?.httpStatus ?? cust?.testHttpStatus) != null &&
                                ` · ${test?.httpStatus ?? cust?.testHttpStatus}`}
                            </span>
                          )}

                          {/* Cupertino Test Button */}
                          <button
                            type="button"
                            onClick={() => void handleTest(providerId, m.id)}
                            disabled={testingId === key}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 hover:bg-white/15 active:scale-95 text-white border border-white/15 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                            title={`Test model with ${selectedCap.toUpperCase()} prompt`}
                          >
                            <span
                              className={`material-symbols-outlined text-[13px] ${
                                testingId === key ? "animate-spin" : ""
                              }`}
                            >
                              {testingId === key ? "progress_activity" : "play_arrow"}
                            </span>
                            <span>{testingId === key ? `Testing…` : `Test (${selectedCap})`}</span>
                          </button>
                        </div>

                        {/* Test Response Preview */}
                        {(test?.preview || (cachedBadge && cust?.testResponse)) && (
                          <div className="p-2 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono text-zinc-300 break-words leading-relaxed">
                            <span>{(test?.preview ?? cust?.testResponse ?? "").slice(0, 500)}</span>
                            {(test?.latencyMs ?? cust?.testLatencyMs) != null && (
                              <span className="text-zinc-500 font-sans ml-2 text-[10px]">
                                · {test?.latencyMs ?? cust?.testLatencyMs}ms
                              </span>
                            )}
                          </div>
                        )}

                        {/* Cupertino Inset Manageable Alias Fields with Minimal Gaps */}
                        {isActive && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/[0.04]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 shrink-0">
                                Display:
                              </span>
                              <input
                                value={draft.name}
                                onChange={(e) =>
                                  setAliasDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, name: e.target.value },
                                  }))
                                }
                                placeholder={m.name || m.id}
                                className="flex-1 h-6.5 px-2 py-0.5 text-[11px] bg-black/40 border border-white/10 rounded-md text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                              />
                            </div>

                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 shrink-0">
                                Alias ID:
                              </span>
                              <input
                                value={draft.alias}
                                onChange={(e) =>
                                  setAliasDrafts((prev) => ({
                                    ...prev,
                                    [key]: { ...draft, alias: e.target.value },
                                  }))
                                }
                                placeholder={m.id}
                                className="flex-1 h-6.5 px-2 py-0.5 text-[11px] bg-black/40 border border-white/10 rounded-md text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveAlias(providerId, m.id)}
                                disabled={savingAlias === key}
                                className="h-6.5 px-2.5 rounded-md text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-400/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                              >
                                {savingAlias === key ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
