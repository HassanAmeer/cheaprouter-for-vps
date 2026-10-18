"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import Card from "@/shared/components/Card";
import { toNumber } from "@/shared/utils/numeric";
import { isProviderConnectionConnected } from "@/shared/utils/providerConnectionStatus";
import {
  ChartLoadingCard,
  DarkTooltip,
  useRecharts,
} from "@/shared/components/analytics/rechartsCore";

/** Per-provider shape produced by HomePageClient's `providerStats` memo. */
export type HomeProviderStat = {
  id: string;
  provider: {
    id: string;
    name: string;
    color?: string;
    textIcon?: string;
    alias?: string;
  };
  total: number;
  connected: number;
  errors: number;
  modelCount: number;
};

type HomeAnalyticsProps = {
  /** Per-provider connection rollup (id, total, connected, errors). */
  providerStats: HomeProviderStat[];
  /** Count of self-defined provider nodes (openai-compatible-* style). */
  customProviders: number;
  /** Self-defined provider nodes (with prefix, isActive, etc.). */
  providerNodes?: Array<{ id?: string; prefix?: string; name?: string; isActive?: boolean }>;
  /** Provider connection records. */
  providerConnections?: Array<{
    id?: string;
    provider?: string;
    isActive?: boolean;
    testStatus?: string;
  }>;
  /** Topology & recent requests section passed to be rendered above charts. */
  topologySection?: React.ReactNode;
};

type AnalyticsSummary = {
  totalRequests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  uniqueModels: number;
  successfulRequests: number;
  successRatePct: number;
  avgLatencyMs: number;
};

type DailyTrendPoint = {
  date: string;
  requests: number;
  totalTokens: number;
  cost: number;
};

type ModelRow = {
  model: string;
  provider: string;
  requests: number;
  totalTokens: number;
  cost: number;
};

type TimelinePoint = {
  date: string;
  label: string;
  count: number;
  details: string[];
};

