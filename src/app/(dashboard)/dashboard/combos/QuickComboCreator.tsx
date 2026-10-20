"use client";

/**
 * QuickComboCreator — simplified combo creation (reseller spec §5a–5c).
 *
 * A compact card above the full combo workbench for the two core strategies:
 *  - Auto Failover (`priority`): 4–6 models in priority sequence — on
 *    timeout / 429 / 500 / quota exhaustion the router replays on the next
 *    model.
 *  - Random (`random`): each request picks a random candidate (load spread).
 *
 * Candidate models come ONLY from the Manage Models active list
 * (`provider_model_customizations.is_active`, via /api/v1/models/curation),
 * addressed by custom alias when one is set. The combo name doubles as the
 * `model` parameter for API calls (e.g. `auto-coding-combo`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import { matchesSearch } from "@/shared/utils/turkishText";
import { detectModelCapabilities } from "@/shared/utils/modelCapabilities";

interface Candidate {
  key: string;
  providerId: string;
  modelId: string;
  target: string;
  displayName: string;
  customAlias?: string | null;
  healthStatus: "healthy" | "cooldown" | "error";
  contextWindow?: number | null;
  capabilities: {
    hasChat: boolean;
    hasVision: boolean;
    hasReasoning: boolean;
    hasCode: boolean;
    hasImageGen: boolean;
    hasAudio: boolean;
    hasVideo: boolean;
    hasSearch: boolean;
    hasEmbedding: boolean;
  };
}

function formatContextWindow(tokens: number | null | undefined): string {
  if (!tokens || tokens <= 0) return "128K";
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

async function fetchActiveCandidates(): Promise<Candidate[]> {
  const res = await fetch("/api/v1/models/curation");
  if (!res.ok) throw new Error(`Curation API returned ${res.status}`);
  const data = await res.json();
  const modelsByProvider: Record<
    string,
    Array<{ id: string; name?: string }>
  > = data?.modelsByProvider ?? {};
  const connectedProviderIds: string[] = Array.isArray(data?.connectedProviderIds)
    ? data.connectedProviderIds
    : [];
  const coolingProviderIds: string[] = Array.isArray(data?.coolingProviderIds)
    ? data.coolingProviderIds
    : [];
  const connectedSet = new Set(connectedProviderIds);
  const coolingSet = new Set(coolingProviderIds);

  const customizations: Array<{
    providerId: string;
    originalModelId: string;
    customName?: string | null;
    customAlias?: string | null;
    testStatus?: "verified" | "failed" | null;
    contextWindow?: number | null;
    capabilities?: string[] | null;
    isActive?: boolean;
  }> = Array.isArray(data?.customizations) ? data.customizations : [];

  const activeCustomizations = new Map<
    string,
    {
      customName?: string | null;
      customAlias?: string | null;
      testStatus?: "verified" | "failed" | null;
      contextWindow?: number | null;
      capabilities?: string[] | null;
    }
  >();
  for (const c of customizations) {
    if (c.isActive === true) {
      activeCustomizations.set(`${c.providerId}::${c.originalModelId}`, {
        customName: c.customName,
        customAlias: c.customAlias,
        testStatus: c.testStatus,
        contextWindow: c.contextWindow,
        capabilities: c.capabilities,
      });
    }
  }

  const providerHasCustomizations = new Set(customizations.map((c) => c.providerId));
  const out: Candidate[] = [];
  for (const [providerId, models] of Object.entries(modelsByProvider)) {
    if (!connectedSet.has(providerId)) continue;
    const hasCustomizations = providerHasCustomizations.has(providerId);
    for (const m of models) {
      const k = `${providerId}::${m.id}`;
      const cust = activeCustomizations.get(k);
      if (hasCustomizations && !cust) continue;

      let healthStatus: "healthy" | "cooldown" | "error" = "healthy";
      if (coolingSet.has(providerId)) {
        healthStatus = "cooldown";
      } else if (cust?.testStatus === "failed") {
        healthStatus = "error";
      }

      const detected = detectModelCapabilities({
        id: m.id,
        name: m.name,
        capabilities: (cust?.capabilities || (m as Record<string, unknown>).capabilities) as
          string[] | Record<string, unknown> | null | undefined,
        categories: (m as Record<string, unknown>).categories as string[] | null | undefined,
        supportsVision: (m as Record<string, unknown>).supportsVision as boolean | undefined,
        supportsThinking: (m as Record<string, unknown>).supportsThinking as boolean | undefined,
      });

      const contextTokens =
        cust?.contextWindow ??
        ((m as Record<string, unknown>).contextWindow as number | undefined) ??
        ((m as Record<string, unknown>).inputTokenLimit as number | undefined) ??
        null;

      out.push({
        key: k,
        providerId,
        modelId: m.id,
        target: cust?.customAlias || `${providerId}/${m.id}`,
        displayName: cust?.customName || m.name || m.id,
        customAlias: cust?.customAlias,
        healthStatus,
        contextWindow: contextTokens,
        capabilities: {
          hasChat: detected.hasChat,
          hasVision: detected.hasVision,
          hasReasoning: detected.hasReasoning,
          hasCode: detected.hasCode,
          hasImageGen: detected.hasImageGen,
          hasAudio: detected.hasAudio,
          hasVideo: detected.hasVideo,
          hasSearch: detected.hasSearch,
          hasEmbedding: detected.hasEmbedding,
        },
      });
    }
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default function QuickComboCreator({
  onCreated,
}: {
  onCreated?: (comboId: string) => void;
}) {
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<"priority" | "random">("priority");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [activeProvider, setActiveProvider] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // 💡 Idea 4: State for instant combo testing
  const [lastCreatedCombo, setLastCreatedCombo] = useState<{
    id: string;
    name: string;
    targets: string[];
    strategy: string;
  } | null>(null);
  const [testingCombo, setTestingCombo] = useState(false);
  const [comboTestResult, setComboTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    modelServed?: string;
    snippet: string;
  } | null>(null);

  // Initial load: async work runs after the await inside the effect, so no
  // setState fires synchronously in the effect body (react-hooks rule).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const list = await fetchActiveCandidates();
        if (cancelled) return;
        setCandidates(list);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load active models");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleCandidate = useCallback((key: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const create = useCallback(async () => {
    setFormError(null);
    const comboName = name.trim();
    if (!comboName) {
      setFormError("Give the combo a name / ID first (used as the `model` parameter).");
      return;
    }
    const targets = candidates.filter((c) => selected.has(c.key)).map((c) => c.target);
    if (targets.length === 0) {
      setFormError("Select at least one candidate model.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: comboName,
          models: targets,
          strategy,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(
          typeof data?.error === "string" ? data.error : `Create failed (${res.status})`
        );
        return;
      }
      const createdId = data?.id ?? data?.name ?? comboName;
      setLastCreatedCombo({
        id: createdId,
        name: comboName,
        targets,
        strategy,
      });
      setComboTestResult(null);
      setName("");
      setSelected(new Set());
      onCreated?.(createdId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [name, candidates, selected, strategy, onCreated]);

  // 💡 Idea 4: Instant combo dry-run probe
  const testCreatedCombo = useCallback(async (comboName: string) => {
    setTestingCombo(true);
    setComboTestResult(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/combos/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboName }),
      });
      const latencyMs = Date.now() - start;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setComboTestResult({
          ok: false,
          latencyMs,
          snippet: data?.error || `HTTP ${res.status}: Test failed`,
        });
        return;
      }
      const results: Array<{
        target?: string;
        status?: string;
        output?: string;
        error?: string;
        latencyMs?: number;
      }> = Array.isArray(data?.results) ? data.results : [];
      const successful = results.find((r) => r.status === "ok");
      if (successful) {
        setComboTestResult({
          ok: true,
          latencyMs: successful.latencyMs ?? latencyMs,
          modelServed: successful.target,
          snippet: successful.output?.slice(0, 300) || "Combo successfully responded upstream!",
        });
      } else {
        const firstError = results[0]?.error || data?.error || "All targets in combo failed test";
        setComboTestResult({
          ok: false,
          latencyMs,
          snippet: firstError,
        });
      }
    } catch (err) {
      setComboTestResult({
        ok: false,
        latencyMs: Date.now() - start,
        snippet: err instanceof Error ? err.message : "Test request failed",
      });
    } finally {
      setTestingCombo(false);
    }
  }, []);

  const connectedProviders = useMemo(() => {
    const set = new Set<string>();
    for (const c of candidates) {
      if (c.providerId) set.add(c.providerId);
    }
    return Array.from(set).sort();
  }, [candidates]);

  const displayedCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesProvider = activeProvider === "all" || c.providerId === activeProvider;
      if (!matchesProvider) return false;
      if (!filter.trim()) return true;
      return (
        matchesSearch(c.displayName, filter) ||
        matchesSearch(c.target, filter) ||
        matchesSearch(c.modelId, filter) ||
        matchesSearch(c.providerId, filter)
      );
    });
  }, [candidates, activeProvider, filter]);

  return (
    <Card padding="sm">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="material-symbols-outlined text-[20px] text-text-muted">
          {collapsed ? "expand_more" : "expand_less"}
        </span>
        <span className="text-sm font-semibold">Quick combo</span>
        <span className="text-xs text-text-muted">
          Name + active models + failover/random + pricing — no wizard needed
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Custom combo name / ID
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. auto-coding-combo"
              />
              <span>
                Passed as the <code>model</code> parameter in API calls.
              </span>
            </label>
            <div className="flex flex-col gap-2 text-xs text-text-muted">
              <span>Core strategy (pick one)</span>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle
                    checked={strategy === "priority"}
                    onChange={() => setStrategy("priority")}
                  />
                  <span className="text-sm text-text-main">Auto failover</span>
                  <span className="text-text-muted">
                    Priority sequence — timeout / 429 / 500 / quota → next model
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle checked={strategy === "random"} onChange={() => setStrategy("random")} />
                  <span className="text-sm text-text-main">Random</span>
                  <span className="text-text-muted">
                    Each request picks a random candidate (load spread)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">hub</span>
                Candidate models — Pipe Models active list only ({selected.size}/{candidates.length}{" "}
                selected)
              </span>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer transition-colors"
                >
                  Clear selection ({selected.size})
                </button>
              )}
            </div>

            {loading && <p className="text-xs text-text-muted">Loading active models…</p>}
            {loadError && (
              <p role="alert" className="text-xs text-red-500">
                {loadError}
              </p>
            )}

            {!loading && !loadError && (
              <>
                {/* Connected Providers List (Row / Flex-wrap) */}
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-text-muted flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Connected Providers:
                    </span>
                    {connectedProviders.length > 0 && (
                      <span className="text-[10px] text-text-muted font-mono">
                        {connectedProviders.length} connected
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveProvider("all")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                        activeProvider === "all"
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-black/20 dark:bg-white/5 border-border/70 text-text-muted hover:text-text-main hover:border-border"
                      }`}
                    >
                      <span>All Connected</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          activeProvider === "all"
                            ? "bg-black/30 text-white"
                            : "bg-black/20 text-text-muted"
                        }`}
                      >
                        {candidates.length}
                      </span>
                    </button>

                    {connectedProviders.map((pid) => {
                      const pCount = candidates.filter((c) => c.providerId === pid).length;
                      const pSelected = candidates.filter(
                        (c) => c.providerId === pid && selected.has(c.key)
                      ).length;
                      const isCurrent = activeProvider === pid;

                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => setActiveProvider(isCurrent ? "all" : pid)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isCurrent
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-black/20 dark:bg-white/5 border-border/70 text-text-muted hover:text-text-main hover:border-border"
                          }`}
                        >
                          <span className="capitalize">{pid}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                              isCurrent ? "bg-black/30 text-white" : "bg-black/20 text-text-muted"
                            }`}
                          >
                            {pCount}
                          </span>
                          {pSelected > 0 && (
                            <span
                              className="size-2 rounded-full bg-emerald-400 shrink-0"
                              title={`${pSelected} selected`}
                            />
                          )}
                        </button>
                      );
                    })}

                    {connectedProviders.length === 0 && (
                      <span className="text-xs text-text-muted italic">
                        No connected providers with active models found.
                      </span>
                    )}
                  </div>
                </div>

                {/* Textarea Container for Candidate Model Chips */}
                <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/80 bg-black/25 dark:bg-white/[0.02] shadow-inner focus-within:border-primary/60 transition-colors">
                  {/* Toolbar inside textarea */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-primary">
                          dns
                        </span>
                        {activeProvider === "all"
                          ? "All Connected Models"
                          : `${activeProvider.toUpperCase()} Models`}
                      </span>
                      <span className="text-[11px] text-text-muted font-mono">
                        ({displayedCandidates.length} available)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {displayedCandidates.length > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                for (const c of displayedCandidates) next.add(c.key);
                                return next;
                              });
                            }}
                            className="text-[11px] px-2 py-0.5 rounded bg-black/30 dark:bg-white/10 hover:bg-primary/20 text-text-muted hover:text-primary transition-colors cursor-pointer border border-border/50"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                for (const c of displayedCandidates) next.delete(c.key);
                                return next;
                              });
                            }}
                            className="text-[11px] px-2 py-0.5 rounded bg-black/30 dark:bg-white/10 hover:bg-rose-500/20 text-text-muted hover:text-rose-400 transition-colors cursor-pointer border border-border/50"
                          >
                            Deselect
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <Input
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="Filter model chips…"
                          className="!py-1 !text-xs !w-44"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selected Models Chips Bar (inside textarea) */}
                  {selected.size > 0 && (
                    <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-black/30 dark:bg-white/5 border border-primary/20">
                      <div className="flex items-center justify-between text-[11px] text-primary-light font-medium">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">
                            check_circle
                          </span>
                          Selected in combo ({selected.size}):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto">
                        {Array.from(selected).map((key) => {
                          const c = candidates.find((item) => item.key === key);
                          if (!c) return null;
                          return (
                            <span
                              key={c.key}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/20 border border-primary/40 text-text-main text-[11px] font-mono"
                            >
                              <span className="text-[9px] px-1 py-0.2 rounded bg-black/40 text-primary-light uppercase font-bold">
                                {c.providerId}
                              </span>
                              <span className="font-sans font-medium text-text-main truncate max-w-[150px]">
                                {c.displayName}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleCandidate(c.key, false);
                                }}
                                className="hover:text-rose-400 text-text-muted transition-colors cursor-pointer"
                                title="Remove"
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">
                                  close
                                </span>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Textarea List Items Body (Compact multi-column grid, not full width) */}
                  <div className="min-h-[280px] max-h-[520px] overflow-y-auto p-2.5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start rounded-lg bg-black/35 dark:bg-black/50 border border-border/60">
                    {displayedCandidates.map((c) => {
                      const isChecked = selected.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-all border cursor-pointer select-none min-w-0 ${
                            isChecked
                              ? "bg-primary/15 border-primary text-text-main shadow-sm ring-1 ring-primary/30"
                              : "bg-black/25 dark:bg-white/[0.03] hover:bg-black/40 border-border/70 text-text-muted hover:text-text-main"
                          }`}
                        >
                          {/* Left Section: Top-left checkmark, neechy context window */}
                          <div className="flex flex-col items-center justify-center shrink-0 min-w-[44px] gap-1">
                            <div className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => toggleCandidate(c.key, e.target.checked)}
                                className="size-3.5 accent-primary rounded cursor-pointer"
                              />
                              <span
                                className={`size-1.5 rounded-full shrink-0 ${
                                  c.healthStatus === "cooldown"
                                    ? "bg-amber-400 ring-2 ring-amber-400/20"
                                    : c.healthStatus === "error"
                                      ? "bg-rose-500 ring-2 ring-rose-500/20"
                                      : "bg-emerald-400 ring-2 ring-emerald-400/20"
                                }`}
                                title={
                                  c.healthStatus === "cooldown"
                                    ? "Cooldown / Rate-limited"
                                    : c.healthStatus === "error"
                                      ? "Upstream Test Failed"
                                      : "Healthy & Ready"
                                }
                              />
                            </div>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-medium leading-tight">
                              {formatContextWindow(c.contextWindow)}
                            </span>
                          </div>

                          <div className="h-7 w-px bg-border/40 shrink-0" />

                          {/* Middle Section: Provider name, and neechy capabilities icons (buht choty) */}
                          <div className="flex flex-col items-start justify-center shrink-0 min-w-[65px] gap-0.5">
                            <span className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-black/40 dark:bg-black/60 border border-border/60 text-primary-light uppercase font-bold tracking-wider leading-tight">
                              {c.providerId}
                            </span>
                            <div className="flex items-center gap-0.5 text-text-muted/80">
                              {c.capabilities.hasChat && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none"
                                  title="Chat"
                                >
                                  chat
                                </span>
                              )}
                              {c.capabilities.hasVision && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-cyan-400"
                                  title="Vision"
                                >
                                  visibility
                                </span>
                              )}
                              {c.capabilities.hasReasoning && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-amber-400"
                                  title="Reasoning"
                                >
                                  psychology
                                </span>
                              )}
                              {c.capabilities.hasCode && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-blue-400"
                                  title="Code"
                                >
                                  code
                                </span>
                              )}
                              {c.capabilities.hasImageGen && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-pink-400"
                                  title="Image Gen"
                                >
                                  palette
                                </span>
                              )}
                              {c.capabilities.hasAudio && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-emerald-400"
                                  title="Audio"
                                >
                                  volume_up
                                </span>
                              )}
                              {c.capabilities.hasVideo && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-purple-400"
                                  title="Video"
                                >
                                  videocam
                                </span>
                              )}
                              {c.capabilities.hasSearch && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-orange-400"
                                  title="Search"
                                >
                                  travel_explore
                                </span>
                              )}
                              {c.capabilities.hasEmbedding && (
                                <span
                                  className="material-symbols-outlined text-[10px] leading-none text-indigo-400"
                                  title="Embedding"
                                >
                                  hub
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="h-7 w-px bg-border/40 shrink-0" />

                          {/* Right Section: Next in row is Model Name and Model ID in columns */}
                          <div className="flex flex-col min-w-0 flex-1 text-left">
                            <span
                              className="font-semibold text-text-main text-[11px] truncate leading-snug"
                              title={c.displayName}
                            >
                              {c.displayName}
                            </span>
                            <div className="flex items-center gap-1 text-[9.5px] font-mono text-text-muted/70 truncate mt-0.5">
                              <span className="truncate">
                                {c.providerId}/{c.modelId}
                              </span>
                              {c.customAlias && (
                                <span className="text-primary text-[9.5px] font-mono shrink-0">
                                  ➔ {c.customAlias}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}

                    {displayedCandidates.length === 0 && (
                      <div className="w-full py-8 text-center text-xs text-text-muted">
                        {candidates.length === 0
                          ? "No active models found in connected providers. Activate models in Providers → Pipe Models first."
                          : "No models match your current filter or provider selection."}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-xs text-red-500">
              {formError}
            </p>
          )}

          <div>
            <Button icon="add" onClick={() => void create()} disabled={creating || loading}>
              {creating ? "Creating…" : "Create combo"}
            </Button>
          </div>

          {/* 💡 Idea 4: Instant Combo Dry-Run Result & Test Button */}
          {lastCreatedCombo && (
            <div className="mt-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-lg">
                    check_circle
                  </span>
                  <div>
                    <span className="text-xs font-bold text-emerald-300">
                      Combo &ldquo;{lastCreatedCombo.name}&rdquo; created successfully!
                    </span>
                    <span className="text-[11px] text-zinc-400 block font-mono">
                      Targets: {lastCreatedCombo.targets.join(", ")}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  icon={testingCombo ? "progress_activity" : "bolt"}
                  onClick={() => void testCreatedCombo(lastCreatedCombo.name)}
                  disabled={testingCombo}
                >
                  {testingCombo ? "Testing Combo…" : "Test Combo Now ⚡"}
                </Button>
              </div>
              {comboTestResult && (
                <div
                  className={`text-[11px] font-mono p-2.5 rounded-lg border leading-relaxed ${
                    comboTestResult.ok
                      ? "bg-black/50 border-emerald-500/30 text-emerald-200"
                      : "bg-black/50 border-red-500/30 text-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    <span>
                      {comboTestResult.ok ? "✅ Live Combo Output" : "❌ Combo Test Failed"}
                    </span>
                    {comboTestResult.latencyMs != null && (
                      <span className="text-zinc-400 font-sans">
                        · {comboTestResult.latencyMs}ms
                      </span>
                    )}
                    {comboTestResult.modelServed && (
                      <span className="text-zinc-300 font-sans">
                        · Target: {comboTestResult.modelServed}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-200 break-words">{comboTestResult.snippet}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
