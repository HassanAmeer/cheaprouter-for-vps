"use client";

import { useState, useTransition } from "react";
import { Card, Input } from "@/shared/components";
import type { ProviderDisplayMode } from "../providerPageStorage";

type ProviderMessageTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has?: (key: string) => boolean;
};

type SummaryStat = {
  configured: number;
  total: number;
};

export interface ProviderSummaryStats {
  all: SummaryStat;
  free: SummaryStat;
  noauth: SummaryStat;
  oauth: SummaryStat;
  apikey: SummaryStat;
  compatible: SummaryStat;
  webcookie: SummaryStat;
  search: SummaryStat;
  audio: SummaryStat;
  local: SummaryStat;
  upstreamproxy: SummaryStat;
  cloudagent: SummaryStat;
  ide: SummaryStat;
  cli?: SummaryStat;
  webfetch: SummaryStat;
}

interface ProviderSummaryCardProps {
  activeCategory: string | null;
  activeServiceKind: string | null;
  onServiceKindChange(kind: string | null): void;
  disabledConfigured?: boolean;
  displayMode?: ProviderDisplayMode;
  modelSearchQuery: string;
  onBatchTest(mode: string): void;
  onCategoryChange(category: string | null, freeOnly: boolean): void;
  onDisplayModeChange?(mode: ProviderDisplayMode): void;
  onNewProvider?(): void;
  onImportFromFile?(): void;
  searchQuery: string;
  setModelSearchQuery(value: string): void;
  setSearchQuery(value: string): void;
  showFreeOnly: boolean;
  summaryStats: ProviderSummaryStats;
  t: ProviderMessageTranslator;
  tc: ProviderMessageTranslator;
  testingMode: string | null;
}

