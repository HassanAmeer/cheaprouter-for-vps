"use client";

import { useState } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { matchesSearch } from "@/shared/utils/turkishText";

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

export default function AvailableModelsTable({
  providerId,
  providerDisplayAlias,
  models,
  testPrompt,
  onRefreshModels,
  copied,
  onCopy,
}: AvailableModelsTableProps) {
  const notify = useNotificationStore();
  const [search, setSearch] = useState("");
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
    setTestingModelId(modelId);
    const fullModel = `${providerDisplayAlias}/${modelId}`;
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          modelId: fullModel,
          prompt: testPrompt || "Hi",
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
        notify.success(`Model "${modelId}" test succeeded (${data.latencyMs}ms)`);
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

  const filteredModels = models.filter((m) => {
    if (!search.trim()) return true;
    return matchesSearch(m.id, search) || (Boolean(m.name) && matchesSearch(m.name!, search));
  });

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

        {/* Search Input */}
        <div className="relative min-w-[240px]">
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
      </div>

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
            {filteredModels.length === 0 ? (
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
                const isFree = Boolean(model.isFree);
                const isTesting = testingModelId === model.id;
                const testResult = testResults[model.id];

                // Detect context window
                const rawTokens =
                  model.contextWindowOverride ||
                  model.max_input_tokens ||
                  model.inputTokenLimit;
                const contextStr = formatContextWindow(rawTokens);

                // Detect capabilities
                const mid = model.id.toLowerCase();
                const caps = model.capabilities ?? [];
                const endpoints = model.supportedEndpoints ?? [];
                const hasReasoning =
                  caps.includes("Reasoning") ||
                  mid.includes("reason") ||
                  mid.includes("r1") ||
                  mid.includes("o1") ||
                  mid.includes("o3") ||
                  model.reasoning === true;
                const hasVision =
                  caps.includes("Vision") ||
                  model.supportsVision === true ||
                  endpoints.includes("images") ||
                  mid.includes("vision") ||
                  mid.includes("vl");
                const hasCode =
                  caps.includes("Code") || mid.includes("code") || mid.includes("coder");
                const hasTools =
                  caps.includes("Tools") ||
                  endpoints.includes("tools") ||
                  !mid.includes("embed");
                const hasAudio =
                  caps.includes("Audio") ||
                  endpoints.includes("audio-speech") ||
                  endpoints.includes("audio-transcriptions") ||
                  mid.includes("audio") ||
                  mid.includes("whisper");

                return (
                  <tr
                    key={model.id}
                    className="hover:bg-[#181818]/60 transition-colors group"
                  >
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

                    {/* Capabilities with Tooltips */}
                    <td className="py-3 px-4 text-center align-middle">
                      <div className="inline-flex items-center justify-center gap-1">
                        {hasReasoning && (
                          <span
                            title="Reasoning: Multi-step logic & thinking"
                            className="p-1 rounded bg-[#1e1e1e] text-purple-400 border border-purple-500/30 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              psychology
                            </span>
                          </span>
                        )}
                        {hasVision && (
                          <span
                            title="Vision: Image analysis & visual inputs"
                            className="p-1 rounded bg-[#1e1e1e] text-sky-400 border border-sky-500/30 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              visibility
                            </span>
                          </span>
                        )}
                        {hasCode && (
                          <span
                            title="Code: Programming & syntax generation"
                            className="p-1 rounded bg-[#1e1e1e] text-emerald-400 border border-emerald-500/30 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              code
                            </span>
                          </span>
                        )}
                        {hasTools && (
                          <span
                            title="Tools: Function calling & external tool use"
                            className="p-1 rounded bg-[#1e1e1e] text-amber-400 border border-amber-500/30 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              build
                            </span>
                          </span>
                        )}
                        {hasAudio && (
                          <span
                            title="Audio: Speech and audio understanding"
                            className="p-1 rounded bg-[#1e1e1e] text-pink-400 border border-pink-500/30 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              volume_up
                            </span>
                          </span>
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
                              <span className="material-symbols-outlined text-[13px]">
                                error
                              </span>
                              <span>Failed</span>
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={isTesting}
                            onClick={() => handleRunTest(model.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1e1e1e] text-[#C0C0C0] hover:text-white hover:bg-[#282828] border border-[#333] hover:border-white/30 transition-colors disabled:opacity-50 cursor-pointer"
                            title={`Test with prompt: "${testPrompt}"`}
                          >
                            {isTesting ? (
                              <>
                                <span className="material-symbols-outlined text-[13px] animate-spin">
                                  progress_activity
                                </span>
                                <span>Testing...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[13px]">
                                  play_arrow
                                </span>
                                <span>Test</span>
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
