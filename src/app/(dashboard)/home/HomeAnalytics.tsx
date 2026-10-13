"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import Card from "@/shared/components/Card";
import { toNumber } from "@/shared/utils/numeric";
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

type ProviderRow = {
  provider: string;
  requests: number;
  totalTokens: number;
  successRatePct: number;
};

const RANGE = "30d";

/** 101233 -> "101.2K", 4200000 -> "4.2M" — keeps stat cards on one line. */
function compactNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) >= 1_000_000_000) return `${(safe / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(safe) >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (Math.abs(safe) >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return String(Math.round(safe));
}

function statTone(connected: number, total: number): string {
  if (total === 0) return "text-text-muted";
  if (connected === 0) return "text-red-500";
  if (connected === total) return "text-emerald-500";
  return "text-amber-500";
}

/**
 * Home analytics — the account-level roll-up (providers / connections / tokens /
 * API keys / requests) plus trend and provider-mix charts.
 *
 * Provider connectivity is derived from the `providerStats` prop already computed
 * by HomePageClient (no second /api/providers round-trip); token, request and
 * key totals come from /api/usage/analytics and /api/keys, which the home page
 * previously never called.
 */
export default function HomeAnalytics({ providerStats, customProviders }: HomeAnalyticsProps) {
  const t = useTranslations("home");
  const recharts = useRecharts();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([]);
  const [byProvider, setByProvider] = useState<ProviderRow[]>([]);
  const [apiKeyCount, setApiKeyCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [analyticsRes, keysRes] = await Promise.all([
          fetch(`/api/usage/analytics?range=${RANGE}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
          fetch("/api/keys?limit=1", { signal: controller.signal, cache: "no-store" }),
        ]);

        if (analyticsRes.ok) {
          const payload = await analyticsRes.json();
          const rawSummary = payload?.summary ?? {};
          setSummary({
            totalRequests: toNumber(rawSummary.totalRequests),
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
          setByProvider(
            Array.isArray(payload?.byProvider)
              ? payload.byProvider
                  .map((row: Record<string, unknown>) => ({
                    provider: String(row.provider ?? "unknown"),
                    requests: toNumber(row.requests),
                    totalTokens: toNumber(row.totalTokens),
                    successRatePct: toNumber(row.successRatePct),
                  }))
                  .sort((a: ProviderRow, b: ProviderRow) => b.totalTokens - a.totalTokens)
              : []
          );
        }

        if (keysRes.ok) {
          const payload = await keysRes.json();
          setApiKeyCount(toNumber(payload?.total));
        }
      } catch (error) {
        // A 401 on /api/keys or a transient analytics failure must not blank the
        // whole home page — keep whatever resolved and leave the rest at zero.
        // AbortError is the unmount path and is silently ignored.
        if ((error as Error)?.name !== "AbortError") {
          setLoading(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  /** Catalog providers (from AI_PROVIDERS) plus self-defined custom nodes. */
  const totals = useMemo(() => {
    const catalogTotal = providerStats.length;
    const withConnections = providerStats.filter((stat) => stat.total > 0);
    const connected = providerStats.filter((stat) => stat.connected > 0);
    const withErrors = providerStats.filter((stat) => stat.connected === 0 && stat.errors > 0);

    return {
      catalogTotal,
      customTotal: customProviders,
      // A provider counts once if it has any connection at all.
      configured: withConnections.length + customProviders,
      connected: connected.length,
      withErrors: withErrors.length,
      models: providerStats.reduce((sum, stat) => sum + stat.modelCount, 0),
      connections: providerStats.reduce((sum, stat) => sum + stat.total, 0),
      healthyConnections: providerStats.reduce((sum, stat) => sum + stat.connected, 0),
    };
  }, [providerStats, customProviders]);

  /** Providers with at least one connection, ranked by tokens served. */
  const providerBreakdown = useMemo(() => {
    const tokensByProvider = new Map(byProvider.map((row) => [row.provider, row.totalTokens]));
    const requestsByProvider = new Map(byProvider.map((row) => [row.provider, row.requests]));

    return providerStats
      .filter((stat) => stat.total > 0)
      .map((stat) => ({
        ...stat,
        tokens: tokensByProvider.get(stat.provider.name) ?? 0,
        requests: requestsByProvider.get(stat.provider.name) ?? 0,
      }))
      .sort((left, right) => {
        if (right.connected !== left.connected) return right.connected - left.connected;
        return right.total - left.total;
      });
  }, [providerStats, byProvider]);

  const topProviderTokens = useMemo(
    () => byProvider.filter((row) => row.totalTokens > 0).slice(0, 8),
    [byProvider]
  );

  const cards = [
    {
      key: "providers",
      icon: "hub",
      value: String(totals.catalogTotal + totals.customTotal),
      hint: t("analyticsProvidersHint", { custom: totals.customTotal }),
      tone: "text-primary",
      href: "/dashboard/providers",
    },
    {
      key: "connected",
      icon: "check_circle",
      value: String(totals.connected),
      hint: t("analyticsConnectedHint", {
        connections: totals.healthyConnections,
        total: totals.connections,
      }),
      tone: totals.connected > 0 ? "text-emerald-500" : "text-text-muted",
      href: "/dashboard/providers",
    },
    {
      key: "tokens",
      icon: "token",
      value: compactNumber(summary?.totalTokens ?? 0),
      hint: t("analyticsTokensHint", {
        input: compactNumber(summary?.promptTokens ?? 0),
        output: compactNumber(summary?.completionTokens ?? 0),
      }),
      tone: "text-primary",
      href: "/dashboard/usage",
    },
    {
      key: "apiKeys",
      icon: "key",
      value: compactNumber(apiKeyCount),
      hint: t("analyticsApiKeysHint"),
      tone: "text-primary",
      href: "/dashboard/api-manager",
    },
    {
      key: "requests",
      icon: "send",
      value: compactNumber(summary?.totalRequests ?? 0),
      hint: t("analyticsRequestsHint", { rate: (summary?.successRatePct ?? 0).toFixed(1) }),
      tone: "text-primary",
      href: "/dashboard/usage",
    },
    {
      key: "models",
      icon: "psychology",
      value: compactNumber(summary?.uniqueModels ?? totals.models),
      hint: t("analyticsModelsHint"),
      tone: "text-primary",
      href: "/dashboard/models",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">insights</span>
            {t("analyticsTitle")}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">{t("analyticsSubtitle")}</p>
        </div>
        <Link
          href="/dashboard/usage"
          className="text-xs text-text-muted hover:text-primary transition-colors shrink-0"
        >
          {t("analyticsViewAll")}
        </Link>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((card) => (
          <Link key={card.key} href={card.href} className="block group">
            <Card padding="sm" className="h-full transition-colors hover:border-primary/40">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined text-[18px] text-text-muted group-hover:text-primary transition-colors">
                    {card.icon}
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-text-muted/0 group-hover:text-text-muted transition-all">
                    arrow_forward
                  </span>
                </div>
                <div>
                  <div className={`text-2xl font-bold tabular-nums ${card.tone}`}>
                    {loading ? "—" : card.value}
                  </div>
                  <div className="text-[11px] font-medium text-text-main mt-0.5">
                    {t(`analytics${card.key.charAt(0).toUpperCase() + card.key.slice(1)}Label`)}
                  </div>
                  <div className="text-[10px] text-text-muted leading-snug mt-0.5">
                    {loading ? "" : card.hint}
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card
          padding="sm"
          className="lg:col-span-2"
          title={t("analyticsTokensTrendTitle")}
          subtitle={t("analyticsTokensTrendSubtitle", { range: RANGE })}
          icon="show_chart"
        >
          {recharts && dailyTrend.length > 0 ? (
            <TokenTrendChart recharts={recharts} data={dailyTrend} />
          ) : (
            <ChartLoadingCard className="p-0 flex-1" />
          )}
        </Card>

        <Card
          padding="sm"
          title={t("analyticsTopProvidersTitle")}
          subtitle={t("analyticsTopProvidersSubtitle")}
          icon="leaderboard"
        >
          {recharts && topProviderTokens.length > 0 ? (
            <TopProvidersChart recharts={recharts} data={topProviderTokens} />
          ) : (
            <ChartLoadingCard className="p-0 flex-1" />
          )}
        </Card>
      </div>

      {/* ── Provider connectivity breakdown ───────────────────────────── */}
      <Card
        padding="sm"
        title={t("analyticsProviderStatusTitle")}
        subtitle={t("analyticsProviderStatusSubtitle")}
        icon="lan"
        action={
          <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-subtle border border-border">
            {t("analyticsConnectedBadge", {
              connected: totals.connected,
              total: totals.catalogTotal + totals.customTotal,
            })}
          </span>
        }
      >
        {providerBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <span className="material-symbols-outlined text-3xl text-text-muted">cloud_off</span>
            <p className="text-sm text-text-muted">{t("noProvidersConfigured")}</p>
            <Link href="/dashboard/providers" className="text-xs text-primary hover:underline">
              {t("addProvider")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {providerBreakdown.slice(0, 10).map((stat) => (
              <div key={stat.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
                  {stat.provider.textIcon || "smart_toy"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-main truncate">
                      {stat.provider.name}
                    </span>
                    <span
                      className={`text-xs font-semibold tabular-nums shrink-0 ${statTone(
                        stat.connected,
                        stat.total
                      )}`}
                    >
                      {stat.connected}/{stat.total}
                    </span>
                  </div>
                  {/* Connectivity bar — healthy connections over total connections */}
                  <div className="mt-1 h-1 rounded-full bg-bg-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${stat.total > 0 ? (stat.connected / stat.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                    <span>{t("modelsAvailable", { count: stat.modelCount })}</span>
                    {stat.tokens > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{compactNumber(stat.tokens)} tokens</span>
                      </>
                    )}
                    {stat.errors > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-500">
                          {t("analyticsErrored", { count: stat.errors })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Area chart: tokens served per day. */
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
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="homeTokensFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          tickFormatter={(value: number) => compactNumber(value)}
          width={44}
        />
        <Tooltip
          content={<DarkTooltip formatter={(value: number) => compactNumber(value)} />}
          labelFormatter={(label: string) => t("analyticsTooltipDate", { date: label })}
        />
        <Area
          type="monotone"
          dataKey="totalTokens"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#homeTokensFill)"
          name={t("analyticsTokensLabel")}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart: tokens by provider (top 8). */
function TopProvidersChart({
  recharts,
  data,
}: {
  recharts: NonNullable<ReturnType<typeof useRecharts>>;
  data: ProviderRow[];
}) {
  const t = useTranslations("home");
  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } = recharts;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="provider"
          tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
          stroke="var(--color-border)"
          width={84}
          tickFormatter={(value: string) => (value.length > 12 ? `${value.slice(0, 11)}…` : value)}
        />
        <Tooltip
          content={<DarkTooltip formatter={(value: number) => compactNumber(value)} />}
          cursor={{ fill: "var(--color-bg-subtle)" }}
        />
        <Bar dataKey="totalTokens" radius={[0, 4, 4, 0]} name={t("analyticsTokensLabel")}>
          {data.map((entry) => (
            <Cell key={entry.provider} fill="var(--color-primary)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
