"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { Card } from "@/shared/components";
import { useLiveRequests } from "@/hooks/useLiveDashboard";
import { selectActiveRequests } from "../home/topologyUtils";
import type { ProviderEntry, TopologyCombo } from "../home/ProviderTopology";

const ProviderTopology = dynamic(() => import("../home/ProviderTopology"), { ssr: false });

export function HomeProviderTopologySection({
  providers,
  combos = [],
  lastProvider,
  errorProvider,
  enabled = true,
}: {
  providers: ProviderEntry[];
  combos?: TopologyCombo[];
  lastProvider: string;
  errorProvider: string;
  enabled?: boolean;
}) {
  const t = useTranslations("home");
  const [isExpandedHeight, setIsExpandedHeight] = useState(false);

  // Gate the live-WS connection so it only opens while the topology section is shown
  const { activeRequests: liveActiveRequests } = useLiveRequests({ enabled });
  const activeRequests = selectActiveRequests(liveActiveRequests);
  const activeProviderCount = new Set(activeRequests.map(({ provider }) => provider)).size;

  const totalModels = providers.reduce((acc, p) => acc + (p.models?.length || 0), 0);
  const verifiedModels = providers.reduce(
    (acc, p) =>
      acc +
      (p.models?.filter((m) => m.testStatus === "verified" || m.testHttpStatus === 200).length || 0),
    0
  );

  return (
    <Card
      padding="sm"
      className={`flex flex-col transition-all duration-300 overflow-hidden ${
        isExpandedHeight ? "h-[500px] sm:h-[560px]" : "h-[320px] sm:h-[350px]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-border/70 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("providerTopology")}
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
            <span className="size-1.5 rounded-full bg-primary" />
            {providers.length} {providers.length === 1 ? "Provider" : "Providers"}
          </span>

          {totalModels > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="material-symbols-outlined text-[11px]">smart_toy</span>
              {totalModels} {totalModels === 1 ? "Model" : "Models"}
              {verifiedModels > 0 && <span>({verifiedModels} Verified)</span>}
            </span>
          )}

          {combos.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <span className="material-symbols-outlined text-[11px]">alt_route</span>
              {combos.length} {combos.length === 1 ? "Combo" : "Combos"}
            </span>
          )}

          {activeProviderCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              {activeProviderCount} in-flight
            </span>
          ) : (
            <span className="text-[10px] text-text-muted hidden md:inline">
              · Ready & Connected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-green-500 shadow-xs" />
              {t("topologyLegendActive")}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-amber-500 shadow-xs" />
              {t("topologyLegendRecent")}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-red-500 shadow-xs" />
              {t("topologyLegendError")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpandedHeight((h) => !h)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border/70 hover:bg-bg-subtle text-[11px] font-medium text-text-muted hover:text-text-main transition-colors shadow-2xs"
            title={isExpandedHeight ? "Compact Canvas" : "Expand Canvas"}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isExpandedHeight ? "unfold_less" : "unfold_more"}
            </span>
            <span>{isExpandedHeight ? "Compact" : "Expand"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-border/50 bg-bg-subtle/10">
        <ProviderTopology
          providers={providers}
          combos={combos}
          activeRequests={activeRequests}
          lastProvider={lastProvider}
          errorProvider={errorProvider}
          className="h-full w-full"
        />
      </div>
    </Card>
  );
}
