"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Card from "@/shared/components/Card";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { fmtCompact as fmt, fmtFull, fmtCost } from "@/shared/utils/formatting";
import { useRecharts, DarkTooltip, ChartLoadingCard } from "@/shared/components/analytics/rechartsCore";
import { getModelColor } from "@/shared/constants/colors";
import { matchesSearch } from "@/shared/utils/turkishText";
import { cn } from "@/shared/utils/cn";

interface ProviderData {
  provider: string;
  displayName?: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  lastUsed?: string;
}

interface ModelData {
  model: string;
  provider: string;
  rawModel?: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  avgLatencyMs?: number;
  cost?: number;
  lastUsed?: string;
}

interface ProviderDailyRow {
  date: string;
  provider: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface AnalyticsPayload {
  summary: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalRequests: number;
    uniqueModels: number;
    totalCost?: number;
    avgLatencyMs?: number;
  };
  byProvider: ProviderData[];
  byModel: ModelData[];
  dailyTrend: Array<{
    date: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  }>;
  dailyByModel?: Record<string, Record<string, number>>;
}

const RANGE_OPTIONS = [
  { value: "1d", label: "24h" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

export default function UsageDashboardClient() {
  const [range, setRange] = useState("30d");
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [providerDailyRows, setProviderDailyRows] = useState<ProviderDailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayMode, setDisplayMode] = useState<"compact" | "exact">("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [selectedChartProvider, setSelectedChartProvider] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"tokens" | "requests">("tokens");

  const recharts = useRecharts();

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams({
        range,
        includeFlatRateEstimates: "true",
      });

      const [resAnalytics, resProviderDaily] = await Promise.all([
        fetch(`/api/usage/analytics?${params.toString()}`),
        fetch(`/api/usage/requests-by-provider-date?${params.toString()}`).catch(() => null),
      ]);

      if (!resAnalytics.ok) {
        throw new Error("Failed to load usage analytics");
      }

      const dataAnalytics = (await resAnalytics.json()) as AnalyticsPayload;
      setAnalytics(dataAnalytics);

      if (resProviderDaily && resProviderDaily.ok) {
        const dataDaily = await resProviderDaily.json();
        setProviderDailyRows(Array.isArray(dataDaily.rows) ? dataDaily.rows : []);
      } else {
        setProviderDailyRows([]);
      }

      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading usage data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const map: Record<string, ModelData[]> = {};
    if (!analytics?.byModel) return map;

    for (const m of analytics.byModel) {
      const pid = (m.provider || "other").toLowerCase();
      if (!map[pid]) map[pid] = [];
      map[pid].push(m);
    }

    // Sort models inside each provider by total tokens descending
    for (const pid of Object.keys(map)) {
      map[pid].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
    }

    return map;
  }, [analytics]);

  // Active providers (only those with > 0 tokens or requests)
  const activeProviders = useMemo(() => {
    if (!analytics?.byProvider) return [];

    return analytics.byProvider
      .filter((p) => (p.totalTokens || 0) > 0 || (p.requests || 0) > 0)
      .sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
  }, [analytics]);

  // Filtered providers based on search query
  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return activeProviders;

    return activeProviders.filter((p) => {
      const pName = p.displayName || p.provider;
      const pId = p.provider;
      if (matchesSearch(pName, q) || matchesSearch(pId, q)) return true;

      // Also check if any model inside matches
      const models = modelsByProvider[pId.toLowerCase()] || [];
      return models.some((m) => matchesSearch(m.model, q));
    });
  }, [activeProviders, searchQuery, modelsByProvider]);

  // Toggle expansion for a provider
  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProviders(new Set(activeProviders.map((p) => p.provider)));
  };

  const collapseAll = () => {
    setExpandedProviders(new Set());
  };

  // Format tokens based on displayMode
  const formatTokens = (val: number | null | undefined) => {
    const num = val || 0;
    return displayMode === "compact" ? fmt(num) : fmtFull(num);
  };

  // Timeline chart data preparation
  const timelineChartData = useMemo(() => {
    if (!selectedChartProvider) {
      // All Providers Mode: Pivot providerDailyRows by date
      if (providerDailyRows.length > 0) {
        const byDate: Record<string, Record<string, number>> = {};
        const datesSet = new Set<string>();

        for (const row of providerDailyRows) {
          datesSet.add(row.date);
          if (!byDate[row.date]) byDate[row.date] = {};
          const pid = row.provider.toLowerCase();
          const val = chartMetric === "tokens" ? row.totalTokens : row.requests;
          byDate[row.date][pid] = (byDate[row.date][pid] || 0) + val;
        }

        const sortedDates = Array.from(datesSet).sort();
        return sortedDates.map((d) => {
          const item: Record<string, string | number> = {
            date: d.length > 5 ? d.slice(5) : d,
            rawDate: d,
          };
          let total = 0;
          for (const p of activeProviders) {
            const pid = p.provider.toLowerCase();
            const val = byDate[d]?.[pid] || 0;
            item[p.displayName || p.provider] = val;
            total += val;
          }
          item.total = total;
          return item;
        });
      }

      // Fallback: dailyTrend from analytics
      return (analytics?.dailyTrend || []).map((d) => ({
        date: d.date.length > 5 ? d.date.slice(5) : d.date,
        rawDate: d.date,
        Input: d.promptTokens,
        Output: d.completionTokens,
        total: d.totalTokens,
        requests: d.requests,
      }));
    } else {
      // Specific Provider Mode: Show daily tokens for this provider
      const targetPid = selectedChartProvider.toLowerCase();
      const rowsForProv = providerDailyRows.filter(
        (r) => r.provider.toLowerCase() === targetPid
      );

      return rowsForProv.map((r) => ({
        date: r.date.length > 5 ? r.date.slice(5) : r.date,
        rawDate: r.date,
        Input: r.promptTokens,
        Output: r.completionTokens,
        total: r.totalTokens,
        requests: r.requests,
      }));
    }
  }, [
    selectedChartProvider,
    providerDailyRows,
    analytics?.dailyTrend,
    activeProviders,
    chartMetric,
  ]);

  const totalTokensOverall = analytics?.summary?.totalTokens || 0;
  const promptTokensOverall = analytics?.summary?.promptTokens || 0;
  const completionTokensOverall = analytics?.summary?.completionTokens || 0;
  const totalRequestsOverall = analytics?.summary?.totalRequests || 0;
  const totalCostOverall = analytics?.summary?.totalCost || 0;
  const activeProvidersCount = activeProviders.length;
  const activeModelsCount = (analytics?.byModel || []).filter(
    (m) => (m.totalTokens || 0) > 0
  ).length;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Top Header & Controls ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="material-symbols-outlined text-[24px]">data_usage</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-text-main">
                Token & Provider Usage
              </h1>
              <p className="text-xs md:text-sm text-text-muted mt-0.5">
                Real-time token consumption, active providers, and model-level breakdown
              </p>
            </div>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div
            role="tablist"
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-bg-subtle p-1"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  range === opt.value
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text-main hover:bg-surface"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Display Mode Toggle */}
          <div className="inline-flex items-center rounded-lg border border-border bg-bg-subtle p-1">
            <button
              type="button"
              onClick={() => setDisplayMode("compact")}
              title="Compact numbers (e.g. 1.2M)"
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                displayMode === "compact"
                  ? "bg-surface text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              )}
            >
              1.2M
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("exact")}
              title="Exact numbers (e.g. 1,234,567)"
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1",
                displayMode === "exact"
                  ? "bg-surface text-text-main shadow-xs"
                  : "text-text-muted hover:text-text-main"
              )}
            >
              123k
            </button>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            title="Refresh statistics"
            className="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text-main hover:bg-bg-subtle transition-all disabled:opacity-50"
          >
            <span
              className={cn(
                "material-symbols-outlined text-[18px]",
                refreshing && "animate-spin"
              )}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens Card */}
        <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-surface to-surface/80 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Total Tokens
            </span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">token</span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-text-main">
              {loading ? "..." : formatTokens(totalTokensOverall)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              In: {formatTokens(promptTokensOverall)}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              Out: {formatTokens(completionTokensOverall)}
            </span>
          </div>
        </Card>

        {/* Active Providers Card */}
        <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-surface to-surface/80 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Active Providers
            </span>
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">dns</span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-text-main">
              {loading ? "..." : activeProvidersCount}
            </span>
            <span className="text-xs text-text-muted">active</span>
          </div>
          <p className="mt-2.5 text-xs text-text-muted truncate">
            {activeProvidersCount === 0
              ? "No provider activity yet"
              : `${activeProvidersCount} providers processed traffic`}
          </p>
        </Card>

        {/* Active Models Card */}
        <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-surface to-surface/80 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Active Models
            </span>
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-text-main">
              {loading ? "..." : activeModelsCount}
            </span>
            <span className="text-xs text-text-muted">models</span>
          </div>
          <p className="mt-2.5 text-xs text-text-muted truncate">
            Across {activeProvidersCount} active provider connection{activeProvidersCount !== 1 ? "s" : ""}
          </p>
        </Card>

        {/* Total Requests & Cost Card */}
        <Card className="p-4 relative overflow-hidden bg-gradient-to-br from-surface to-surface/80 border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Total Requests
            </span>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-text-main">
              {loading ? "..." : fmtFull(totalRequestsOverall)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-text-muted">
            <span>Est. Spend:</span>
            <span className="font-mono font-medium text-amber-500">
              {fmtCost(totalCostOverall)}
            </span>
          </div>
        </Card>
      </div>

      {/* ── Analytics & Timeline Chart Section ───────────────────────────── */}
      <Card className="p-5 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">
                show_chart
              </span>
              <h2 className="text-base font-bold text-text-main">
                {selectedChartProvider
                  ? `${selectedChartProvider.toUpperCase()} — Usage Over Time`
                  : "Token & Provider Consumption Over Time"}
              </h2>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {selectedChartProvider
                ? "Daily input and output token distribution for this provider"
                : "Daily comparison across active providers (click a provider pill to focus)"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Metric Switcher */}
            <div className="inline-flex items-center rounded-lg border border-border bg-bg-subtle p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartMetric("tokens")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-all",
                  chartMetric === "tokens"
                    ? "bg-surface text-text-main shadow-xs"
                    : "text-text-muted hover:text-text-main"
                )}
              >
                Tokens
              </button>
              <button
                type="button"
                onClick={() => setChartMetric("requests")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-all",
                  chartMetric === "requests"
                    ? "bg-surface text-text-main shadow-xs"
                    : "text-text-muted hover:text-text-main"
                )}
              >
                Requests
              </button>
            </div>

            {selectedChartProvider && (
              <button
                type="button"
                onClick={() => setSelectedChartProvider(null)}
                className="px-2 py-1 text-xs rounded-md border border-border bg-surface text-text-muted hover:text-text-main flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                Reset Focus
              </button>
            )}
          </div>
        </div>

        {/* Provider Focus Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-2 border-b border-border/50">
          <span className="text-xs font-medium text-text-muted mr-1">Filter Chart:</span>
          <button
            type="button"
            onClick={() => setSelectedChartProvider(null)}
            className={cn(
              "px-2.5 py-0.5 text-xs rounded-full font-medium transition-all",
              selectedChartProvider === null
                ? "bg-primary text-white"
                : "bg-surface border border-border text-text-muted hover:text-text-main"
            )}
          >
            All Providers
          </button>
          {activeProviders.map((p) => {
            const isSelected =
              selectedChartProvider?.toLowerCase() === p.provider.toLowerCase();
            return (
              <button
                key={p.provider}
                type="button"
                onClick={() =>
                  setSelectedChartProvider(isSelected ? null : p.provider)
                }
                className={cn(
                  "px-2.5 py-0.5 text-xs rounded-full font-medium transition-all flex items-center gap-1.5",
                  isSelected
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-surface border border-border text-text-muted hover:text-text-main"
                )}
              >
                <ProviderIcon providerId={p.provider} size={14} type="color" />
                <span>{p.displayName || p.provider}</span>
                <span className="opacity-70 text-[10px] font-mono">
                  ({formatTokens(p.totalTokens)})
                </span>
              </button>
            );
          })}
        </div>

        {/* Render Chart */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            Loading timeline data...
          </div>
        ) : timelineChartData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-text-muted text-sm">
            <span className="material-symbols-outlined text-[36px] mb-2 opacity-40">
              analytics
            </span>
            <span>No usage recorded for the selected time window.</span>
          </div>
        ) : recharts ? (
          (() => {
            const {
              ResponsiveContainer,
              AreaChart,
              Area,
              XAxis,
              YAxis,
              Tooltip,
              CartesianGrid,
            } = recharts;

            return (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timelineChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="secondaryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => (displayMode === "compact" ? fmt(val) : val)}
                      width={48}
                    />
                    <Tooltip
                      content={
                        <DarkTooltip
                          formatter={(v: number) =>
                            displayMode === "compact" ? fmt(v) : fmtFull(v)
                          }
                        />
                      }
                    />
                    {selectedChartProvider ? (
                      <>
                        <Area
                          type="monotone"
                          dataKey="Input"
                          name="Input Tokens"
                          stroke="#3B82F6"
                          fill="url(#secondaryGradient)"
                          strokeWidth={2}
                          stackId="1"
                        />
                        <Area
                          type="monotone"
                          dataKey="Output"
                          name="Output Tokens"
                          stroke="#10B981"
                          fill="url(#primaryGradient)"
                          strokeWidth={2}
                          stackId="1"
                        />
                      </>
                    ) : providerDailyRows.length > 0 ? (
                      activeProviders.slice(0, 8).map((p, idx) => {
                        const color = getModelColor(idx);
                        const keyName = p.displayName || p.provider;
                        return (
                          <Area
                            key={p.provider}
                            type="monotone"
                            dataKey={keyName}
                            name={keyName}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            stackId="provStack"
                          />
                        );
                      })
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="Input"
                          name="Input Tokens"
                          stroke="#3B82F6"
                          fill="url(#secondaryGradient)"
                          strokeWidth={2}
                          stackId="a"
                        />
                        <Area
                          type="monotone"
                          dataKey="Output"
                          name="Output Tokens"
                          stroke="#10B981"
                          fill="url(#primaryGradient)"
                          strokeWidth={2}
                          stackId="a"
                        />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })()
        ) : (
          <ChartLoadingCard />
        )}
      </Card>

      {/* ── Provider & Model Accordion Section ───────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Section Title & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-500">
                tune
              </span>
              <span>Providers & Models Breakdown</span>
              <span className="text-xs font-normal text-text-muted px-2 py-0.5 rounded-full bg-bg-subtle border border-border">
                {activeProviders.length} Active
              </span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Click any provider to uncollapse and inspect its model-wise token consumption
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
                search
              </span>
              <input
                type="text"
                placeholder="Search provider or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-60 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-surface text-text-muted hover:text-text-main hover:bg-bg-subtle transition-all"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 text-xs rounded-lg border border-border bg-surface text-text-muted hover:text-text-main hover:bg-bg-subtle transition-all"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>

        {/* List of Provider Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-6 w-48 bg-border/40 rounded mb-3" />
                <div className="h-4 w-72 bg-border/20 rounded" />
              </Card>
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="size-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3 text-text-muted">
              <span className="material-symbols-outlined text-[24px]">inbox</span>
            </div>
            <h3 className="text-sm font-semibold text-text-main">No Provider Usage Found</h3>
            <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "No providers or models matched your search query."
                : "No provider has consumed tokens yet in the selected time range. Send requests through the OmniRoute endpoint to see live metrics."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredProviders.map((provider) => {
              const pid = provider.provider.toLowerCase();
              const isExpanded = expandedProviders.has(provider.provider);
              const models = modelsByProvider[pid] || [];
              const tokenSharePct =
                totalTokensOverall > 0
                  ? ((provider.totalTokens / totalTokensOverall) * 100).toFixed(1)
                  : "0";

              return (
                <div
                  key={provider.provider}
                  className="rounded-xl border border-border bg-surface overflow-hidden transition-all shadow-xs"
                >
                  {/* Provider Header / Summary Row */}
                  <div
                    onClick={() => toggleProvider(provider.provider)}
                    className="p-4 cursor-pointer hover:bg-bg-subtle/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                  >
                    {/* Left: Icon, Name & Model Count */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="p-2 rounded-lg bg-bg-subtle border border-border/80 shrink-0">
                        <ProviderIcon providerId={provider.provider} size={24} type="color" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-text-main">
                            {provider.displayName || provider.provider}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-bg-subtle border border-border text-text-muted">
                            {provider.provider}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                          <span>{models.length} model{models.length !== 1 ? "s" : ""}</span>
                          <span>•</span>
                          <span>{fmtFull(provider.requests)} requests</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Token Metrics & Share Bar */}
                    <div className="flex-1 max-w-md">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-text-muted">
                          Share: <span className="font-medium text-text-main">{tokenSharePct}%</span>
                        </span>
                        <span className="font-mono font-medium text-emerald-500">
                          {formatTokens(provider.totalTokens)} tokens
                        </span>
                      </div>
                      {/* Visual progress bar */}
                      <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(2, Number(tokenSharePct)))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-text-muted mt-1.5">
                        <span>Prompt: {formatTokens(provider.promptTokens)}</span>
                        <span>Completion: {formatTokens(provider.completionTokens)}</span>
                      </div>
                    </div>

                    {/* Right: Cost & Expand Chevron */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                      {provider.cost !== undefined && provider.cost > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-text-muted block">Est. Cost</span>
                          <span className="text-xs font-mono font-medium text-amber-500">
                            {fmtCost(provider.cost)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-bg-subtle text-xs font-medium text-text-main">
                        <span>{isExpanded ? "Collapse" : "Models"}</span>
                        <span
                          className={cn(
                            "material-symbols-outlined text-[16px] transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded Models Breakdown Section ──────────────── */}
                  {isExpanded && (
                    <div className="border-t border-border bg-bg-subtle/30 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">psychology</span>
                          <span>Models Used Under {provider.displayName || provider.provider}</span>
                        </div>
                        <span className="text-[11px] text-text-muted">
                          Showing {models.length} model{models.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {models.length === 0 ? (
                        <div className="text-center py-6 text-xs text-text-muted bg-surface rounded-lg border border-border">
                          No individual model breakdown available for this provider.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-bg-subtle/80 border-b border-border text-text-muted font-medium">
                              <tr>
                                <th className="py-2.5 px-3">Model</th>
                                <th className="py-2.5 px-3 text-right">Input Tokens</th>
                                <th className="py-2.5 px-3 text-right">Output Tokens</th>
                                <th className="py-2.5 px-3 text-right">Total Tokens</th>
                                <th className="py-2.5 px-3 text-right">Requests</th>
                                <th className="py-2.5 px-3 text-right">Avg Latency</th>
                                <th className="py-2.5 px-3 text-right">Est. Cost</th>
                                <th className="py-2.5 px-3 w-28">Share</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 font-mono">
                              {models.map((m, mIdx) => {
                                const modelSharePct =
                                  provider.totalTokens > 0
                                    ? ((m.totalTokens / provider.totalTokens) * 100).toFixed(1)
                                    : "0";
                                const modelColor = getModelColor(mIdx);

                                return (
                                  <tr
                                    key={m.model}
                                    className="hover:bg-bg-subtle/40 transition-colors"
                                  >
                                    {/* Model Name */}
                                    <td className="py-2.5 px-3 font-sans">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="size-2 rounded-full shrink-0"
                                          style={{ backgroundColor: modelColor }}
                                        />
                                        <span className="font-medium text-text-main font-mono text-xs">
                                          {m.model}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Input Tokens */}
                                    <td className="py-2.5 px-3 text-right text-text-muted">
                                      {formatTokens(m.promptTokens)}
                                    </td>

                                    {/* Output Tokens */}
                                    <td className="py-2.5 px-3 text-right text-text-muted">
                                      {formatTokens(m.completionTokens)}
                                    </td>

                                    {/* Total Tokens */}
                                    <td className="py-2.5 px-3 text-right font-medium text-emerald-500">
                                      {formatTokens(m.totalTokens)}
                                    </td>

                                    {/* Requests */}
                                    <td className="py-2.5 px-3 text-right text-text-main">
                                      {fmtFull(m.requests)}
                                    </td>

                                    {/* Latency */}
                                    <td className="py-2.5 px-3 text-right text-text-muted">
                                      {m.avgLatencyMs ? `${m.avgLatencyMs}ms` : "—"}
                                    </td>

                                    {/* Cost */}
                                    <td className="py-2.5 px-3 text-right text-amber-500">
                                      {m.cost !== undefined && m.cost > 0
                                        ? fmtCost(m.cost)
                                        : "—"}
                                    </td>

                                    {/* Visual Model Share */}
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center gap-1.5">
                                        <div className="h-1.5 flex-1 bg-border/40 rounded-full overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${Math.min(100, Math.max(3, Number(modelSharePct)))}%`,
                                              backgroundColor: modelColor,
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-text-muted w-7 text-right">
                                          {modelSharePct}%
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