/** 101233 -> "101.2K", 4200000 -> "4.2M" — keeps stat cards on one line. */
function compactNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) >= 1_000_000_000) return `${(safe / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(safe) >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (Math.abs(safe) >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return String(Math.round(safe));
}

/** Formats token count specifically in Billions (e.g. "1.25B", "0.00B") with fallback. */
function formatTokensInBillions(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe === 0) return "0.00B";
  const billions = safe / 1_000_000_000;
  if (billions >= 1) {
    return `${billions.toFixed(2)}B`;
  }
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(2)}M`;
  }
  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(1)}K`;
  }
  return `${billions.toFixed(2)}B`;
}

/** Formats token count specifically in Millions (e.g. "50M", "1,000M (1B)"). */
function formatTokensInMillions(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (safe <= 0) return "0M";
  const millions = safe / 1_000_000;
  if (millions >= 1000) {
    const billions = safe / 1_000_000_000;
    return `${Math.round(millions).toLocaleString()}M (${billions.toFixed(billions % 1 === 0 ? 0 : 2)}B)`;
  }
  if (millions >= 1) {
    return `${millions % 1 === 0 ? millions : Number(millions.toFixed(2))}M`;
  }
  return `${Number((safe / 1_000_000).toFixed(3))}M`;
}

/** Groups items by date string (YYYY-MM-DD) for timeline charts. */
function groupItemsByDate<T>(
  items: T[],
  getDate: (item: T) => string | null | undefined,
  getLabel: (item: T) => string
): TimelinePoint[] {
  const map = new Map<string, string[]>();
  for (const item of items) {
    const rawDate = getDate(item);
    if (!rawDate) continue;
    const dateStr = String(rawDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const label = getLabel(item);
    const existing = map.get(dateStr) || [];
    existing.push(label);
    map.set(dateStr, existing);
  }
  return Array.from(map.entries())
    .map(([date, details]) => ({
      date,
      label: date.slice(5),
      count: details.length,
      details,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function computeRpmFromLogs(logs: any[], totalRequests?: number, rangeMinutes?: number) {
  const now = Date.now();
  let currentRpm = 0;
  const timestamps: number[] = [];

  for (const log of logs) {
    if (!log) continue;
    const ts = Date.parse(String(log.timestamp || ""));
    if (Number.isFinite(ts)) {
      timestamps.push(ts);
      if (now - ts <= 60_000 || log.active) {
        currentRpm++;
      }
    }
  }

  // Calculate peak RPM by checking sliding 60s windows in timestamps
  let peakRpm = currentRpm;
  timestamps.sort((a, b) => b - a);
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    let count = 0;
    for (let j = i; j < timestamps.length; j++) {
      if (t - timestamps[j] <= 60_000) {
        count++;
      } else {
        break;
      }
    }
    if (count > peakRpm) peakRpm = count;
  }

  // Calculate average RPM based on range
  const mins = rangeMinutes && rangeMinutes > 0 ? rangeMinutes : 30 * 1440;
  const avgRpm = totalRequests && totalRequests > 0 ? totalRequests / mins : 0;

  return { currentRpm, peakRpm, avgRpm };
}

export default function HomeAnalytics({
  providerStats,
  customProviders,
  providerNodes = [],
  providerConnections = [],
  topologySection,
}: HomeAnalyticsProps) {
  const t = useTranslations("home");
  const recharts = useRecharts();

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([]);
  const [byModel, setByModel] = useState<ModelRow[]>([]);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [byokKeysCount, setByokKeysCount] = useState(0);
  const [pipedModelsCount, setPipedModelsCount] = useState(0);
  const [activeCombosCount, setActiveCombosCount] = useState(0);
  const [limitsStats, setLimitsStats] = useState({
    totalPolicies: 0,
    activePolicies: 0,
    totalCap: 0,
    remainingCap: 0,
    consumedCap: 0,
  });
  const [rpmStats, setRpmStats] = useState({
    currentRpm: 0,
    peakRpm: 0,
    avgRpm: 0,
  });
  const [isCardsExpanded, setIsCardsExpanded] = useState(true);

  // Scroll Container State for KPI cards
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  const handleScroll = useCallback(
    (direction: "left" | "right") => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const scrollAmount = Math.max(240, Math.floor(el.clientWidth * 0.7));
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 350);
    },
    [checkScroll]
  );

  useEffect(() => {
    const timer = setTimeout(checkScroll, 150);
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [checkScroll, isCardsExpanded, loading]);

  // Date Filter State
  const [selectedRange, setSelectedRange] = useState<string>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

  // Timeline lists
  const [usersList, setUsersList] = useState<Array<Record<string, any>>>([]);
  const [rawKeysList, setRawKeysList] = useState<Array<Record<string, any>>>([]);
  const [connectionsList, setConnectionsList] = useState<Array<Record<string, any>>>([]);

  // Function to load analytics with specific range / dates
  const fetchAnalyticsData = useCallback(async (range: string, start?: string, end?: string) => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (start && end) {
        params.set("startDate", new Date(start).toISOString());
        const endD = new Date(end);
        endD.setHours(23, 59, 59, 999);
        params.set("endDate", endD.toISOString());
      } else {
        params.set("range", range);
      }
      const res = await fetch(`/api/usage/analytics?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        const rawSummary = payload?.summary ?? {};
        const newSummary = {
          totalRequests: toNumber(rawSummary.totalRequests),
          promptTokens: toNumber(rawSummary.promptTokens),
          completionTokens: toNumber(rawSummary.completionTokens),
          totalTokens: toNumber(rawSummary.totalTokens),
          uniqueModels: toNumber(rawSummary.uniqueModels),
          successfulRequests: toNumber(rawSummary.successfulRequests),
          successRatePct: toNumber(rawSummary.successRatePct),
          avgLatencyMs: toNumber(rawSummary.avgLatencyMs),
        };
        setSummary(newSummary);
        setDailyTrend(
          Array.isArray(payload?.dailyTrend)
            ? payload.dailyTrend.map((point: Record<string, unknown>) => ({
                date: String(point.date ?? ""),
                requests: toNumber(point.requests),
                totalTokens: toNumber(point.totalTokens),
                cost: toNumber(point.cost),
              }))
            : []
        );
        setByModel(
          Array.isArray(payload?.byModel)
            ? payload.byModel.map((m: Record<string, unknown>) => ({
                model: String(m.model ?? ""),
                provider: String(m.provider ?? ""),
                requests: toNumber(m.requests),
                totalTokens: toNumber(m.totalTokens),
                cost: toNumber(m.cost),
              }))
            : []
        );

        let rangeMins = 30 * 1440;
        if (range === "1d") rangeMins = 1440;
        else if (range === "7d") rangeMins = 7 * 1440;
        else if (range === "30d") rangeMins = 30 * 1440;
        else if (range === "60d") rangeMins = 60 * 1440;
        else if (range === "90d") rangeMins = 90 * 1440;
        else if (start && end) {
          rangeMins = Math.max(
            1,
            Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000)
          );
        }

        try {
          const logsRes = await fetch("/api/usage/call-logs?limit=100&excludeTests=1", {
            cache: "no-store",
          });
          if (logsRes.ok) {
            const logsData = await logsRes.json();
            const logsList = Array.isArray(logsData)
              ? logsData
              : Array.isArray(logsData?.logs)
                ? logsData.logs
                : [];
            const rStats = computeRpmFromLogs(logsList, newSummary.totalRequests, rangeMins);
            setRpmStats(rStats);
          }
        } catch {
          // best-effort
        }
      }
    } catch {
      // transient analytics failure caught silently
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Initial metadata loading (Analytics, Keys, Curation, Combos, Users, Providers)
  useEffect(() => {
    const controller = new AbortController();

    async function initialLoad() {
      try {
        const [
          analyticsRes,
          keysRes,
          curationRes,
          combosRes,
          usersRes,
          providersRes,
          limitsRes,
          callLogsRes,
        ] = await Promise.all([
          fetch("/api/usage/analytics?range=30d", {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/keys", { signal: controller.signal, cache: "no-store" }).catch(() => null),
          fetch("/api/v1/models/curation", {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/combos", { signal: controller.signal, cache: "no-store" }).catch(() => null),
          fetch("/api/v1/reseller/users", {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null),
          fetch("/api/providers", { signal: controller.signal, cache: "no-store" }).catch(
            () => null
          ),
          fetch("/api/limits", { signal: controller.signal, cache: "no-store" }).catch(() => null),
          fetch("/api/usage/call-logs?limit=100&excludeTests=1", {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null),
        ]);

        let rawTotalRequests = 0;
        if (analyticsRes?.ok) {
          const payload = await analyticsRes.json();
          const rawSummary = payload?.summary ?? {};
          rawTotalRequests = toNumber(rawSummary.totalRequests);
          setSummary({
            totalRequests: rawTotalRequests,
            promptTokens: toNumber(rawSummary.promptTokens),
            completionTokens: toNumber(rawSummary.completionTokens),
            totalTokens: toNumber(rawSummary.totalTokens),
            uniqueModels: toNumber(rawSummary.uniqueModels),
            successfulRequests: toNumber(rawSummary.successfulRequests),
            successRatePct: toNumber(rawSummary.successRatePct),
            avgLatencyMs: toNumber(rawSummary.avgLatencyMs),
          });
          setDailyTrend(
            Array.isArray(payload?.dailyTrend)
              ? payload.dailyTrend.map((point: Record<string, unknown>) => ({
                  date: String(point.date ?? ""),
                  requests: toNumber(point.requests),
                  totalTokens: toNumber(point.totalTokens),
                  cost: toNumber(point.cost),
                }))
              : []
          );
          setByModel(
            Array.isArray(payload?.byModel)
              ? payload.byModel.map((m: Record<string, unknown>) => ({
                  model: String(m.model ?? ""),
                  provider: String(m.provider ?? ""),
                  requests: toNumber(m.requests),
                  totalTokens: toNumber(m.totalTokens),
                  cost: toNumber(m.cost),
                }))
              : []
          );
        }

        if (keysRes?.ok) {
          const payload = await keysRes.json();
          const keysList = Array.isArray(payload?.keys) ? payload.keys : [];
          setRawKeysList(keysList);
          setApiKeyCount(toNumber(payload?.total ?? keysList.length));
        }

        if (curationRes?.ok) {
          const payload = await curationRes.json();
          const customizations = Array.isArray(payload?.customizations)
            ? payload.customizations
            : [];
          const piped = customizations.filter((c: any) => c.isActive === true).length;
          setPipedModelsCount(piped);
        }

        if (combosRes?.ok) {
          const payload = await combosRes.json();
          const list = Array.isArray(payload?.combos)
            ? payload.combos
            : Array.isArray(payload)
              ? payload
              : [];
          const activeCombos = list.filter((c: any) => c.isActive !== false).length;
          setActiveCombosCount(activeCombos);
        }

        if (usersRes?.ok) {
          const payload = await usersRes.json();
          const uList = Array.isArray(payload?.users) ? payload.users : [];
          const kUsers = Array.isArray(payload?.userKeys) ? payload.userKeys : [];
          const bList = Array.isArray(payload?.byokKeys) ? payload.byokKeys : [];
          setUsersList(uList.length > 0 ? uList : kUsers);
          setByokKeysCount(bList.length);
        }

        if (providersRes?.ok) {
          const payload = await providersRes.json();
          const conns = Array.isArray(payload?.connections) ? payload.connections : [];
          setConnectionsList(conns);
        }

        if (limitsRes?.ok) {
          const payload = await limitsRes.json();
          const list = Array.isArray(payload?.limits) ? payload.limits : [];
          const active = list.filter((l: any) => l.isActive !== false);
          const totalCap = list.reduce(
            (acc: number, l: any) => acc + (Number(l.totalTokenPool) || 0),
            0
          );
          const remainingCap = list.reduce(
            (acc: number, l: any) => acc + (Number(l.remainingTokens) || 0),
            0
          );
          const consumedCap = list.reduce(
            (acc: number, l: any) => acc + (Number(l.consumedTokens) || 0),
            0
          );
          setLimitsStats({
            totalPolicies: list.length,
            activePolicies: active.length,
            totalCap,
            remainingCap,
            consumedCap,
          });
        }

        if (callLogsRes?.ok) {
          const logsPayload = await callLogsRes.json();
          const logsList = Array.isArray(logsPayload)
            ? logsPayload
            : Array.isArray(logsPayload?.logs)
              ? logsPayload.logs
              : [];
          const rStats = computeRpmFromLogs(logsList, rawTotalRequests, 30 * 1440);
          setRpmStats(rStats);
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          setLoading(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    initialLoad();
    return () => controller.abort();
  }, []);

  // Periodic live RPM refresh (every 12 seconds when page is visible)
  useEffect(() => {
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/usage/call-logs?limit=100&excludeTests=1", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const logsList = Array.isArray(data) ? data : Array.isArray(data?.logs) ? data.logs : [];
          setRpmStats((prev) => {
            const computed = computeRpmFromLogs(logsList, summary?.totalRequests, 30 * 1440);
            return {
              ...prev,
              currentRpm: computed.currentRpm,
              peakRpm: Math.max(prev.peakRpm, computed.peakRpm),
            };
          });
        }
      } catch {
        // silent
      }
    }, 12000);
    return () => clearInterval(id);
  }, [summary?.totalRequests]);

  /** Effective connection list from props or API payload */
  const effectiveConnections = useMemo(() => {
    if (providerConnections && providerConnections.length > 0) {
      return providerConnections;
    }
    return connectionsList;
  }, [providerConnections, connectionsList]);

  const connectionStats = useMemo(() => {
    const conns = effectiveConnections;
    const connectedConns = conns.filter(
      (c) => c.isActive !== false && isProviderConnectionConnected(c)
    ).length;
    const pausedConns = conns.filter((c) => c.isActive === false).length;
    return {
      connectedConns,
      pausedConns,
    };
  }, [effectiveConnections]);

  const usersCount = useMemo(() => {
    if (usersList.length > 0) return usersList.length;
    const uniqueKeyUsers = new Set(
      rawKeysList.map((k) => k.userId || k.userName || k.user_name || k.name).filter(Boolean)
    );
    return uniqueKeyUsers.size;
  }, [usersList, rawKeysList]);

  /** Catalog providers (from AI_PROVIDERS) plus self-defined custom nodes. */
  const totals = useMemo(() => {
    const catalogTotal = providerStats.length;
    const withConnections = providerStats.filter((stat) => stat.total > 0);
    const connected = providerStats.filter((stat) => stat.connected > 0);
    const withErrors = providerStats.filter((stat) => stat.connected === 0 && stat.errors > 0);

    return {
      catalogTotal,
      customTotal: customProviders,
      configured: withConnections.length + customProviders,
      connected: connected.length,
      withErrors: withErrors.length,
      models: providerStats.reduce((sum, stat) => sum + stat.modelCount, 0),
      connections: providerStats.reduce((sum, stat) => sum + stat.total, 0),
      healthyConnections: providerStats.reduce((sum, stat) => sum + stat.connected, 0),
    };
  }, [providerStats, customProviders]);

  const customStats = useMemo(() => {
    const list = providerNodes && providerNodes.length > 0 ? providerNodes : [];
    const total = list.length || customProviders;
    const active = list.length > 0 ? list.filter((n) => n.isActive !== false).length : total;
    const paused = list.length > 0 ? list.filter((n) => n.isActive === false).length : 0;
    return { total, active, paused };
  }, [providerNodes, customProviders]);

  // Top 5 models calculations
  const top5ModelsByTokens = useMemo(() => {
    return [...byModel]
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 5)
      .filter((m) => m.totalTokens > 0);
  }, [byModel]);

  const top5ModelsByRequests = useMemo(() => {
    return [...byModel]
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5)
      .filter((m) => m.requests > 0);
  }, [byModel]);

  // Timelines for registration & creation
  const usersTimeline = useMemo(() => {
    return groupItemsByDate(
      usersList,
      (u: any) => u.createdAt || u.created_at,
      (u: any) => u.name || u.userName || u.email || u.id
    );
  }, [usersList]);

  const keysTimeline = useMemo(() => {
    return groupItemsByDate(
      rawKeysList,
      (k: any) => k.created_at || k.createdAt,
      (k: any) => k.name || (k.userName ? `${k.userName}'s Key` : k.id)
    );
  }, [rawKeysList]);

  const providersTimeline = useMemo(() => {
    return groupItemsByDate(
      connectionsList,
      (c: any) => c.created_at || c.createdAt,
      (c: any) => c.name || c.provider || c.id
    );
  }, [connectionsList]);

  const cards = [
    {
      key: "totalProviders",
      label: t("analyticsTotalProvidersLabel") || "Total Providers",
      icon: "hub",
      value: String(totals.catalogTotal + customStats.total),
      hint: `${totals.catalogTotal} Pre-configured · ${customStats.total} Custom`,
      tone: "text-primary",
      href: "/dashboard/providers",
    },
    {
      key: "connectedProviders",
      label: t("analyticsConnectedProvidersLabel") || "Connected Providers",
      icon: "check_circle",
      value: String(totals.connected),
      hint: `${totals.connected} Connected · ${connectionStats.pausedConns} Paused`,
      tone: totals.connected > 0 ? "text-emerald-500" : "text-text-muted",
      href: "/dashboard/providers",
    },
    {
      key: "customProviders",
      label: t("analyticsCustomProvidersLabel") || "Custom Providers",
      icon: "extension",
      value: String(customStats.total),
      hint: `${customStats.active} Connected · ${customStats.paused} Paused`,
      tone: customStats.total > 0 ? "text-primary" : "text-text-muted",
      href: "/dashboard/providers",
    },
    {
      key: "pipedModels",
      label: t("analyticsPipedModelsLabel") || "Piped Models",
      icon: "tune",
      value: String(pipedModelsCount),
      hint: `${pipedModelsCount} Piped · ${activeCombosCount} Combos`,
      tone: pipedModelsCount > 0 ? "text-cyan-500" : "text-text-muted",
      href: "/dashboard/manage-models",
    },
    {
      key: "limitsBank",
      label: "Limits Bank",
      icon: "account_balance",
      value: String(limitsStats.totalPolicies),
      hint:
        limitsStats.totalPolicies > 0
          ? `${limitsStats.activePolicies} Active · ${formatTokensInMillions(limitsStats.totalCap)} Pool`
          : "0 Policies · Unlimited Pool",
      tone: limitsStats.totalPolicies > 0 ? "text-amber-500" : "text-text-muted",
      href: "/dashboard/limits",
    },
    {
      key: "apiKeys",
      label: "Total API Keys",
      icon: "vpn_key",
      value: String(apiKeyCount),
      hint: `${usersCount} ${usersCount === 1 ? "User" : "Users"} · ${byokKeysCount} BYOK`,
      tone: apiKeyCount > 0 ? "text-primary" : "text-text-muted",
      href: "/dashboard/api-manager",
    },
    {
      key: "usageTokens",
      label: "Usage Tokens",
      icon: "token",
      value: formatTokensInBillions(summary?.totalTokens ?? 0),
      hint: `In: ${compactNumber(summary?.promptTokens ?? 0)} · Out: ${compactNumber(summary?.completionTokens ?? 0)}`,
      tone: "text-purple-500",
      href: "/dashboard/usage",
    },
    {
      key: "allOverRequests",
      label: "All Over Requests",
      icon: "send",
      value: compactNumber(summary?.totalRequests ?? 0),
      hint: `${(summary?.successRatePct ?? 0).toFixed(1)}% success rate`,
      tone: (summary?.totalRequests ?? 0) > 0 ? "text-primary" : "text-text-muted",
      href: "/dashboard/usage",
    },
    {
      key: "requestsPerMinute",
      label: "Requests Per Minute",
      icon: "speed",
      value: `${rpmStats.currentRpm} RPM`,
      hint: `Live: ${rpmStats.currentRpm} · Peak: ${rpmStats.peakRpm} RPM`,
      tone:
        rpmStats.currentRpm > 0
          ? "text-emerald-500"
          : rpmStats.peakRpm > 0
            ? "text-primary"
            : "text-text-muted",
      href: "/dashboard/usage",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {/* ── Summary Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-text-main flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-primary">insights</span>
            {t("analyticsTitle")}
          </h2>
          <p className="text-xs text-text-muted">{t("analyticsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Scroll arrow navigation buttons for KPI cards */}
          {isCardsExpanded && (
            <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
              <button
                type="button"
                onClick={() => handleScroll("left")}
                disabled={!canScrollLeft}
                className="w-6 h-6 rounded-lg hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Scroll cards left"
                aria-label="Scroll cards left"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button
                type="button"
                onClick={() => handleScroll("right")}
                disabled={!canScrollRight}
                className="w-6 h-6 rounded-lg hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Scroll cards right"
                aria-label="Scroll cards right"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCardsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-xs"
            aria-expanded={isCardsExpanded}
            title={isCardsExpanded ? "Collapse cards" : "Expand cards"}
          >
            <span>
              {isCardsExpanded
                ? t("analyticsCollapseCards") || "Collapse"
                : t("analyticsExpandCards") || "Expand Cards"}
            </span>
            <span
              className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${
                isCardsExpanded ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
          </button>
          <Link
            href="/dashboard/usage"
            className="text-xs text-text-muted hover:text-primary transition-colors shrink-0"
          >
            {t("analyticsViewAll")}
          </Link>
        </div>
      </div>

      {/* ── Collapsed Compact Summary Bar ─────────────────────────────── */}
      {!isCardsExpanded && (
        <div
          onClick={() => setIsCardsExpanded(true)}
          className="p-2.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setIsCardsExpanded(true);
          }}
        >
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-primary">hub</span>
              <span className="text-zinc-500 dark:text-zinc-400">Providers:</span>
              <strong className="text-zinc-900 dark:text-zinc-100">
                {totals.catalogTotal + customStats.total}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-emerald-500">
                check_circle
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">Connected:</span>
              <strong className="text-emerald-500">{totals.connected}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-zinc-500">extension</span>
              <span className="text-zinc-500 dark:text-zinc-400">Custom:</span>
              <strong className="text-zinc-900 dark:text-zinc-100">{customStats.total}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-cyan-500">tune</span>
              <span className="text-zinc-500 dark:text-zinc-400">Piped:</span>
              <strong className="text-cyan-500">{pipedModelsCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-amber-500">
                account_balance
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">Limits Bank:</span>
              <strong className="text-amber-500">{limitsStats.totalPolicies}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-primary">vpn_key</span>
              <span className="text-zinc-500 dark:text-zinc-400">API Keys:</span>
              <strong className="text-zinc-900 dark:text-zinc-100">{apiKeyCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-purple-500">token</span>
              <span className="text-zinc-500 dark:text-zinc-400">Usage Tokens:</span>
              <strong className="text-purple-500">
                {formatTokensInBillions(summary?.totalTokens ?? 0)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-primary">send</span>
              <span className="text-zinc-500 dark:text-zinc-400">All Over:</span>
              <strong className="text-zinc-900 dark:text-zinc-100">
                {compactNumber(summary?.totalRequests ?? 0)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px] shrink-0">
              <span className="material-symbols-outlined text-[13px] text-emerald-500">speed</span>
              <span className="text-zinc-500 dark:text-zinc-400">RPM:</span>
              <strong className="text-emerald-500">{rpmStats.currentRpm}</strong>
            </span>
          </div>
          <span className="text-primary font-semibold flex items-center gap-0.5 ml-auto group-hover:translate-x-0.5 transition-transform text-xs shrink-0">
            Expand
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      )}

      {/* ── Expanded Stat cards (Scrollable Strip with Smooth iOS Carousel) ── */}
      {isCardsExpanded && (
        <div className="relative group/carousel">
          {/* Floating Left Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll("left")}
              aria-label="Scroll cards left"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-7 h-7 rounded-full bg-white/95 dark:bg-zinc-800/95 border border-zinc-200/90 dark:border-zinc-700/90 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:scale-105 active:scale-95 transition-all cursor-pointer opacity-90 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={checkScroll}
            className="flex items-stretch gap-2.5 overflow-x-auto scrollbar-none scroll-smooth pb-1 pt-0.5"
          >
            {cards.map((card) => (
              <Link
                key={card.key}
                href={card.href}
                className="w-[160px] sm:w-[178px] lg:w-[190px] shrink-0 block group"
              >
                <div className="h-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-3 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800/70 transition-all shadow-xs group-hover:shadow-sm">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[16px]">{card.icon}</span>
                      </div>
                      <span className="material-symbols-outlined text-[13px] text-text-muted/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                        arrow_forward
                      </span>
                    </div>
                    <div>
                      <div
                        className={`text-lg sm:text-xl font-bold tabular-nums tracking-tight ${card.tone}`}
                      >
                        {loading ? "—" : card.value}
                      </div>
                      <div className="text-[11px] font-semibold text-text-main truncate mt-0.5">
                        {card.label}
                      </div>
                      <div
                        className="text-[10px] text-text-muted leading-tight truncate mt-0.5"
                        title={loading ? "" : card.hint}
                      >
                        {loading ? "..." : card.hint}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Floating Right Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll("right")}
              aria-label="Scroll cards right"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-7 h-7 rounded-full bg-white/95 dark:bg-zinc-800/95 border border-zinc-200/90 dark:border-zinc-700/90 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:scale-105 active:scale-95 transition-all cursor-pointer opacity-90 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          )}
        </div>
      )}

      {/* ── Topology Section (Positioned strictly ABOVE Charts) ─────────── */}
      {topologySection}

      {/* ── Main Chart 1: Token Usage ───────────────────────────────────── */}
      <Card
        padding="sm"
        title={t("analyticsTokensTrendTitle")}
        subtitle={
          selectedRange === "custom" && customStartDate && customEndDate
            ? `${customStartDate} → ${customEndDate}`
            : selectedRange === "1d"
              ? "Last 24 Hours"
              : selectedRange === "7d"
                ? "Last 7 Days"
                : selectedRange === "30d"
                  ? "Last 30 Days"
                  : selectedRange === "60d"
                    ? "Last 2 Months"
                    : "All Time"
        }
        icon="analytics"
        action={
          <div className="flex flex-wrap items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/90 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
            {[
              { label: "1D", val: "1d" },
              { label: "7D", val: "7d" },
              { label: "30D", val: "30d" },
              { label: "60D", val: "60d" },
              { label: "All", val: "all" },
            ].map((r) => (
              <button
                key={r.val}
                type="button"
                onClick={() => {
                  setSelectedRange(r.val);
                  setIsCustomDateOpen(false);
                  fetchAnalyticsData(r.val);
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedRange === r.val && !isCustomDateOpen
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustomDateOpen((p) => !p)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                isCustomDateOpen || selectedRange === "custom"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Select custom date range"
            >
              <span className="material-symbols-outlined text-[13px]">calendar_month</span>
              <span>Date</span>
            </button>
          </div>
        }
      >
        {/* Custom Calendar Date Range Picker */}
        {isCustomDateOpen && (
          <div className="mb-2.5 pt-1.5 pb-2 px-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 text-[11px]">
              <span className="material-symbols-outlined text-[14px]">date_range</span>
              Custom Range:
            </span>
            <div className="flex items-center gap-1">
              <span className="text-text-muted text-[11px]">From</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-0.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-text-muted text-[11px]">To</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-0.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (customStartDate && customEndDate) {
                  setSelectedRange("custom");
                  fetchAnalyticsData("custom", customStartDate, customEndDate);
                }
              }}
              disabled={!customStartDate || !customEndDate}
              className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white disabled:opacity-40 transition-all cursor-pointer shadow-xs"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomStartDate("");
                setCustomEndDate("");
                setIsCustomDateOpen(false);
                setSelectedRange("30d");
                fetchAnalyticsData("30d");
              }}
              className="px-2 py-0.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {analyticsLoading ? (
          <ChartLoadingCard className="p-0 flex-1" />
        ) : recharts && dailyTrend.length > 0 ? (
          <TokenTrendChart recharts={recharts} data={dailyTrend} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-1.5">
            <span className="material-symbols-outlined text-2xl text-text-muted">show_chart</span>
            <p className="text-xs text-text-muted">No token activity found in this period</p>
          </div>
        )}
      </Card>

      {/* ── Row 2: Top 5 Models by Tokens & Requests ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Top 5 Models by Token Usage */}
        <Card
          padding="sm"
          title={t("analyticsTopModelsTokensTitle")}
          subtitle={t("analyticsTopModelsTokensSubtitle")}
          icon="token"
          action={
            top5ModelsByTokens.length > 0 ? (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Top 5 Models
              </span>
            ) : undefined
          }
        >
          {analyticsLoading ? (
            <ChartLoadingCard className="p-0 flex-1" />
          ) : recharts ? (
            <TopModelsTokensChart recharts={recharts} data={top5ModelsByTokens} />
          ) : (
            <ChartLoadingCard className="p-0 flex-1" />
          )}
        </Card>

        {/* Top 5 Models by Requests (RPM Volume) */}
        <Card
          padding="sm"
          title={t("analyticsTopModelsRequestsTitle")}
          subtitle={t("analyticsTopModelsRequestsSubtitle")}
          icon="speed"
          action={
            top5ModelsByRequests.length > 0 ? (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Top Requests
              </span>
            ) : undefined
          }
        >
          {analyticsLoading ? (
            <ChartLoadingCard className="p-0 flex-1" />
          ) : recharts ? (
            <TopModelsRequestsChart recharts={recharts} data={top5ModelsByRequests} />
          ) : (
            <ChartLoadingCard className="p-0 flex-1" />
          )}
        </Card>
      </div>

      {/* ── Row 3: Platform Registration & Growth Timelines ─────────────── */}
      <div className="flex flex-col gap-2 mt-0.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="material-symbols-outlined text-[16px] text-primary">
            history_toggle_off
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Registration & Connection Timelines
          </h3>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">
            · Date-wise additions
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Timeline 1: Users Added */}
          <Card
            padding="sm"
            title={t("analyticsUsersTimelineTitle")}
            subtitle={t("analyticsUsersTimelineSubtitle")}
            icon="person_add"
            action={
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {usersList.length} Total Users
              </span>
            }
          >
            {usersTimeline.length > 0 && recharts ? (
              <TimelineBarChart
                recharts={recharts}
                data={usersTimeline}
                color="#8b5cf6"
                itemLabel="Users"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-1.5">
                <span className="material-symbols-outlined text-2xl text-text-muted">group</span>
                <p className="text-xs text-text-muted">No users registered yet</p>
                <Link href="/dashboard/users" className="text-xs text-primary hover:underline">
                  + Add User
                </Link>
              </div>
            )}
          </Card>

          {/* Timeline 2: API Keys Created */}
          <Card
            padding="sm"
            title={t("analyticsApiKeysTimelineTitle")}
            subtitle={t("analyticsApiKeysTimelineSubtitle")}
            icon="vpn_key"
            action={
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {apiKeyCount} Total Keys
              </span>
            }
          >
            {keysTimeline.length > 0 && recharts ? (
              <TimelineBarChart
                recharts={recharts}
                data={keysTimeline}
                color="#10b981"
                itemLabel="Keys"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-1.5">
                <span className="material-symbols-outlined text-2xl text-text-muted">key</span>
                <p className="text-xs text-text-muted">No keys generated yet</p>
                <Link
                  href="/dashboard/api-manager"
                  className="text-xs text-primary hover:underline"
                >
                  + Generate Key
                </Link>
              </div>
            )}
          </Card>

          {/* Timeline 3: Providers Connected */}
          <Card
            padding="sm"
            title={t("analyticsProvidersTimelineTitle")}
            subtitle={t("analyticsProvidersTimelineSubtitle")}
            icon="dns"
            action={
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                {connectionsList.length || totals.connections} Connections
              </span>
            }
          >
            {providersTimeline.length > 0 && recharts ? (
              <TimelineBarChart
                recharts={recharts}
                data={providersTimeline}
                color="#0ea5e9"
                itemLabel="Providers"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-1.5">
                <span className="material-symbols-outlined text-2xl text-text-muted">hub</span>
                <p className="text-xs text-text-muted">No providers connected yet</p>
                <Link href="/dashboard/providers" className="text-xs text-primary hover:underline">
                  + Connect Provider
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Area chart: Token Usage over time. */
function TokenTrendChart({
  recharts,
  data,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  data: DailyTrendPoint[];
}) {
  const t = useTranslations("home");
  const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } = recharts;

  const chartData = data.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));

  return (
    <ResponsiveContainer width="100%" height={175}>
      <AreaChart data={chartData} margin={{ top: 12, right: 24, left: 6, bottom: 8 }}>
        <defs>
          <linearGradient id="homeTokensFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
            <stop offset="60%" stopColor="var(--color-primary)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          opacity={0.35}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          minTickGap={32}
          tickMargin={8}
          padding={{ left: 16, right: 16 }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          tickFormatter={(value: number) => compactNumber(value)}
          width={42}
          tickMargin={8}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<DarkTooltip formatter={(value: number) => `${compactNumber(value)} tokens`} />}
          labelFormatter={(label: string) => t("analyticsTooltipDate", { date: label })}
        />
        <Area
          type="monotone"
          dataKey="totalTokens"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          fill="url(#homeTokensFill)"
          name={t("analyticsTokensLabel")}
          dot={{
            r: 3,
            fill: "var(--color-primary)",
            stroke: "var(--color-surface)",
            strokeWidth: 1.5,
          }}
          activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart: Top 5 models by token usage. */
function TopModelsTokensChart({
  recharts,
  data,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  data: ModelRow[];
}) {
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } = recharts;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
        <span className="material-symbols-outlined text-2xl text-text-muted">token</span>
        <p className="text-xs text-text-muted">No model token usage recorded in this time range</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 2, bottom: 4 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          tickFormatter={(v: number) => compactNumber(v)}
          axisLine={false}
          tickLine={false}
          tickMargin={4}
        />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fontSize: 10, fill: "var(--color-text-main)" }}
          stroke="var(--color-border)"
          width={95}
          tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
          axisLine={false}
          tickLine={false}
          tickMargin={6}
        />
        <Tooltip
          content={<DarkTooltip formatter={(v: number) => `${compactNumber(v)} tokens`} />}
          cursor={{ fill: "var(--color-bg-subtle)" }}
        />
        <Bar dataKey="totalTokens" radius={[0, 4, 4, 0]} name="Total Tokens">
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={
                idx === 0
                  ? "#7c3aed"
                  : idx === 1
                    ? "#8b5cf6"
                    : idx === 2
                      ? "#a78bfa"
                      : "#c4b5fd"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart: Top 5 models by request count (RPM). */
function TopModelsRequestsChart({
  recharts,
  data,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  data: ModelRow[];
}) {
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } = recharts;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-1.5">
        <span className="material-symbols-outlined text-2xl text-text-muted">speed</span>
        <p className="text-xs text-text-muted">No model requests recorded in this time range</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 2, bottom: 4 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          tickFormatter={(v: number) => compactNumber(v)}
          axisLine={false}
          tickLine={false}
          tickMargin={4}
        />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fontSize: 10, fill: "var(--color-text-main)" }}
          stroke="var(--color-border)"
          width={95}
          tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)}
          axisLine={false}
          tickLine={false}
          tickMargin={6}
        />
        <Tooltip
          content={
            <DarkTooltip formatter={(v: number) => `${Number(v).toLocaleString()} requests`} />
          }
          cursor={{ fill: "var(--color-bg-subtle)" }}
        />
        <Bar dataKey="requests" radius={[0, 4, 4, 0]} name="Requests">
          {data.map((_, idx) => (
            <Cell
              key={idx}
              fill={
                idx === 0
                  ? "#0284c7"
                  : idx === 1
                    ? "#0ea5e9"
                    : idx === 2
                      ? "#38bdf8"
                      : "#7dd3fc"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Reusable Timeline bar chart showing additions per date with recent history. */
function TimelineBarChart({
  recharts,
  data,
  color,
  itemLabel,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  data: TimelinePoint[];
  color: string;
  itemLabel: string;
}) {
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } = recharts;

  return (
    <div className="flex flex-col gap-1.5">
      <ResponsiveContainer width="100%" height={130}>
        <BarChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.35}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
            tickMargin={4}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
            allowDecimals={false}
            width={28}
            axisLine={false}
            tickLine={false}
            tickMargin={4}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0]?.payload as TimelinePoint;
              return (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-xs shadow-lg max-w-[220px]">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2 text-[11px]">
                    <span>{entry.date}</span>
                    <span className="font-mono font-bold" style={{ color }}>
                      {entry.count} {itemLabel}
                    </span>
                  </div>
                  {entry.details?.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
                      {entry.details.slice(0, 3).map((d: string, i: number) => (
                        <div key={i} className="truncate" title={d}>
                          • {d}
                        </div>
                      ))}
                      {entry.details.length > 3 && (
                        <div className="text-[9px] text-zinc-400">
                          + {entry.details.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} name={itemLabel} />
        </BarChart>
      </ResponsiveContainer>

      {/* Mini recent date log */}
      <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-1 text-[11px]">
        {data
          .slice(-2)
          .reverse()
          .map((d) => (
            <div
              key={d.date}
              className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-[10px]"
            >
              <span className="font-mono text-zinc-400">{d.date}</span>
              <span
                className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[130px]"
                title={d.details.join(", ")}
              >
                {d.details.slice(0, 2).join(", ")}
                {d.details.length > 2 ? ` +${d.details.length - 2}` : ""}
              </span>
              <span className="font-mono font-bold" style={{ color }}>
                +{d.count}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
