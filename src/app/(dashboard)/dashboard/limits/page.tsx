"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Card from "@/shared/components/Card";
import { useNotificationStore } from "@/store/notificationStore";
import { matchesSearch } from "@/shared/utils/turkishText";
import { toNumber } from "@/shared/utils/numeric";

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

interface TargetItem {
  id: string;
  name: string;
  provider?: string;
  strategy?: string;
}

const PRESET_POOLS = [
  { label: "10M", value: 10_000_000 },
  { label: "50M", value: 50_000_000 },
  { label: "100M", value: 100_000_000 },
  { label: "500M", value: 500_000_000 },
  { label: "1 Billion", value: 1_000_000_000 },
  { label: "5 Billion", value: 5_000_000_000 },
];

function formatTokens(n: number): string {
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

export default function LimitsPage() {
  const notify = useNotificationStore();

  const [limits, setLimits] = useState<ModelLimitPolicy[]>([]);
  const [availableModels, setAvailableModels] = useState<TargetItem[]>([]);
  const [availableCombos, setAvailableCombos] = useState<TargetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "model" | "combo">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "near_limit" | "exhausted" | "paused">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formTargetType, setFormTargetType] = useState<LimitTargetType>("model");
  const [formTargetId, setFormTargetId] = useState("");
  const [formTotalPool, setFormTotalPool] = useState<number>(1_000_000_000);
  const [formRpmLimit, setFormRpmLimit] = useState<string>("");
  const [formTpmLimit, setFormTpmLimit] = useState<string>("");
  const [formResetWindow, setFormResetWindow] = useState<LimitResetWindow>("lifetime");
  const [formOnExhaustion, setFormOnExhaustion] = useState<LimitExhaustionAction>("error");
  const [formFallbackTarget, setFormFallbackTarget] = useState<string>("");
  const [formCustomError, setFormCustomError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Add Tokens Modal
  const [addTokensTarget, setAddTokensTarget] = useState<ModelLimitPolicy | null>(null);
  const [tokensToAdd, setTokensToAdd] = useState<number>(100_000_000);

  // Fetch Limits
  const loadLimits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/limits");
      if (!res.ok) throw new Error("Failed to load limit policies");
      const data = await res.json();
      if (data.success) {
        setLimits(data.limits || []);
        if (data.availableTargets) {
          setAvailableModels(data.availableTargets.models || []);
          setAvailableCombos(data.availableTargets.combos || []);
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
            setAvailableModels(data.availableTargets.models || []);
            setAvailableCombos(data.availableTargets.combos || []);
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

  // Filtered limits
  const filteredLimits = useMemo(() => {
    return limits.filter((item) => {
      if (typeFilter !== "all" && item.targetType !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (search.trim()) {
        const term = search.trim();
        const matchesName = matchesSearch(item.targetName, term);
        const matchesId = matchesSearch(item.targetId, term);
        const matchesProvider = item.providerId ? matchesSearch(item.providerId, term) : false;
        if (!matchesName && !matchesId && !matchesProvider) return false;
      }
      return true;
    });
  }, [limits, typeFilter, statusFilter, search]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalPool = 0;
    let totalConsumed = 0;
    let activeRpm = 0;
    let nearLimitCount = 0;
    let exhaustedCount = 0;

    for (const l of limits) {
      totalPool += l.totalTokenPool;
      totalConsumed += l.consumedTokens;
      if (l.rpmLimit && l.rpmLimit > 0) activeRpm += 1;
      if (l.status === "near_limit") nearLimitCount += 1;
      if (l.status === "exhausted") exhaustedCount += 1;
    }

    const overallPercent = totalPool > 0 ? (totalConsumed / totalPool) * 100 : 0;
    return {
      totalPool,
      totalConsumed,
      overallPercent: Math.min(100, Math.round(overallPercent * 10) / 10),
      activeRpm,
      nearLimitCount,
      exhaustedCount,
      totalCount: limits.length,
    };
  }, [limits]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormTargetType("model");
    setFormTargetId(availableModels[0]?.id || "");
    setFormTotalPool(1_000_000_000);
    setFormRpmLimit("60");
    setFormTpmLimit("500000");
    setFormResetWindow("lifetime");
    setFormOnExhaustion("error");
    setFormFallbackTarget("");
    setFormCustomError("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ModelLimitPolicy) => {
    setEditingId(item.id);
    setFormTargetType(item.targetType);
    setFormTargetId(item.targetId);
    setFormTotalPool(item.totalTokenPool);
    setFormRpmLimit(item.rpmLimit ? String(item.rpmLimit) : "");
    setFormTpmLimit(item.tpmLimit ? String(item.tpmLimit) : "");
    setFormResetWindow(item.resetWindow);
    setFormOnExhaustion(item.onExhaustion);
    setFormFallbackTarget(item.fallbackTarget || "");
    setFormCustomError(item.customErrorMessage || "");
    setIsModalOpen(true);
  };

  // Save Limit Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTargetId.trim()) {
      notify.error("Please select a target model or combo");
      return;
    }
    if (formTotalPool <= 0) {
      notify.error("Token pool must be greater than 0");
      return;
    }

    const targetList = formTargetType === "model" ? availableModels : availableCombos;
    const matchedTarget = targetList.find((t) => t.id === formTargetId);
    const targetName = matchedTarget?.name || formTargetId;
    const providerId = formTargetType === "model" ? matchedTarget?.provider || null : null;

    setSaving(true);
    try {
      const res = await fetch("/api/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId || undefined,
          targetType: formTargetType,
          targetId: formTargetId,
          targetName,
          providerId,
          totalTokenPool: formTotalPool,
          rpmLimit: formRpmLimit.trim() ? toNumber(formRpmLimit) : null,
          tpmLimit: formTpmLimit.trim() ? toNumber(formTpmLimit) : null,
          resetWindow: formResetWindow,
          onExhaustion: formOnExhaustion,
          fallbackTarget: formOnExhaustion === "fallback" ? formFallbackTarget || null : null,
          customErrorMessage: formCustomError.trim() ? formCustomError.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save limit policy");
      }

      notify.success(
        editingId ? "Limit policy updated successfully" : "New limit policy created"
      );
      setIsModalOpen(false);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error saving limit policy");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active
  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const res = await fetch("/api/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "toggleActive",
          isActive: !current,
        }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      notify.success(!current ? "Limit policy enabled" : "Limit policy paused");
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error updating status");
    }
  };

  // Add Tokens
  const handleAddTokens = async () => {
    if (!addTokensTarget || tokensToAdd <= 0) return;
    try {
      const res = await fetch("/api/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: addTokensTarget.id,
          action: "addTokens",
          tokens: tokensToAdd,
        }),
      });
      if (!res.ok) throw new Error("Failed to add tokens");
      notify.success(`Added ${formatTokens(tokensToAdd)} tokens to ${addTokensTarget.targetName}`);
      setAddTokensTarget(null);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error adding tokens");
    }
  };

  // Delete Policy
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the limit policy for "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/limits?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete policy");
      notify.success(`Removed limit policy for "${name}"`);
      await loadLimits();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error deleting policy");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[30px] text-[#F43F5E]">speed</span>
            Quota & Rate Limits
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Configure shared token pool budgets, RPM/TPM velocity throttles, and limit exhaustion behaviors.
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
            <span className={`material-symbols-outlined text-[20px] ${loading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F43F5E] hover:bg-[#e11d48] text-white font-medium text-sm shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Limit Policy</span>
          </button>
        </div>
      </div>

      {/* ── Overview Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pools */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Total Token Pools
            </span>
            <span className="size-8 rounded-lg bg-[#F43F5E]/15 text-[#F43F5E] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">database</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-main">
              {formatTokens(stats.totalPool)}
            </div>
            <p className="text-xs text-text-muted mt-1">Across {stats.totalCount} configured targets</p>
          </div>
        </Card>

        {/* Card 2: Consumed Tokens */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Total Consumed
            </span>
            <span className="size-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">data_usage</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-main">
              {formatTokens(stats.totalConsumed)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${stats.overallPercent}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-text-muted font-mono">
                {stats.overallPercent}%
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: Velocity Controls */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Active Velocity Limits
            </span>
            <span className="size-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">speed</span>
            </span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-main">
              {stats.activeRpm} Targets
            </div>
            <p className="text-xs text-text-muted mt-1">Protected with RPM / TPM rate limits</p>
          </div>
        </Card>

        {/* Card 4: Health Status */}
        <Card className="p-4 bg-bg-card/70 border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Quota Health
            </span>
            <span className="size-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold font-mono text-amber-400">
                {stats.nearLimitCount}
              </span>
              <span className="text-xs text-text-muted ml-1">&gt;85%</span>
            </div>
            <span className="text-border">/</span>
            <div>
              <span className="text-2xl font-bold font-mono text-red-400">
                {stats.exhaustedCount}
              </span>
              <span className="text-xs text-text-muted ml-1">exhausted</span>
            </div>
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
              placeholder="Filter by model, combo, or provider..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-[#F43F5E]"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="inline-flex rounded-lg bg-bg-subtle p-0.5 border border-border text-xs">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "all" ? "bg-bg-card text-text-main shadow-xs" : "text-text-muted hover:text-text-main"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("model")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "model" ? "bg-bg-card text-text-main shadow-xs" : "text-text-muted hover:text-text-main"
              }`}
            >
              Models
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("combo")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                typeFilter === "combo" ? "bg-bg-card text-text-main shadow-xs" : "text-text-muted hover:text-text-main"
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
            <option value="healthy">Healthy (&lt;85%)</option>
            <option value="near_limit">Near Limit (&gt;85%)</option>
            <option value="exhausted">Exhausted (100%)</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <span className="text-xs text-text-muted font-medium">
          Showing {filteredLimits.length} of {limits.length} policies
        </span>
      </Card>

      {/* ── Limits Table ── */}
      <Card className="overflow-hidden border border-border bg-bg-card">
        {filteredLimits.length === 0 ? (
          <div className="py-14 text-center flex flex-col items-center justify-center gap-3">
            <div className="size-12 rounded-full bg-bg-subtle border border-border flex items-center justify-center text-text-muted">
              <span className="material-symbols-outlined text-2xl">speed</span>
            </div>
            <h3 className="text-base font-semibold text-text-main">No Limit Policies Configured</h3>
            <p className="text-xs text-text-muted max-w-sm">
              Click &quot;Create Limit Policy&quot; above to set up token pool budgets, RPM throttles, or fallback rules for models and combos.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F43F5E] text-white text-xs font-medium hover:bg-[#e11d48] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Create First Limit Policy</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-bg-subtle/60 text-text-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Target (Model / Combo)</th>
                  <th className="py-3 px-4 min-w-[240px]">Token Pool & Progress</th>
                  <th className="py-3 px-4 text-center">Velocity (RPM / TPM)</th>
                  <th className="py-3 px-4 text-center">Renewal & Exhaustion</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLimits.map((policy) => {
                  const percent = policy.consumptionPercent;
                  let barColor = "bg-emerald-500";
                  let percentColor = "text-emerald-400";
                  if (policy.status === "exhausted") {
                    barColor = "bg-red-500";
                    percentColor = "text-red-400";
                  } else if (policy.status === "near_limit") {
                    barColor = "bg-amber-500";
                    percentColor = "text-amber-400";
                  }

                  return (
                    <tr key={policy.id} className="hover:bg-bg-subtle/40 transition-colors">
                      {/* Column 1: Target info */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                policy.targetType === "combo"
                                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                  : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {policy.targetType}
                            </span>
                            <span className="font-semibold text-text-main text-sm">
                              {policy.targetName}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-text-muted">
                            {policy.targetId}
                          </span>
                        </div>
                      </td>

                      {/* Column 2: Token Pool & Progress */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-text-muted">
                              <span className="font-bold font-mono text-text-main">
                                {formatTokens(policy.consumedTokens)}
                              </span>{" "}
                              / {formatTokens(policy.totalTokenPool)}
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

                          <div className="text-[10px] text-text-muted flex justify-between">
                            <span>Remaining: <strong className="text-text-main font-mono">{formatTokens(policy.remainingTokens)}</strong></span>
                            {policy.status === "exhausted" && (
                              <span className="text-red-400 font-semibold">Exhausted</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Velocity RPM / TPM */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        <div className="inline-flex flex-col gap-1 items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-subtle border border-border text-[11px] font-mono text-text-main">
                            <span className="material-symbols-outlined text-[13px] text-blue-400">speed</span>
                            {policy.rpmLimit ? `${policy.rpmLimit} req/min` : "Unlimited RPM"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-subtle border border-border text-[10px] font-mono text-text-muted">
                            {policy.tpmLimit ? `${formatTokens(policy.tpmLimit)} tpm` : "Unlimited TPM"}
                          </span>
                        </div>
                      </td>

                      {/* Column 4: Reset & Exhaustion */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        <div className="inline-flex flex-col gap-1 items-center">
                          <span className="px-2 py-0.5 rounded bg-bg-subtle text-[11px] font-medium text-text-muted capitalize">
                            {policy.resetWindow} reset
                          </span>
                          {policy.onExhaustion === "fallback" ? (
                            <span
                              className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-medium max-w-[130px] truncate"
                              title={`Fallback target: ${policy.fallbackTarget}`}
                            >
                              Fallback: {policy.fallbackTarget || "auto"}
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-medium max-w-[130px] truncate"
                              title={policy.customErrorMessage || "Standard 429 Error"}
                            >
                              429 Block
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-3.5 px-4 text-center align-middle">
                        {policy.status === "healthy" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
                            <span className="size-1.5 rounded-full bg-emerald-400" />
                            Healthy
                          </span>
                        )}
                        {policy.status === "near_limit" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-medium">
                            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Near Limit
                          </span>
                        )}
                        {policy.status === "exhausted" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] font-medium">
                            <span className="size-1.5 rounded-full bg-red-400" />
                            Exhausted
                          </span>
                        )}
                        {policy.status === "paused" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-400 border border-gray-500/30 text-[11px] font-medium">
                            <span className="size-1.5 rounded-full bg-gray-400" />
                            Paused
                          </span>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-4 text-right align-middle">
                        <div className="inline-flex items-center gap-1">
                          {/* Quick Add Tokens */}
                          <button
                            type="button"
                            onClick={() => {
                              setAddTokensTarget(policy);
                              setTokensToAdd(100_000_000);
                            }}
                            className="p-1.5 rounded hover:bg-bg-subtle text-text-muted hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Add Tokens to Pool"
                          >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                          </button>

                          {/* Pause / Resume */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(policy.id, policy.isActive)}
                            className="p-1.5 rounded hover:bg-bg-subtle text-text-muted hover:text-text-main transition-colors cursor-pointer"
                            title={policy.isActive ? "Pause Policy" : "Resume Policy"}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {policy.isActive ? "pause" : "play_arrow"}
                            </span>
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(policy)}
                            className="p-1.5 rounded hover:bg-bg-subtle text-text-muted hover:text-text-main transition-colors cursor-pointer"
                            title="Edit Policy"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(policy.id, policy.targetName)}
                            className="p-1.5 rounded hover:bg-bg-subtle text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Policy"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: Create / Edit Limit Policy ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F43F5E] text-[22px]">speed</span>
                {editingId ? "Edit Limit Policy" : "Create Limit Policy"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-md"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSavePolicy} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Target Type & Target Selector */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Select Target Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(editingId)}
                    onClick={() => {
                      setFormTargetType("model");
                      setFormTargetId(availableModels[0]?.id || "");
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formTargetType === "model"
                        ? "bg-[#F43F5E]/15 border-[#F43F5E] text-[#F43F5E]"
                        : "bg-bg-subtle border-border text-text-muted hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">neurology</span>
                    <span>AI Model</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(editingId)}
                    onClick={() => {
                      setFormTargetType("combo");
                      setFormTargetId(availableCombos[0]?.id || "");
                    }}
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formTargetType === "combo"
                        ? "bg-purple-500/15 border-purple-500 text-purple-400"
                        : "bg-bg-subtle border-border text-text-muted hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">layers</span>
                    <span>Smart Combo Pipeline</span>
                  </button>
                </div>

                {/* Target Dropdown */}
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1">
                    Choose {formTargetType === "model" ? "Model" : "Combo"}
                  </label>
                  <select
                    value={formTargetId}
                    disabled={Boolean(editingId)}
                    onChange={(e) => setFormTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-main focus:outline-none focus:border-[#F43F5E]"
                  >
                    {formTargetType === "model" ? (
                      availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id} {m.provider ? `(${m.provider})` : ""}
                        </option>
                      ))
                    ) : (
                      availableCombos.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.id} ({c.strategy || "pipeline"})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Total Token Budget Pool */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                    Total Token Pool Budget
                  </label>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {formatTokens(formTotalPool)} Tokens
                  </span>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_POOLS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setFormTotalPool(p.value)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                        formTotalPool === p.value
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                          : "bg-bg-subtle text-text-muted border border-border hover:text-text-main"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="1"
                  value={formTotalPool}
                  onChange={(e) => setFormTotalPool(Math.max(1, toNumber(e.target.value, 1)))}
                  className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-main font-mono focus:outline-none focus:border-[#F43F5E]"
                  placeholder="e.g. 1000000000"
                />
              </div>

              {/* Velocity Controls: RPM & TPM */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1">
                    RPM (Requests Per Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formRpmLimit}
                    onChange={(e) => setFormRpmLimit(e.target.value)}
                    placeholder="e.g. 60 (leave empty for unlimited)"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main font-mono focus:outline-none focus:border-[#F43F5E]"
                  />
                  <span className="text-[10px] text-text-muted">Protects against spam spikes</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1">
                    TPM (Tokens Per Min)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    value={formTpmLimit}
                    onChange={(e) => setFormTpmLimit(e.target.value)}
                    placeholder="e.g. 500000 (leave empty for unlimited)"
                    className="w-full px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main font-mono focus:outline-none focus:border-[#F43F5E]"
                  />
                  <span className="text-[10px] text-text-muted">Throughput velocity cap</span>
                </div>
              </div>

              {/* Reset Window */}
              <div className="pt-2 border-t border-border">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
                  Quota Renewal Window
                </label>
                <select
                  value={formResetWindow}
                  onChange={(e) => setFormResetWindow(e.target.value as LimitResetWindow)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-xs text-text-main focus:outline-none focus:border-[#F43F5E]"
                >
                  <option value="lifetime">Lifetime / Fixed Pool (No Auto Reset)</option>
                  <option value="monthly">Monthly Calendar Reset (1st of each month)</option>
                  <option value="weekly">Weekly Reset (Every Monday)</option>
                  <option value="daily">Daily Reset (Midnight UTC)</option>
                </select>
              </div>

              {/* On Exhaustion Action */}
              <div className="pt-2 border-t border-border space-y-2">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  Action on Limit Exhaustion (Jab Limit Khatam Ho Jaye)
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOnExhaustion("error")}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      formOnExhaustion === "error"
                        ? "bg-red-500/15 border-red-500 text-red-400 font-semibold"
                        : "bg-bg-subtle border-border text-text-muted hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">block</span>
                    <span>Block (HTTP 429)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormOnExhaustion("fallback")}
                    className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      formOnExhaustion === "fallback"
                        ? "bg-purple-500/15 border-purple-500 text-purple-400 font-semibold"
                        : "bg-bg-subtle border-border text-text-muted hover:text-text-main"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">alt_route</span>
                    <span>Auto-Fallback Target</span>
                  </button>
                </div>

                {formOnExhaustion === "fallback" ? (
                  <div>
                    <label className="text-xs text-text-muted block mb-1">
                      Select Backup Target for Fallback:
                    </label>
                    <select
                      value={formFallbackTarget}
                      onChange={(e) => setFormFallbackTarget(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main focus:outline-none"
                    >
                      <option value="">-- Choose Fallback Model or Combo --</option>
                      <optgroup label="Models">
                        {availableModels.map((m) => (
                          <option key={`fb-m-${m.id}`} value={m.id}>
                            Model: {m.name || m.id}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Combos">
                        {availableCombos.map((c) => (
                          <option key={`fb-c-${c.id}`} value={c.id}>
                            Combo: {c.name || c.id}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-text-muted block mb-1">
                      Custom 429 Error Message (Optional):
                    </label>
                    <input
                      type="text"
                      value={formCustomError}
                      onChange={(e) => setFormCustomError(e.target.value)}
                      placeholder="e.g. Quota limit of 1 Billion tokens has been exhausted. Contact admin."
                      className="w-full px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main placeholder:text-text-muted focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-bg-subtle border border-border text-xs font-medium text-text-muted hover:text-text-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#F43F5E] hover:bg-[#e11d48] text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving Policy..." : editingId ? "Update Policy" : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Quick Add Tokens ── */}
      {addTokensTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-bg-card border border-border rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">add_circle</span>
                Add Tokens to Pool
              </h3>
              <button
                type="button"
                onClick={() => setAddTokensTarget(null)}
                className="text-text-muted hover:text-text-main"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-muted">Target Policy:</span>
              <div className="text-sm font-semibold text-text-main">{addTokensTarget.targetName}</div>
              <div className="text-xs text-text-muted">
                Current Pool: <strong className="font-mono text-text-main">{formatTokens(addTokensTarget.totalTokenPool)}</strong> (Consumed: {formatTokens(addTokensTarget.consumedTokens)})
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted block">
                Select Amount to Add:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 2_000_000_000, 5_000_000_000].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTokensToAdd(num)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
                      tokensToAdd === num
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 font-bold"
                        : "bg-bg-subtle text-text-muted border-border hover:text-text-main"
                    }`}
                  >
                    +{formatTokens(num)}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1000"
                value={tokensToAdd}
                onChange={(e) => setTokensToAdd(Math.max(1, toNumber(e.target.value, 1)))}
                className="w-full px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-main font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setAddTokensTarget(null)}
                className="px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-muted hover:text-text-main cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddTokens}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Add {formatTokens(tokensToAdd)} Tokens
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
