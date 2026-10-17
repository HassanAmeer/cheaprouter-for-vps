"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import Card from "@/shared/components/Card";
import { useNotificationStore } from "@/store/notificationStore";
import { matchesSearch } from "@/shared/utils/turkishText";

export type LimitTargetType = "model" | "combo";
export type LimitResetWindow = "lifetime" | "monthly" | "weekly" | "daily";
export type LimitExhaustionAction = "error" | "fallback";

export interface ModelLimitPolicy {
  id: string;
  targetType: LimitTargetType;
  targetId: string;
  targetName: string;
  providerId: string | null;
  capability: string;
  totalTokenPool: number;
  consumedTokens: number;
  remainingTokens: number;
  consumptionPercent: number;
  rpmLimit: number | null;
  tpmLimit: number | null;
  resetWindow: LimitResetWindow;
  onExhaustion: LimitExhaustionAction;
  fallbackTarget: string | null;
  customErrorMessage: string | null;
  isActive: boolean;
  status: "healthy" | "near_limit" | "exhausted" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedTargetItem {
  id: string;
  type: LimitTargetType;
  name: string;
  originalName: string;
  customName: string | null;
  customAlias: string | null;
  provider?: string;
  strategy?: string;
  modelsCount?: number;
  isActive: boolean;
  contextWindow?: number | null;
  policy: ModelLimitPolicy | null;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) {
    const val = n / 1_000_000_000;
    return `${val.toFixed(val % 1 === 0 ? 0 : 2)}B`;
  }
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return `${val.toFixed(val % 1 === 0 ? 0 : 1)}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return `${val.toFixed(val % 1 === 0 ? 0 : 1)}k`;
  }
  return n.toLocaleString();
}

export function parseTokenInput(val: string | number): number {
  if (typeof val === "number") return Math.max(0, Math.floor(val));
  const s = String(val || "").trim().toLowerCase();
  if (!s) return 0;
  if (s.endsWith("b") || s.endsWith("billion")) {
    const num = parseFloat(s.replace(/b(illion)?/, ""));
    return isNaN(num) ? 0 : Math.floor(num * 1_000_000_000);
  }
  if (s.endsWith("m") || s.endsWith("million")) {
    const num = parseFloat(s.replace(/m(illion)?/, ""));
    return isNaN(num) ? 0 : Math.floor(num * 1_000_000);
  }
  if (s.endsWith("k") || s.endsWith("thousand")) {
    const num = parseFloat(s.replace(/k(thousand)?/, ""));
    return isNaN(num) ? 0 : Math.floor(num * 1_000);
  }
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

const PRESET_QUICK_LIMITS = ["1B", "2B", "10B", "34B", "50B", "80B"];

export default function LimitsBankPage() {
  const notify = useNotificationStore();

  const [limits, setLimits] = useState<ModelLimitPolicy[]>([]);
  const [rawModels, setRawModels] = useState<any[]>([]);
  const [rawCombos, setRawCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "model" | "combo">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "configured" | "unlimited" | "healthy" | "near_limit" | "exhausted" | "paused"
  >("all");

  // Inline Drafts per Target: key = `${target.type}::${target.id}`
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        poolInput: string;
        customError: string;
        resetWindow: LimitResetWindow;
        onExhaustion: LimitExhaustionAction;
        fallbackTarget: string;
      }
    >
  >({});

  // Expanded row IDs
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Row saving feedback
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // Fetch Limits
  const loadLimits = useCallback(async () => {
    try {
      const res = await fetch("/api/limits");
      if (!res.ok) throw new Error("Failed to load limit policies");
      const data = await res.json();
      if (data.success) {
        setLimits(data.limits || []);
        if (data.availableTargets) {
          setRawModels(data.availableTargets.models || []);
          setRawCombos(data.availableTargets.combos || []);
        }
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error loading limits");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/limits");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setLimits(data.limits || []);
          if (data.availableTargets) {
            setRawModels(data.availableTargets.models || []);
            setRawCombos(data.availableTargets.combos || []);
          }
        }
      } catch {
        // Best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Combine Combos & Models into unified targets
  const unifiedTargets: UnifiedTargetItem[] = useMemo(() => {
    const list: UnifiedTargetItem[] = [];

    // 1. Combos
    for (const c of rawCombos) {
      const id = String(c.id || c.name);
      const originalName = String(c.originalName || c.name || c.id);
      const customName = c.customName || null;
      const customAlias = c.customAlias || null;
      const name = customName || originalName;
      const matchedLimit =
        limits.find(
          (l) =>
            l.targetType === "combo" &&
            (l.targetId === id ||
              l.targetId === originalName ||
              (customAlias && l.targetId === customAlias))
        ) || null;

      list.push({
        id,
        type: "combo",
        name,
        originalName,
        customName,
        customAlias,
        strategy: c.strategy || "priority",
        modelsCount: c.modelsCount || 0,
        isActive: c.isActive !== false,
        policy: matchedLimit,
      });
    }

    // 2. Models
    for (const m of rawModels) {
      const id = m.id;
      const originalName = m.originalName || m.name || m.id;
      const customName = m.customName || null;
      const customAlias = m.customAlias || null;
      const name = customName || originalName;
      const matchedLimit =
        limits.find(
          (l) =>
            l.targetType === "model" &&
            (l.targetId === m.id ||
              l.targetId === `${m.provider}/${m.id}` ||
              (customAlias && l.targetId === customAlias))
        ) || null;

      list.push({
        id,
        type: "model",
        name,
        originalName,
        customName,
        customAlias,
        provider: m.provider,
        isActive: m.isActive !== false,
        contextWindow: m.contextWindow,
        policy: matchedLimit,
      });
    }

    return list;
  }, [rawCombos, rawModels, limits]);

  // Overall Statistics for 4 Cards
  const stats = useMemo(() => {
    let totalPool = 0;
    let totalConsumed = 0;
    let nearLimitCount = 0;
    let exhaustedCount = 0;
    let activeLimitCount = 0;

    for (const l of limits) {
      if (l.isActive) {
        activeLimitCount += 1;
        totalPool += l.totalTokenPool;
        totalConsumed += l.consumedTokens;
        if (l.status === "near_limit") nearLimitCount += 1;
        if (l.status === "exhausted") exhaustedCount += 1;
      }
    }

    // Top Limit Bank allocated models/combos (Card 2)
    const topAllocated = [...unifiedTargets]
      .filter((t) => t.policy && t.policy.totalTokenPool > 0)
      .sort((a, b) => (b.policy?.totalTokenPool ?? 0) - (a.policy?.totalTokenPool ?? 0))
      .slice(0, 4);

    // Top Usage Tokens Bank models/combos (Card 3)
    const topUsage = [...unifiedTargets]
      .filter((t) => t.policy && t.policy.consumedTokens > 0)
      .sort((a, b) => (b.policy?.consumedTokens ?? 0) - (a.policy?.consumedTokens ?? 0))
      .slice(0, 3);

    const overallPercent = totalPool > 0 ? (totalConsumed / totalPool) * 100 : 0;

    return {
      totalPool,
      totalConsumed,
      overallPercent: Math.min(100, Math.round(overallPercent * 10) / 10),
      activeLimitCount,
      nearLimitCount,
      exhaustedCount,
      topAllocated,
      topUsage,
      totalConfigured: limits.length,
    };
  }, [limits, unifiedTargets]);

  // Filtered list
  const filteredTargets = useMemo(() => {
    return unifiedTargets.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;

      if (statusFilter === "configured" && !item.policy) return false;
      if (statusFilter === "unlimited" && item.policy) return false;
      if (statusFilter === "healthy" && item.policy?.status !== "healthy") return false;
      if (statusFilter === "near_limit" && item.policy?.status !== "near_limit") return false;
      if (statusFilter === "exhausted" && item.policy?.status !== "exhausted") return false;
      if (statusFilter === "paused" && item.policy?.status !== "paused") return false;

      if (search.trim()) {
        const term = search.trim();
        const matchesCustom = matchesSearch(item.name, term);
        const matchesOriginal = matchesSearch(item.originalName, term);
        const matchesId = matchesSearch(item.id, term);
        const matchesAlias = item.customAlias ? matchesSearch(item.customAlias, term) : false;
        const matchesProvider = item.provider ? matchesSearch(item.provider, term) : false;
        const matchesStrategy = item.strategy ? matchesSearch(item.strategy, term) : false;

        if (
          !matchesCustom &&
          !matchesOriginal &&
          !matchesId &&
          !matchesAlias &&
          !matchesProvider &&
          !matchesStrategy
        ) {
          return false;
        }
      }
      return true;
    });
  }, [unifiedTargets, typeFilter, statusFilter, search]);

  // Toggle Row Expand / Collapse
  const toggleRowCollapse = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Toggle Policy Active
  const handleToggleActive = async (target: UnifiedTargetItem) => {
    if (!target.policy) return;
    try {
      const res = await fetch("/api/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.policy.id,
          action: "toggleActive",
          isActive: !target.policy.isActive,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      notify.success(
        !target.policy.isActive ? "Limits Bank policy enabled" : "Limits Bank policy paused"
      );
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error updating status");
    }
  };

  // Quick Add Tokens
  const handleAddTokens = async (target: UnifiedTargetItem, tokens: number) => {
    if (!target.policy || tokens <= 0) return;
    try {
      const res = await fetch("/api/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.policy.id,
          action: "addTokens",
          tokens,
        }),
      });
      if (!res.ok) throw new Error("Failed to add tokens");
      notify.success(`Added ${formatTokens(tokens)} tokens to ${target.name} limit bank`);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error adding tokens");
    }
  };

  // Reset Consumed Tokens
  const handleResetTokens = async (target: UnifiedTargetItem) => {
    if (!target.policy) return;
    if (!window.confirm(`Reset consumed token counter for "${target.name}" back to 0?`)) {
      return;
    }
    try {
      const res = await fetch("/api/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: target.policy.id,
          action: "resetTokens",
        }),
      });
      if (!res.ok) throw new Error("Failed to reset tokens");
      notify.success(`Consumed tokens reset for "${target.name}"`);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error resetting tokens");
    }
  };

  // Delete Policy (Revert to Unlimited)
  const handleDeletePolicy = async (target: UnifiedTargetItem) => {
    if (!target.policy) return;
    if (
      !window.confirm(
        `Remove Limit Bank for "${target.name}"? It will become unlimited with no hard ceiling.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/limits?id=${encodeURIComponent(target.policy.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove limit policy");
      notify.success(`Limit bank removed for "${target.name}". Now unlimited.`);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error removing limit policy");
    }
  };