function providerText(
  t: ProviderMessageTranslator,
  key: string,
  fallback: string,
  values?: Record<string, unknown>
): string {
  if (typeof t.has === "function" && t.has(key)) {
    return t(key, values);
  }
  if (values) {
    return Object.entries(values).reduce(
      (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
      fallback
    );
  }
  return fallback;
}

const SERVICE_KIND_CHIPS: Array<{ key: string; icon: string; labelKey: string; fallback: string }> =
  [
    { key: "image", icon: "image", labelKey: "serviceKindImage", fallback: "Image" },
    { key: "video", icon: "videocam", labelKey: "serviceKindVideo", fallback: "Video" },
    { key: "music", icon: "music_note", labelKey: "serviceKindMusic", fallback: "Music" },
    { key: "tts", icon: "record_voice_over", labelKey: "serviceKindTts", fallback: "Text→Speech" },
    { key: "stt", icon: "hearing", labelKey: "serviceKindStt", fallback: "Speech→Text" },
    {
      key: "embedding",
      icon: "scatter_plot",
      labelKey: "serviceKindEmbedding",
      fallback: "Embedding",
    },
  ];

export default function ProviderSummaryCard({
  activeCategory,
  activeServiceKind,
  onServiceKindChange,
  disabledConfigured: _disabledConfigured,
  displayMode: _displayMode,
  modelSearchQuery,
  onBatchTest,
  onCategoryChange,
  onDisplayModeChange: _onDisplayModeChange,
  onNewProvider: _onNewProvider,
  onImportFromFile: _onImportFromFile,
  searchQuery,
  setModelSearchQuery,
  setSearchQuery,
  showFreeOnly: _showFreeOnly,
  summaryStats,
  t,
  tc,
  testingMode,
}: ProviderSummaryCardProps) {
  const categories = [
    { key: null, color: null, label: t("providerSummaryAll"), stat: summaryStats.all },
    { key: "oauth", color: "bg-blue-500", label: t("oauthLabel"), stat: summaryStats.oauth },
    {
      key: "ide",
      color: "bg-cyan-500",
      label: providerText(t, "categoryIde", "IDE"),
      stat: summaryStats.ide,
    },
    {
      key: "cli",
      color: "bg-emerald-600",
      label: providerText(t, "categoryCli", "CLI"),
      stat: summaryStats.cli || { configured: 0, total: 0 },
    },
    {
      key: "free",
      color: "bg-green-500",
      label: t("freeTier"),
      stat: summaryStats.free,
      title: t("freeAggregated"),
    },
    { key: "no-auth", color: "bg-stone-500", label: t("noAuthLabel"), stat: summaryStats.noauth },
    {
      key: "upstream-proxy",
      color: "bg-indigo-500",
      label: t("upstreamProxyLabel"),
      stat: summaryStats.upstreamproxy,
    },
    { key: "apikey", color: "bg-amber-500", label: t("apiKeyLabel"), stat: summaryStats.apikey },
    {
      key: "compatible",
      color: "bg-orange-500",
      label: t("compatibleLabel"),
      stat: summaryStats.compatible,
    },
    {
      key: "webcookie",
      color: "bg-purple-500",
      label: providerText(t, "categoryWebCookie", "Web Cookie"),
      stat: summaryStats.webcookie,
    },
    {
      key: "search",
      color: "bg-teal-500",
      label: providerText(t, "categorySearch", "Search"),
      stat: summaryStats.search,
    },
    {
      key: "webfetch",
      color: "bg-orange-500",
      label: t("webFetch"),
      stat: summaryStats.webfetch,
      title: t("webFetchTooltip"),
    },
    {
      key: "audio",
      color: "bg-rose-500",
      label: providerText(t, "categoryAudio", "Audio"),
      stat: summaryStats.audio,
    },
    {
      key: "local",
      color: "bg-emerald-500",
      label: providerText(t, "categoryLocal", "Local"),
      stat: summaryStats.local,
    },
    {
      key: "cloudagent",
      color: "bg-violet-500",
      label: providerText(t, "categoryCloudAgent", "Cloud Agent"),
      stat: summaryStats.cloudagent,
    },
  ].filter((category) => category.key !== "no-auth" || category.stat.total > 0);

  const [pendingCategoryKey, setPendingCategoryKey] = useState<string | null>(null);
  const [pendingServiceKindKey, setPendingServiceKindKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleServiceKindClick = (key: string) => {
    const nextKey = activeServiceKind === key ? null : key;
    setPendingServiceKindKey(key);

    startTransition(() => {
      onServiceKindChange(nextKey);
      setTimeout(() => {
        setPendingServiceKindKey(null);
      }, 250);
    });
  };

  return (
    <Card padding="sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchProviders")}
              aria-label={t("searchProviders")}
              icon="search"
              inputClassName={searchQuery ? "pr-9" : ""}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-muted hover:text-text-primary transition-colors"
                aria-label={tc("clear")}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Input
              value={modelSearchQuery}
              onChange={(e) => setModelSearchQuery(e.target.value)}
              placeholder={providerText(t, "searchByModel", "Search by model…")}
              aria-label={providerText(t, "searchByModelAria", "Search by model")}
              icon="psychology"
              inputClassName={modelSearchQuery ? "pr-9" : ""}
            />
            {modelSearchQuery && (
              <button
                onClick={() => setModelSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-muted hover:text-text-primary transition-colors"
                aria-label={tc("clear")}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            onClick={() => onBatchTest("all")}
            disabled={!!testingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              testingMode === "all"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
            }`}
            title={t("testAll")}
          >
            <span className="material-symbols-outlined text-[14px]">
              {testingMode === "all" ? "sync" : "play_arrow"}
            </span>
            {testingMode === "all" ? t("testing") : t("testAll")}
          </button>
        </div>

        {/* The type filter is a single control now. It used to be a row of 15
            pills that repeated the very same grouping the sections below
            already showed (with slightly different counts). */}
        <div className="border-t border-border pt-3 flex flex-wrap items-center gap-2">
          <label
            htmlFor="provider-type-filter"
            className="text-[11px] font-medium uppercase tracking-wide text-text-muted mr-1"
          >
            {providerText(t, "filterByType", "Type")}
          </label>
          <div className="relative">
            <select
              id="provider-type-filter"
              value={activeCategory ?? ""}
              onChange={(e) => {
                const key = e.target.value || null;
                setPendingCategoryKey(key ?? "all");
                onCategoryChange(key, key === "free");
                setTimeout(() => setPendingCategoryKey(null), 250);
              }}
              aria-label={providerText(t, "filterByType", "Type")}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border bg-bg-subtle text-xs font-medium text-text-main hover:border-primary/40 focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="">
                {providerText(t, "allTypes", "All types")} ({summaryStats.all.configured}/
                {summaryStats.all.total})
              </option>
              {categories
                .filter((cat) => cat.key !== null && cat.stat.total > 0)
                .map((cat) => (
                  <option key={cat.key ?? "all"} value={cat.key ?? ""}>
                    {cat.label} ({cat.stat.configured}/{cat.stat.total})
                  </option>
                ))}
            </select>
            <span className="material-symbols-outlined text-[16px] text-text-muted pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              expand_more
            </span>
          </div>
          {pendingCategoryKey && (
            <span className="material-symbols-outlined text-[14px] text-text-muted animate-spin">
              progress_activity
            </span>
          )}
        </div>

        <div className="border-t border-border pt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted mr-1">
            {providerText(t, "filterByMedia", "Media")}
          </span>
          {SERVICE_KIND_CHIPS.map((chip) => {
            const isActive = activeServiceKind === chip.key;
            const isLoading = pendingServiceKindKey === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => handleServiceKindClick(chip.key)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-white border-primary"
                    : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/30"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[14px] ${isLoading ? "animate-spin" : ""}`}
                >
                  {isLoading ? "progress_activity" : chip.icon}
                </span>
                <span>{providerText(t, chip.labelKey, chip.fallback)}</span>
              </button>
            );
          })}
          {activeServiceKind && (
            <button
              onClick={() => onServiceKindChange(null)}
              className="text-[11px] text-text-muted hover:text-text-primary underline-offset-2 hover:underline"
            >
              {providerText(t, "clearMediaFilter", "Clear")}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
