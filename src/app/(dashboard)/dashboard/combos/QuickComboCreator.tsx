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

import { useCallback, useEffect, useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Toggle from "@/shared/components/Toggle";
import { matchesSearch } from "@/shared/utils/turkishText";

interface Candidate {
  key: string;
  providerId: string;
  modelId: string;
  target: string;
  displayName: string;
  customAlias?: string | null;
  healthStatus: "healthy" | "cooldown" | "error";
}

async function fetchActiveCandidates(): Promise<Candidate[]> {
  const res = await fetch("/api/v1/models/curation");
  if (!res.ok) throw new Error(`Curation API returned ${res.status}`);
  const data = await res.json();
  const modelsByProvider: Record<string, Array<{ id: string; name?: string }>> =
    data?.modelsByProvider ?? {};
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
    isActive?: boolean;
  }> = Array.isArray(data?.customizations) ? data.customizations : [];

  const activeCustomizations = new Map<
    string,
    {
      customName?: string | null;
      customAlias?: string | null;
      testStatus?: "verified" | "failed" | null;
    }
  >();
  for (const c of customizations) {
    if (c.isActive === true) {
      activeCustomizations.set(`${c.providerId}::${c.originalModelId}`, {
        customName: c.customName,
        customAlias: c.customAlias,
        testStatus: c.testStatus,
      });
    }
  }

  const out: Candidate[] = [];
  for (const [providerId, models] of Object.entries(modelsByProvider)) {
    if (!connectedSet.has(providerId)) continue;
    for (const m of models) {
      const k = `${providerId}::${m.id}`;
      const cust = activeCustomizations.get(k);
      if (!cust) continue;

      let healthStatus: "healthy" | "cooldown" | "error" = "healthy";
      if (coolingSet.has(providerId)) {
        healthStatus = "cooldown";
      } else if (cust.testStatus === "failed") {
        healthStatus = "error";
      }

      out.push({
        key: k,
        providerId,
        modelId: m.id,
        target: cust.customAlias || `${providerId}/${m.id}`,
        displayName: cust.customName || m.name || m.id,
        customAlias: cust.customAlias,
        healthStatus,
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Pricing & Tier Label state
  const [pricingTier, setPricingTier] = useState<"free" | "paid">("free");
  const [inputCost, setInputCost] = useState("");
  const [cacheCost, setCacheCost] = useState("");
  const [outputCost, setOutputCost] = useState("");

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
      const pricingPayload = {
        tier: pricingTier,
        inputCost: pricingTier === "paid" && inputCost.trim() ? Math.max(0, Number(inputCost)) : 0,
        cacheCost: pricingTier === "paid" && cacheCost.trim() ? Math.max(0, Number(cacheCost)) : 0,
        outputCost: pricingTier === "paid" && outputCost.trim() ? Math.max(0, Number(outputCost)) : 0,
      };

      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: comboName,
          models: targets,
          strategy,
          pricing: pricingPayload,
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
      setPricingTier("free");
      setInputCost("");
      setCacheCost("");
      setOutputCost("");
      onCreated?.(createdId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [name, candidates, selected, strategy, pricingTier, inputCost, cacheCost, outputCost, onCreated]);

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

  const visible = candidates.filter(
    (c) =>
      matchesSearch(c.displayName, filter) ||
      matchesSearch(c.target, filter) ||
      matchesSearch(c.modelId, filter) ||
      matchesSearch(c.providerId, filter)
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedCandidates = visible.slice(startIndex, startIndex + PAGE_SIZE);

  const renderPaginationBar = (position: "top" | "bottom") => {
    if (visible.length <= PAGE_SIZE) return null;
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-text-muted bg-black/20 dark:bg-white/5 rounded-lg border border-border/60 ${
          position === "top" ? "mb-1" : "mt-1"
        }`}
      >
        <span className="font-mono text-[11px] text-text-muted">
          Showing {visible.length === 0 ? 0 : startIndex + 1}–
          {Math.min(startIndex + PAGE_SIZE, visible.length)} of {visible.length} models
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="!px-2.5 !py-1 text-xs"
          >
            Previous
          </Button>
          <span className="px-2 py-0.5 rounded bg-black/30 dark:bg-white/10 font-mono text-[11px] font-semibold text-text-main">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="!px-2.5 !py-1 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

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

          {/* Pricing & Tier Label Section */}
          <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-border/70 bg-black/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">sell</span>
                  Pricing & Tier Label
                </span>
                <span className="text-[11px] text-text-muted">
                  (Exported via API to Reseller platform & API docs)
                </span>
              </div>
              {/* Free vs Paid Toggle */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/20 dark:bg-white/10 border border-border/60">
                <button
                  type="button"
                  onClick={() => setPricingTier("free")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    pricingTier === "free"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setPricingTier("paid")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    pricingTier === "paid"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">payments</span>
                  Paid
                </button>
              </div>
            </div>

            {/* Cost inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label className="flex flex-col gap-1 text-[11px] text-text-muted">
                <span className="flex items-center justify-between">
                  <span>Input Cost ($/1M tokens)</span>
                  {pricingTier === "free" && (
                    <span className="text-emerald-400 font-semibold text-[10px]">$0 (Free)</span>
                  )}
                </span>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  disabled={pricingTier === "free"}
                  value={pricingTier === "free" ? "0" : inputCost}
                  onChange={(e) => setInputCost(e.target.value)}
                  placeholder="e.g. 0.50"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-text-muted">
                <span className="flex items-center justify-between">
                  <span>Cache Read Cost ($/1M tokens)</span>
                  {pricingTier === "free" && (
                    <span className="text-emerald-400 font-semibold text-[10px]">$0 (Free)</span>
                  )}
                </span>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  disabled={pricingTier === "free"}
                  value={pricingTier === "free" ? "0" : cacheCost}
                  onChange={(e) => setCacheCost(e.target.value)}
                  placeholder="e.g. 0.125"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-text-muted">
                <span className="flex items-center justify-between">
                  <span>Output Cost ($/1M tokens)</span>
                  {pricingTier === "free" && (
                    <span className="text-emerald-400 font-semibold text-[10px]">$0 (Free)</span>
                  )}
                </span>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  disabled={pricingTier === "free"}
                  value={pricingTier === "free" ? "0" : outputCost}
                  onChange={(e) => setOutputCost(e.target.value)}
                  placeholder="e.g. 1.50"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Candidate models — Manage Models active list only ({selected.size}/
                {candidates.length} selected)
              </span>
              <span className="flex-1" />
              <Input
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter models…"
              />
            </div>
            {loading && <p className="text-xs text-text-muted">Loading active models…</p>}
            {loadError && (
              <p role="alert" className="text-xs text-red-500">
                {loadError}
              </p>
            )}
            {!loading && !loadError && (
              <>
                {/* Top Pagination Bar */}
                {renderPaginationBar("top")}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {paginatedCandidates.map((c) => (
                    <label
                      key={c.key}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-xl border border-border/70 hover:border-primary/50 transition-all cursor-pointer bg-black/20 hover:bg-black/30"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.key)}
                        onChange={(e) => toggleCandidate(c.key, e.target.checked)}
                        className="size-4 accent-primary shrink-0 mt-0.5 rounded cursor-pointer"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {/* 💡 Idea 5: Live Health Dot */}
                          <span
                            className={`size-2 rounded-full shrink-0 ${
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
                          {/* 💡 Idea 3: Rich Model Identity (Display Name) */}
                          <span
                            className="font-semibold text-xs text-text-main truncate"
                            title={c.displayName}
                          >
                            {c.displayName}
                          </span>
                        </div>
                        {/* 💡 Idea 3: Provider and Model ID faint mono detail */}
                        <div className="flex items-center gap-1 text-[10px] text-text-muted/70 font-mono truncate mt-0.5">
                          <span className="truncate">
                            {c.providerId} / {c.modelId}
                          </span>
                          {c.customAlias && (
                            <span className="text-primary/80 shrink-0">➔ {c.customAlias}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                  {visible.length === 0 && (
                    <p className="text-xs text-text-muted col-span-full py-3 text-center">
                      {candidates.length === 0
                        ? "No active models — activate some in Providers → Manage Models first."
                        : "No candidates match the filter."}
                    </p>
                  )}
                </div>

                {/* Bottom Pagination Bar */}
                {renderPaginationBar("bottom")}
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
                    <span>{comboTestResult.ok ? "✅ Live Combo Output" : "❌ Combo Test Failed"}</span>
                    {comboTestResult.latencyMs != null && (
                      <span className="text-zinc-400 font-sans">· {comboTestResult.latencyMs}ms</span>
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