  // Save Limit Policy from row
  const handleSaveRow = async (target: UnifiedTargetItem) => {
    const key = `${target.type}::${target.id}`;
    const draft = drafts[key];
    const rawInput = draft?.poolInput ?? (target.policy ? formatTokens(target.policy.totalTokenPool) : "");
    const parsedPool = parseTokenInput(rawInput);

    if (parsedPool <= 0) {
      notify.error("Please enter a valid token limit greater than 0 (e.g. 10B, 34B, 50B)");
      return;
    }

    setSavingKey(key);
    try {
      const payload = {
        id: target.policy?.id || undefined,
        targetType: target.type,
        targetId: target.id,
        targetName: target.name,
        providerId: target.provider || null,
        totalTokenPool: parsedPool,
        resetWindow: draft?.resetWindow || target.policy?.resetWindow || "lifetime",
        onExhaustion: draft?.onExhaustion || target.policy?.onExhaustion || "error",
        fallbackTarget:
          draft?.onExhaustion === "fallback"
            ? draft.fallbackTarget || null
            : target.policy?.fallbackTarget || null,
        customErrorMessage:
          draft?.customError !== undefined
            ? draft.customError.trim() || null
            : target.policy?.customErrorMessage || null,
        isActive: target.policy ? target.policy.isActive : true,
      };

      const res = await fetch("/api/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save limit bank");
      }

      setSavedKey(key);
      setTimeout(() => {
        setSavedKey((cur) => (cur === key ? null : cur));
      }, 2000);

      notify.success(`Limit Bank set to ${formatTokens(parsedPool)} tokens for "${target.name}"`);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error saving limit bank");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[30px] text-amber-500">
              account_balance
            </span>
            Limits Bank (لمٹس بینک)
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Configure global hard token limits bank for AI models and combos across all API users.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLimits}
            disabled={loading}
            className="p-2 rounded-lg bg-bg-card border border-border text-text-muted hover:text-text-main hover:bg-bg-subtle transition-all cursor-pointer"
            title="Refresh limits"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin" : ""}`}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Orange Alert Banner (Custom Name Explanation & Hard Global Ceilings) ── */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
        <span className="material-symbols-outlined text-amber-400 text-[20px] shrink-0 mt-0.5">
          info
        </span>
        <div className="flex-1 text-xs leading-relaxed">
          <span className="font-semibold text-amber-300">
            Here all AI models &amp; combos are displayed by their custom names.
          </span>{" "}
          If a custom name was set in Pipe Models, it is shown here. If you haven&apos;t renamed a
          model, its original name/ID is displayed. All limits set in this Limits Bank act as a
          hard token bank ceiling across all API consumers regardless of how many users or keys
          access it. When a model&apos;s bank is exhausted, further calls are blocked with a
          customizable limit exceeded error.
        </div>
      </div>

