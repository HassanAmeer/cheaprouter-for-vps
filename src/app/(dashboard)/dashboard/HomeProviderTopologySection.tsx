"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";

import { Card } from "@/shared/components";
import { useLiveRequests } from "@/hooks/useLiveDashboard";
import { selectActiveRequests } from "../home/topologyUtils";

const ProviderTopology = dynamic(() => import("../home/ProviderTopology"), { ssr: false });

type TopologyProvider = {
  id: string;
  provider: string;
  name?: string;
  /** Connection-health base state, so the topology can colour a node at rest. */
  status?: "active" | "error" | "idle";
};

export function HomeProviderTopologySection({
  providers,
  lastProvider,
  errorProvider,
  enabled = true,
}: {
  providers: TopologyProvider[];
  lastProvider: string;
  errorProvider: string;
  enabled?: boolean;
}) {
  const t = useTranslations("home");
  // #4596: gate the live-WS connection so it only opens while the topology
  // section is actually shown on the home page.
  const { activeRequests: liveActiveRequests } = useLiveRequests({ enabled });
  const activeRequests = selectActiveRequests(liveActiveRequests);
  const activeProviderCount = new Set(activeRequests.map(({ provider }) => provider)).size;

  return (
    <Card padding="sm" className="flex flex-col h-[270px] sm:h-[295px] overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("providerTopology")}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-bg-subtle text-text-muted border border-border/50">
            {providers.length} {providers.length === 1 ? "node" : "nodes"}
          </span>
          <span className="text-[11px] text-text-muted hidden sm:inline">
            · {t("activeError", { active: activeProviderCount, errors: errorProvider ? 1 : 0 })}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-text-muted">
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
      </div>
      <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden border border-border/50 bg-bg-subtle/10">
        <ProviderTopology
          providers={providers}
          activeRequests={activeRequests}
          lastProvider={lastProvider}
          errorProvider={errorProvider}
          className="h-full w-full"
        />
      </div>
    </Card>
  );
}
