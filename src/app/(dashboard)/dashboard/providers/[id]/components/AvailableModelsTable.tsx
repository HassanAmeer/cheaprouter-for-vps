"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { matchesSearch } from "@/shared/utils/turkishText";
import { getPromptForCapability } from "@/app/(dashboard)/dashboard/providers/components/DefaultCapabilitiesPromptModal";
import { isFreeModel } from "@/shared/utils/freeModels";

export interface ModelEntry {
  id: string;
  name?: string;
  source?: string;
  isHidden?: boolean;
  isFree?: boolean;
  contextWindowOverride?: number;
  max_input_tokens?: number;
  inputTokenLimit?: number;
  capabilities?: string[];
  supportedEndpoints?: string[];
  supportsVision?: boolean;
  supportsThinking?: boolean;
  alwaysThinking?: boolean;
  reasoning?: boolean;
  [key: string]: unknown;
}

export interface AvailableModelsTableProps {
  providerId: string;
  providerDisplayAlias: string;
  models: ModelEntry[];
  testPrompt: string;
  onRefreshModels: () => Promise<void> | void;
  copied: string | null;
  onCopy: (text: string) => void;
  onFetchModels?: () => Promise<void> | void;
  isFetchingModels?: boolean;
  fetchError?: string | null;
  connectionId?: string;
}