      {/* ── 4 Top Overview Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Limits Bank */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Total Limits Bank
            </span>
            <span className="size-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">account_balance</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-main">
              {stats.totalPool > 0 ? formatTokens(stats.totalPool) : "0"}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${stats.overallPercent}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-text-muted font-mono">
                {stats.overallPercent}%
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Consumed: <strong className="text-text-main font-mono">{formatTokens(stats.totalConsumed)}</strong> across {stats.activeLimitCount} active banks
            </p>
          </div>
        </Card>

        {/* Card 2: Top Allocated Limits Bank (Top 3-4 Models/Combos) */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Top Limit Banks
            </span>
            <span className="size-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">military_tech</span>
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {stats.topAllocated.length === 0 ? (
              <p className="text-xs text-text-muted py-2">No limit banks assigned yet</p>
            ) : (
              stats.topAllocated.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-xs min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <span className="size-4 rounded-full bg-bg-subtle text-[10px] font-mono font-bold flex items-center justify-center text-text-muted shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-text-main truncate text-[11px]" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-purple-400 shrink-0 text-[11px]">
                    {formatTokens(item.policy?.totalTokenPool || 0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Card 3: Top Usage Tokens Bank (Top 2-3 Most Used) */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Top Usage Tokens Bank
            </span>
            <span className="size-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {stats.topUsage.length === 0 ? (
              <p className="text-xs text-text-muted py-2">No token consumption recorded yet</p>
            ) : (
              stats.topUsage.map((item, idx) => {
                const consumed = item.policy?.consumedTokens || 0;
                const pool = item.policy?.totalTokenPool || 1;
                const pct = Math.min(100, Math.round((consumed / pool) * 100));
                return (
                  <div key={item.id} className="flex items-center justify-between text-xs min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                      <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-text-main truncate text-[11px]" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                      <span className="font-mono font-bold text-emerald-400">
                        {formatTokens(consumed)}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">({pct}%)</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Card 4: Limits Bank Health & Exhaustion */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Bank Quota Health
            </span>
            <span
              className={`size-8 rounded-lg flex items-center justify-center ${
                stats.exhaustedCount > 0
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "bg-blue-500/15 text-blue-400"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {stats.exhaustedCount > 0 ? "error" : "verified_user"}
              </span>
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-3">
              <div>
                <span className="text-2xl font-bold font-mono text-text-main">
                  {stats.activeLimitCount}
                </span>
                <span className="text-xs text-text-muted ml-1">active</span>
              </div>
              <span className="text-border">/</span>
              <div>
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {stats.nearLimitCount}
                </span>
                <span className="text-xs text-text-muted ml-1">&gt;85%</span>
              </div>
              <span className="text-border">/</span>
              <div>
                <span
                  className={`text-2xl font-bold font-mono ${
                    stats.exhaustedCount > 0 ? "text-red-400 font-extrabold" : "text-text-muted"
                  }`}
                >
                  {stats.exhaustedCount}
                </span>
                <span className="text-xs text-text-muted ml-1">exceeded</span>
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              {stats.exhaustedCount > 0 ? (
                <span className="text-red-400 font-semibold">
                  {stats.exhaustedCount} model(s) reached token ceiling &amp; blocked!
                </span>
              ) : (
                "All model token banks operating within thresholds"
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* ── Filters & Search Bar ── */}
      <Card className="p-3 bg-bg-card border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by custom name, original ID, provider..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="inline-flex rounded-lg bg-bg-subtle p-0.5 border border-border text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "all"
                  ? "bg-bg-card text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("model")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "model"
                  ? "bg-bg-card text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Models
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("combo")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "combo"
                  ? "bg-bg-card text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              Combos
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="configured">Configured (Limit Set)</option>
            <option value="unlimited">Unlimited (No Limit)</option>
            <option value="healthy">Healthy (&lt;85%)</option>
            <option value="near_limit">Near Limit (&gt;85%)</option>
            <option value="exhausted">Exhausted / Exceeded (100%)</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <span className="text-xs text-text-muted font-medium">
          Showing {filteredTargets.length} of {unifiedTargets.length} models &amp; combos
        </span>
      </Card>

      {/* ── Models & Combos Table ── */}
      <Card className="overflow-hidden border border-border bg-bg-card">
        {filteredTargets.length === 0 ? (
          <div className="py-14 text-center flex flex-col items-center justify-center gap-3">
            <div className="size-12 rounded-full bg-bg-subtle border border-border flex items-center justify-center text-text-muted">
              <span className="material-symbols-outlined text-2xl">account_balance</span>
            </div>
            <h3 className="text-base font-semibold text-text-main">No Models or Combos Found</h3>
            <p className="text-xs text-text-muted max-w-sm">
              No synced models match your filter. Check Pipe Models or clear your search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-subtle/60 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center"></th>
                  <th className="py-3 px-4 min-w-[220px]">Target (Custom &amp; Original Name)</th>
                  <th className="py-3 px-4 min-w-[240px]">Limit Bank Setting</th>
                  <th className="py-3 px-4 min-w-[220px]">Used / Total Limit Bank</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTargets.map((target) => {
                  const key = `${target.type}::${target.id}`;
                  const isExpanded = Boolean(expandedRows[key]);
                  const policy = target.policy;
                  const draft = drafts[key];
                  const currentPoolInput =
                    draft?.poolInput !== undefined
                      ? draft.poolInput
                      : policy
                        ? formatTokens(policy.totalTokenPool)
                        : "";

                  const consumed = policy?.consumedTokens || 0;
                  const totalPool = policy?.totalTokenPool || 0;
                  const remaining = policy ? policy.remainingTokens : 0;
                  const percent = policy ? policy.consumptionPercent : 0;

                  let barColor = "bg-emerald-500";
                  let percentColor = "text-emerald-400";
                  if (policy?.status === "exhausted") {
                    barColor = "bg-red-500";
                    percentColor = "text-red-400";
                  } else if (policy?.status === "near_limit") {
                    barColor = "bg-amber-500";
                    percentColor = "text-amber-400";
                  }

                  const isSavingThis = savingKey === key;
                  const isSavedThis = savedKey === key;

                  return (
                    <Fragment key={key}>
                      <tr className="hover:bg-bg-subtle/40 transition-colors">
                        {/* 0. Expand/Collapse Chevron Button */}
                        <td className="py-3 px-2 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => toggleRowCollapse(key)}
                            className="p-1 rounded text-text-muted hover:text-text-main hover:bg-bg-subtle transition-transform cursor-pointer"
                            title={isExpanded ? "Collapse details" : "Uncollapse full details"}
                          >
                            <span
                              className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                                isExpanded ? "rotate-90 text-amber-400" : ""
                              }`}
                            >
                              chevron_right
                            </span>
                          </button>
                        </td>

                        {/* 1. Target Identity (Custom Name prominent + Original Name/ID) */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Type Icon Badge */}
                              <span
                                className={`size-6 rounded-md flex items-center justify-center shrink-0 ${
                                  target.type === "combo"
                                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                    : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                                }`}
                                title={target.type === "combo" ? "Routing Combo" : "AI Model"}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {target.type === "combo" ? "layers" : "smart_toy"}
                                </span>
                              </span>

                              {/* Prominent Custom Display Name */}
                              <span className="font-bold text-text-main text-sm">
                                {target.name}
                              </span>

                              {target.customName && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-medium">
                                  custom
                                </span>
                              )}
                            </div>

                            {/* Subtitle with Original ID and Provider/Strategy */}
                            <div className="flex items-center gap-2 flex-wrap text-[11px] text-text-muted mt-0.5">
                              <span className="font-mono text-zinc-400 select-all" title={target.id}>
                                {target.id}
                              </span>
                              {target.provider && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-subtle border border-border text-text-muted font-mono">
                                  {target.provider}
                                </span>
                              )}
                              {target.strategy && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                                  {target.strategy}
                                </span>
                              )}
                              {target.customAlias && (
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  alias: {target.customAlias}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Limit Bank Setting Input & Quick Presets */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex flex-col gap-1.5 max-w-[240px]">
                            <div className="relative flex items-center">
                              <span className="material-symbols-outlined absolute left-2 text-text-muted text-[15px] pointer-events-none">
                                account_balance
                              </span>
                              <input
                                type="text"
                                value={currentPoolInput}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [key]: {
                                      poolInput: e.target.value,
                                      customError:
                                        prev[key]?.customError ??
                                        policy?.customErrorMessage ??
                                        "",
                                      resetWindow:
                                        prev[key]?.resetWindow ??
                                      policy?.resetWindow ??
                                        "lifetime",
                                      onExhaustion:
                                        prev[key]?.onExhaustion ??
                                        policy?.onExhaustion ??
                                        "error",
                                      fallbackTarget:
                                        prev[key]?.fallbackTarget ??
                                        policy?.fallbackTarget ??
                                        "",
                                    },
                                  }))
                                }
                                placeholder="e.g. 10B, 34B, 50B"
                                className="w-full pl-7 pr-2.5 py-1 rounded bg-bg-subtle border border-border font-mono text-xs text-text-main focus:outline-none focus:border-amber-500 placeholder:text-zinc-600"
                              />
                            </div>

                            {/* Quick Preset Buttons */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {PRESET_QUICK_LIMITS.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [key]: {
                                        poolInput: preset,
                                        customError:
                                          prev[key]?.customError ??
                                          policy?.customErrorMessage ??
                                          "",
                                        resetWindow:
                                          prev[key]?.resetWindow ??
                                          policy?.resetWindow ??
                                          "lifetime",
                                        onExhaustion:
                                          prev[key]?.onExhaustion ??
                                          policy?.onExhaustion ??
                                          "error",
                                        fallbackTarget:
                                          prev[key]?.fallbackTarget ??
                                          policy?.fallbackTarget ??
                                          "",
                                      },
                                    }))
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer border ${
                                    currentPoolInput.toUpperCase() === preset
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                      : "bg-bg-subtle hover:bg-bg border-border text-text-muted hover:text-text-main"
                                  }`}
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* 3. Used / Total Limit Bank Column */}
                        <td className="py-3 px-4 align-middle">
                          {policy && totalPool > 0 ? (
                            <div className="flex flex-col gap-1.5 min-w-[200px]">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-text-muted">
                                  <span className="font-bold font-mono text-text-main">
                                    {formatTokens(consumed)}
                                  </span>{" "}
                                  /{" "}
                                  <span className="font-bold font-mono text-amber-400">
                                    {formatTokens(totalPool)}
                                  </span>
                                </span>
                                <span className={`font-mono font-bold ${percentColor}`}>
                                  {percent}%
                                </span>
                              </div>

                              <div className="w-full h-2 rounded-full bg-bg-subtle overflow-hidden border border-border/50">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              <div className="text-[10px] text-text-muted flex justify-between items-center">
                                <span>
                                  Remaining:{" "}
                                  <strong className="text-text-main font-mono">
                                    {formatTokens(remaining)}
                                  </strong>
                                </span>
                                {policy.status === "exhausted" && (
                                  <span className="text-red-400 font-extrabold uppercase text-[9px] animate-pulse">
                                    Exceeded!
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1 text-text-muted">
                              <span className="text-xs font-mono">
                                Used: {consumed > 0 ? formatTokens(consumed) : "0"} / Unlimited
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                No ceiling set · Set limit &amp; click Save
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 4. Status Badge */}
                        <td className="py-3 px-4 text-center align-middle">
                          {policy ? (
                            policy.status === "healthy" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                                <span className="size-1.5 rounded-full bg-emerald-400" />
                                Healthy
                              </span>
                            ) : policy.status === "near_limit" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-medium">
                                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                Near Limit
                              </span>
                            ) : policy.status === "exhausted" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-bold">
                                <span className="size-1.5 rounded-full bg-red-400" />
                                Exhausted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 text-[11px] font-medium">
                                <span className="size-1.5 rounded-full bg-gray-400" />
                                Paused
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[11px]">
                              Unlimited
                            </span>
                          )}
                        </td>

                        {/* 5. SINGLE Save Button on Every Row */}
                        <td className="py-3 px-4 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => void handleSaveRow(target)}
                            disabled={isSavingThis}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                              isSavedThis
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-amber-500 hover:bg-amber-600 text-black font-bold"
                            }`}
                            title="Save Limit Bank for this model/combo"
                          >
                            <span
                              className={`material-symbols-outlined text-[15px] ${
                                isSavingThis ? "animate-spin" : ""
                              }`}
                            >
                              {isSavingThis
                                ? "progress_activity"
                                : isSavedThis
                                  ? "check"
                                  : "save"}
                            </span>
                            <span>{isSavingThis ? "Saving…" : isSavedThis ? "Saved!" : "Save"}</span>
                          </button>
                        </td>
                      </tr>

                      {/* ── Uncollapsed Row Details Drawer ── */}
                      {isExpanded && (
                        <tr className="bg-bg-subtle/20 border-b border-border/80">
                          <td colSpan={6} className="p-4">
                            <div className="rounded-xl border border-border/80 bg-surface/70 p-4 space-y-4">
                              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-amber-400 text-[18px]">
                                    tune
                                  </span>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-main">
                                    Limit Bank Policy Details &amp; Actions for &ldquo;{target.name}&rdquo;
                                  </h4>
                                </div>
                                {policy && (
                                  <div className="flex items-center gap-2">
                                    {/* Pause / Resume switch */}
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleActive(target)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-all cursor-pointer ${
                                        policy.isActive
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        {policy.isActive ? "pause" : "play_arrow"}
                                      </span>
                                      <span>{policy.isActive ? "Pause Policy" : "Resume Policy"}</span>
                                    </button>

                                    {/* Delete / Clear Limit */}
                                    <button
                                      type="button"
                                      onClick={() => void handleDeletePolicy(target)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all cursor-pointer"
                                      title="Remove limit policy"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        delete
                                      </span>
                                      <span>Remove Limit</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Detailed Metrics Breakdown */}
                              {policy ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="p-3 rounded-lg bg-bg-card border border-border">
                                    <span className="text-[10px] uppercase font-semibold text-text-muted">
                                      Total Limit Bank
                                    </span>
                                    <div className="text-lg font-mono font-bold text-text-main mt-0.5">
                                      {formatTokens(policy.totalTokenPool)}
                                    </div>
                                    <span className="text-[10px] text-text-muted font-mono">
                                      {policy.totalTokenPool.toLocaleString()} tokens
                                    </span>
                                  </div>

                                  <div className="p-3 rounded-lg bg-bg-card border border-border">
                                    <span className="text-[10px] uppercase font-semibold text-text-muted">
                                      Consumed Tokens
                                    </span>
                                    <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">
                                      {formatTokens(policy.consumedTokens)}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-text-muted font-mono mt-0.5">
                                      <span>{policy.consumedTokens.toLocaleString()} tokens</span>
                                      <button
                                        type="button"
                                        onClick={() => void handleResetTokens(target)}
                                        className="text-amber-400 hover:underline cursor-pointer"
                                      >
                                        Reset to 0
                                      </button>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-bg-card border border-border">
                                    <span className="text-[10px] uppercase font-semibold text-text-muted">
                                      Remaining in Bank
                                    </span>
                                    <div className="text-lg font-mono font-bold text-amber-400 mt-0.5">
                                      {formatTokens(policy.remainingTokens)}
                                    </div>
                                    <span className="text-[10px] text-text-muted font-mono">
                                      {policy.remainingTokens.toLocaleString()} tokens ({100 - percent}%)
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-text-muted italic">
                                  No limit bank set yet. Enter a limit (e.g. 10B, 34B, 50B) and click Save above to activate.
                                </p>
                              )}

                              {/* Quick Add Tokens & Fine-tune Controls */}
                              {policy && (
                                <div className="p-3 rounded-lg bg-bg-subtle/50 border border-border/60 space-y-2">
                                  <span className="text-[11px] font-semibold text-text-main flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[15px] text-emerald-400">
                                      add_circle
                                    </span>
                                    Quick Top-Up (Add Tokens to Bank):
                                  </span>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {[100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000, 10_000_000_000].map(
                                      (amount) => (
                                        <button
                                          key={amount}
                                          type="button"
                                          onClick={() => void handleAddTokens(target, amount)}
                                          className="px-2.5 py-1 rounded bg-bg-card border border-border text-text-main hover:border-emerald-500/50 hover:text-emerald-400 text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs"
                                        >
                                          +{formatTokens(amount)}
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Policy Custom Error Message & Reset Window */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <label className="flex flex-col gap-1 text-xs text-text-muted">
                                  <span className="font-semibold text-text-main">
                                    Custom Limit Exceeded Error Message:
                                  </span>
                                  <input
                                    type="text"
                                    value={
                                      draft?.customError !== undefined
                                        ? draft.customError
                                        : policy?.customErrorMessage ?? ""
                                    }
                                    onChange={(e) =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [key]: {
                                          poolInput: currentPoolInput,
                                          customError: e.target.value,
                                          resetWindow:
                                            prev[key]?.resetWindow ??
                                            policy?.resetWindow ??
                                            "lifetime",
                                          onExhaustion:
                                            prev[key]?.onExhaustion ??
                                            policy?.onExhaustion ??
                                            "error",
                                          fallbackTarget:
                                            prev[key]?.fallbackTarget ??
                                            policy?.fallbackTarget ??
                                            "",
                                        },
                                      }))
                                    }
                                    placeholder="Leave empty to use .env LIMIT_BANK_EXCEEDED_MESSAGE"
                                    className="px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                                  />
                                </label>

                                <label className="flex flex-col gap-1 text-xs text-text-muted">
                                  <span className="font-semibold text-text-main">
                                    Bank Reset Window:
                                  </span>
                                  <select
                                    value={
                                      draft?.resetWindow ?? policy?.resetWindow ?? "lifetime"
                                    }
                                    onChange={(e) =>
                                      setDrafts((prev) => ({
                                        ...prev,
                                        [key]: {
                                          poolInput: currentPoolInput,
                                          customError:
                                            prev[key]?.customError ??
                                            policy?.customErrorMessage ??
                                            "",
                                          resetWindow: e.target.value as LimitResetWindow,
                                          onExhaustion:
                                            prev[key]?.onExhaustion ??
                                            policy?.onExhaustion ??
                                            "error",
                                          fallbackTarget:
                                            prev[key]?.fallbackTarget ??
                                            policy?.fallbackTarget ??
                                            "",
                                        },
                                      }))
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main focus:outline-none cursor-pointer"
                                  >
                                    <option value="lifetime">Lifetime (Hard manual ceiling)</option>
                                    <option value="monthly">Monthly Auto-Reset</option>
                                    <option value="weekly">Weekly Auto-Reset</option>
                                    <option value="daily">Daily Auto-Reset</option>
                                  </select>
                                </label>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