export function formatContextWindow(tokens?: number): string {
  if (!tokens || tokens <= 0) return "—";
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(0)}K`;
  }
  return String(tokens);
}

export function getModelCapabilities(model: ModelEntry) {
  const mid = (model.id || "").toLowerCase();
  const capsLower = (model.capabilities ?? []).map((c) => String(c).toLowerCase());
  const endpoints = (model.supportedEndpoints ?? []).map((e) => String(e).toLowerCase());

  const hasReasoning =
    capsLower.includes("reasoning") ||
    capsLower.includes("thinking") ||
    mid.includes("think") ||
    mid.includes("reason") ||
    mid.includes("r1") ||
    mid.includes("o1") ||
    mid.includes("o3") ||
    model.reasoning === true ||
    Boolean(model.supportsThinking) ||
    Boolean(model.alwaysThinking);

  const hasVision =
    capsLower.includes("vision") ||
    capsLower.includes("image") ||
    model.supportsVision === true ||
    endpoints.includes("images") ||
    mid.includes("vision") ||
    mid.includes("vl");

  const hasCode =
    capsLower.includes("code") ||
    capsLower.includes("coding") ||
    mid.includes("code") ||
    mid.includes("coder") ||
    mid.includes("codex") ||
    mid.includes("devstral");

  const hasSearch =
    capsLower.includes("search") ||
    capsLower.includes("web_search") ||
    capsLower.includes("browsing") ||
    endpoints.includes("search") ||
    mid.includes("search");

  const hasAudio =
    capsLower.includes("audio") ||
    capsLower.includes("stt") ||
    capsLower.includes("tts") ||
    endpoints.includes("audio-speech") ||
    endpoints.includes("audio-transcriptions") ||
    endpoints.some((e) => e.startsWith("audio")) ||
    mid.includes("audio") ||
    mid.includes("whisper");

  const hasTools =
    capsLower.includes("tools") ||
    capsLower.includes("tool_use") ||
    endpoints.includes("tools") ||
    (!mid.includes("embed") && !mid.includes("rerank"));

  const hasChat =
    capsLower.includes("chat") ||
    capsLower.includes("text") ||
    endpoints.includes("chat") ||
    (!mid.includes("embed") && !mid.includes("rerank") && !mid.includes("whisper"));

  return { hasReasoning, hasVision, hasCode, hasSearch, hasAudio, hasTools, hasChat };
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

function matchesCapabilityFilter(model: ModelEntry, filter: string): boolean {
  if (filter === "all") return true;
  const caps = getModelCapabilities(model);
  if (filter === "text") return caps.hasChat;
  if (filter === "code") return caps.hasCode;
  if (filter === "vision") return caps.hasVision;
  if (filter === "reasoning") return caps.hasReasoning;
  if (filter === "search") return caps.hasSearch;
  if (filter === "audio") return caps.hasAudio;
  return true;
}

const SELECTED_CAPS_STORAGE_KEY = "cheaproute.modelSelectedCapabilities.v1";

export default function AvailableModelsTable({
  providerId,
  providerDisplayAlias: _providerDisplayAlias,
  models,
  testPrompt,
  onRefreshModels,
  copied,
  onCopy,
  onFetchModels,
  isFetchingModels = false,
  fetchError = null,
  connectionId,
}: AvailableModelsTableProps) {
  const notify = useNotificationStore();
  const [search, setSearch] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");
  const [selectedCapabilities, setSelectedCapabilities] = useState<Record<string, string>>({});
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<
      string,
      {
        status: "ok" | "error";
        latencyMs?: number;
        snippet?: string;
        error?: string;
      }
    >
  >({});

  // ── 1. Hydrate selected capability per model from localStorage ───────────
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

  const handleSelectCapability = useCallback((modelId: string, capKey: string) => {
    setSelectedCapabilities((prev) => {
      const next = { ...prev, [modelId]: capKey };
      try {
        window.localStorage?.setItem(SELECTED_CAPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage quota / private mode
      }
      return next;
    });
  }, []);

  // ── 2. Hydrate persisted test results from SQLite curation table ──────────
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/v1/models/curation?providerId=${encodeURIComponent(providerId)}`
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const custs = Array.isArray(data?.customizations) ? data.customizations : [];
        if (custs.length > 0) {
          setTestResults((prev) => {
            const next = { ...prev };
            for (const c of custs) {
              if (c.originalModelId && c.isTested) {
                next[c.originalModelId] = {
                  status: c.testStatus === "verified" ? "ok" : "error",
                  latencyMs: typeof c.testLatencyMs === "number" ? c.testLatencyMs : undefined,
                  snippet: c.testStatus === "verified" ? (c.testResponse ?? "OK (200)") : undefined,
                  error: c.testStatus === "failed" ? (c.testResponse ?? "Model test failed") : undefined,
                };
              }
            }
            return next;
          });
        }
      } catch {
        // Best-effort
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const handleToggleActive = async (modelId: string, currentHidden: boolean) => {
    try {
      const res = await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerId)}&modelId=${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHidden: !currentHidden }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle model active status");
      notify.success(
        !currentHidden ? `Deactivated model "${modelId}"` : `Activated model "${modelId}"`
      );
      await onRefreshModels();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const handleToggleFree = async (modelId: string, currentFree: boolean) => {
    try {
      const res = await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerId)}&modelId=${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFree: !currentFree }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle model billing tier");
      notify.success(
        !currentFree ? `Model "${modelId}" marked as FREE` : `Model "${modelId}" marked as PAID`
      );
      await onRefreshModels();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to toggle billing tier");
    }
  };

  const handleRunTest = async (modelId: string) => {
    const selectedCap = selectedCapabilities[modelId] || "text";
    const promptToRun = getPromptForCapability(selectedCap, testPrompt);
    setTestingModelId(modelId);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          modelId,
          ...(connectionId ? { connectionId } : {}),
          prompt: promptToRun,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setTestResults((prev) => ({
          ...prev,
          [modelId]: {
            status: "ok",
            latencyMs: data.latencyMs,
            snippet: data.responseText || "OK (200)",
          },
        }));
        notify.success(
          `Model "${modelId}" (${selectedCap.toUpperCase()}) test succeeded (${data.latencyMs}ms)`
        );
      } else {
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || "Model test failed";
        setTestResults((prev) => ({
          ...prev,
          [modelId]: {
            status: "error",
            error: errorMsg,
          },
        }));
        notify.error(`Test failed for "${modelId}": ${errorMsg}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error testing model";
      setTestResults((prev) => ({
        ...prev,
        [modelId]: {
          status: "error",
          error: errorMsg,
        },
      }));
      notify.error(errorMsg);
    } finally {
      setTestingModelId(null);
    }
  };

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: models.length,
      text: 0,
      code: 0,
      vision: 0,
      reasoning: 0,
      search: 0,
      audio: 0,
    };
    for (const m of models) {
      const c = getModelCapabilities(m);
      if (c.hasChat) counts.text++;
      if (c.hasCode) counts.code++;
      if (c.hasVision) counts.vision++;
      if (c.hasReasoning) counts.reasoning++;
      if (c.hasSearch) counts.search++;
      if (c.hasAudio) counts.audio++;
    }
    return counts;
  }, [models]);

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (capabilityFilter !== "all" && !matchesCapabilityFilter(m, capabilityFilter)) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesSearch(m.id, search) || (Boolean(m.name) && matchesSearch(m.name!, search));
    });
  }, [models, capabilityFilter, search]);

  return (
    <div className="rounded-xl border border-[#262626] bg-[#121212] overflow-hidden flex flex-col">
      {/* Table Header & Search Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#262626]/80 bg-[#161616]">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-[#C0C0C0]">dns</span>
          <h3 className="text-sm font-semibold text-white">Available Models Table</h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#C0C0C0]">
            {filteredModels.length} {filteredModels.length === 1 ? "model" : "models"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#737373]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#171717] text-white border border-[#333] rounded-lg focus:outline-none focus:border-[#C0C0C0]"
            />
          </div>

          {/* Fetch All Models Button placed directly above the table */}
          {onFetchModels && (
            <button
              type="button"
              disabled={isFetchingModels}
              onClick={() => void onFetchModels()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-black hover:bg-[#E5E5E5] transition-colors disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
              title="Query upstream /v1/models to fetch and synchronize all available models"
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isFetchingModels ? "animate-spin" : ""
                }`}
              >
                {isFetchingModels ? "progress_activity" : "cloud_sync"}
              </span>
              <span>{isFetchingModels ? "Fetching..." : "Fetch All Models"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Capability Filter Bar */}
      <div className="flex items-center gap-1 px-5 py-2.5 bg-[#141414] border-b border-[#262626] overflow-x-auto text-xs scrollbar-none">
        <span className="text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider mr-1.5 shrink-0">
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
                  ? "bg-white text-black font-semibold shadow-xs"
                  : "bg-[#1c1c1e] text-[#8e8e93] hover:text-white hover:bg-[#28282b] border border-white/5"
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
                  isActive ? "bg-black/15 text-black font-bold" : "bg-white/5 text-[#737373]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Upstream Fetch Error Alert */}
      {fetchError && (
        <div className="px-5 py-3 bg-red-950/30 border-b border-red-800/40 text-red-200 text-xs flex items-start gap-2.5">
          <span className="material-symbols-outlined text-red-400 text-[18px] flex-shrink-0 mt-0.5">
            error
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-red-300">Upstream Model Discovery Failed</span>
            <span className="font-mono text-[11px] text-red-200/90 break-all">{fetchError}</span>
          </div>
        </div>
      )}

      {/* Live Fetching Progress Banner */}
      {isFetchingModels && (
        <div className="w-full bg-[#181818] border-b border-[#2A2A2A] px-5 py-2.5 flex items-center justify-between text-xs text-[#E5E5E5]">
          <div className="flex items-center gap-2.5">
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Fetching & synchronizing AI models from upstream...</span>
          </div>
          <span className="text-[11px] font-mono text-[#A3A3A3]">Connecting to provider</span>
        </div>
      )}

      {/* Models Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#262626] bg-[#141414] text-[11px] font-medium text-[#737373] uppercase tracking-wider">
              <th className="py-2.5 px-4 w-12 text-center">Active</th>
              <th className="py-2.5 px-4">Model Info</th>
              <th className="py-2.5 px-4 w-28 text-center">Context Limit</th>
              <th className="py-2.5 px-4 w-44 text-center">Capabilities</th>
              <th className="py-2.5 px-4 w-28 text-center">Billing Tier</th>
              <th className="py-2.5 px-4 w-52 text-right">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#262626]/60 text-xs">
            {isFetchingModels && filteredModels.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-[#A3A3A3]">
                  <span className="material-symbols-outlined text-[32px] animate-spin block mb-3 text-white">
                    progress_activity
                  </span>
                  <p className="text-sm font-medium text-white">Fetching AI models from upstream provider...</p>
                  <p className="text-xs text-[#737373] mt-1">This will take just a few seconds.</p>
                </td>
              </tr>
            ) : filteredModels.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#737373]">
                  <span className="material-symbols-outlined text-[28px] opacity-40 block mb-1">
                    search_off
                  </span>
                  No models found matching your filter.
                </td>
              </tr>
            ) : (
              filteredModels.map((model) => {
                const isActive = !model.isHidden;
                const isFree =
                  Boolean(model.isFree) ||
                  isFreeModel(providerId, { id: model.id, isFree: model.isFree });
                const isTesting = testingModelId === model.id;
                const testResult = testResults[model.id];

                // Detect context window
                const rawTokens =
                  model.contextWindowOverride || model.max_input_tokens || model.inputTokenLimit;
                const contextStr = formatContextWindow(rawTokens);

                // Detect capabilities using unified helper
                const caps = getModelCapabilities(model);
                const selectedCap = selectedCapabilities[model.id] || "text";

                return (
                  <tr key={model.id} className="hover:bg-[#181818]/60 transition-colors group">
                    {/* Active Checkmark */}
                    <td className="py-3 px-4 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => handleToggleActive(model.id, Boolean(model.isHidden))}
                        className="size-4 rounded border-[#404040] bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                        title={
                          isActive
                            ? "Active — Model enabled for router combos & keys"
                            : "Inactive — Model disabled"
                        }
                      />
                    </td>

                    {/* Model Info */}
                    <td className="py-3 px-4 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">
                            {model.name || model.id}
                          </span>
                          {model.source === "custom" && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono">
                              custom
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#A3A3A3] font-mono">
                          <span className="select-all">{model.id}</span>
                          <button
                            type="button"
                            onClick={() => onCopy(model.id)}
                            className="p-0.5 rounded text-[#737373] hover:text-white transition-colors"
                            title="Copy Model ID"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              {copied === model.id ? "check" : "content_copy"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Context Limit */}
                    <td className="py-3 px-4 text-center align-middle">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-mono bg-[#1c1c1c] text-[#C0C0C0] border border-[#333]">
                        {contextStr}
                      </span>
                    </td>

                    {/* Interactive Capabilities for Testing */}
                    <td className="py-3 px-4 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1 flex-wrap">
                        {caps.hasChat && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "text")}
                            title={`Text: Dialogue & instruction prompt (${
                              selectedCap === "text" ? "Active for test" : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "text"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              chat
                            </span>
                            {selectedCap === "text" && (
                              <span className="text-[10px] uppercase font-semibold">text</span>
                            )}
                          </button>
                        )}
                        {caps.hasCode && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "code")}
                            title={`Code: Programming & syntax prompt (${
                              selectedCap === "code" ? "Active for test" : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "code"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              code
                            </span>
                            {selectedCap === "code" && (
                              <span className="text-[10px] uppercase font-semibold">code</span>
                            )}
                          </button>
                        )}
                        {caps.hasVision && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "vision")}
                            title={`Vision: Multimodal image prompt (${
                              selectedCap === "vision"
                                ? "Active for test"
                                : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "vision"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              visibility
                            </span>
                            {selectedCap === "vision" && (
                              <span className="text-[10px] uppercase font-semibold">vision</span>
                            )}
                          </button>
                        )}
                        {caps.hasReasoning && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "reasoning")}
                            title={`Reasoning: Chain-of-thought prompt (${
                              selectedCap === "reasoning"
                                ? "Active for test"
                                : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "reasoning"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              psychology
                            </span>
                            {selectedCap === "reasoning" && (
                              <span className="text-[10px] uppercase font-semibold">reason</span>
                            )}
                          </button>
                        )}
                        {caps.hasSearch && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "search")}
                            title={`Search: Grounded web search prompt (${
                              selectedCap === "search"
                                ? "Active for test"
                                : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "search"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              travel_explore
                            </span>
                            {selectedCap === "search" && (
                              <span className="text-[10px] uppercase font-semibold">search</span>
                            )}
                          </button>
                        )}
                        {caps.hasAudio && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "audio")}
                            title={`Audio: Speech transcription prompt (${
                              selectedCap === "audio"
                                ? "Active for test"
                                : "Click to select for test"
                            })`}
                            className={`px-1.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center gap-1 cursor-pointer ${
                              selectedCap === "audio"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              volume_up
                            </span>
                            {selectedCap === "audio" && (
                              <span className="text-[10px] uppercase font-semibold">audio</span>
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* FREE / PAID Toggle */}
                    <td className="py-3 px-4 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => handleToggleFree(model.id, isFree)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          isFree
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
                        }`}
                        title="Click to toggle Free/Paid tier"
                      >
                        <span className="size-1.5 rounded-full bg-current" />
                        <span>{isFree ? "FREE" : "PAID"}</span>
                      </button>
                    </td>

                    {/* Test Button & Status */}
                    <td className="py-3 px-4 text-right align-middle">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-2">
                          {testResult?.status === "ok" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                              <span className="material-symbols-outlined text-[13px]">
                                check_circle
                              </span>
                              <span>{testResult.latencyMs}ms</span>
                            </span>
                          )}

                          {testResult?.status === "error" && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-medium max-w-[120px] truncate"
                              title={testResult.error}
                            >
                              <span className="material-symbols-outlined text-[13px]">error</span>
                              <span>Failed</span>
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={isTesting}
                            onClick={() => handleRunTest(model.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1e1e1e] text-[#C0C0C0] hover:text-white hover:bg-[#282828] border border-[#333] hover:border-white/30 transition-colors disabled:opacity-50 cursor-pointer"
                            title={`Test model with ${selectedCap.toUpperCase()} capability prompt`}
                          >
                            {isTesting ? (
                              <>
                                <span className="material-symbols-outlined text-[13px] animate-spin">
                                  progress_activity
                                </span>
                                <span>Testing ({selectedCap})...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[13px]">
                                  play_arrow
                                </span>
                                <span>Test ({selectedCap})</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Live Snippet Preview */}
                        {testResult?.snippet && (
                          <div
                            className="text-[10px] font-mono text-[#888] max-w-[200px] truncate"
                            title={testResult.snippet}
                          >
                            &ldquo;{testResult.snippet}&rdquo;
                          </div>
                        )}
                        {testResult?.error && (
                          <div
                            className="text-[10px] font-mono text-red-400/80 max-w-[200px] truncate"
                            title={testResult.error}
                          >
                            {testResult.error}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
