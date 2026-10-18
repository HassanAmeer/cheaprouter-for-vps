"use client";

import { useTranslations } from "next-intl";

import { useState, useEffect, useMemo, useCallback, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, ShimmerPageLoader, Button, Modal } from "@/shared/components";
import { AI_PROVIDERS, NOAUTH_PROVIDERS, OAUTH_PROVIDERS } from "@/shared/constants/providers";
import {
  isProviderConnectionConnected,
  isProviderConnectionErrored,
} from "@/shared/utils/providerConnectionStatus";
import { useNotificationStore } from "@/store/notificationStore";
import { extractApiErrorMessage } from "@/shared/http/apiErrorMessage";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { getProviderDisplayLabel } from "@/shared/utils/providerDisplayLabel";
import { useIsElectron, useOpenExternal } from "@/shared/hooks/useElectron";
import { HomeProviderTopologySection } from "./HomeProviderTopologySection";
import { shouldShowProviderTopologyOnHome } from "./homeAppearance";
import HomeAnalytics from "../home/HomeAnalytics";
import HomeRecentRequests from "../home/HomeRecentRequests";

type UpdateStep = {
  step: string;
  status: string;
  message: string;
};

type VersionInfo = {
  current: string;
  latest: string;
  updateAvailable: boolean;
  channel: string;
  autoUpdateSupported: boolean;
  autoUpdateError?: string | null;
};

type HomePageClientProps = {
  machineId?: string;
};

type ProviderSummaryItem = {
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
  authType: "free" | "oauth" | "apikey" | string;
};

type ProviderMetricSummary = {
  totalRequests?: number;
  totalSuccesses?: number;
  successRate?: number;
  avgLatencyMs?: number;
  lastRequestAt?: string | null;
  lastErrorAt?: string | null;
  lastStatus?: number | null;
  lastErrorStatus?: number | null;
};

type ProviderModelSummary = {
  fullModel: string;
  alias?: string;
  model?: string;
};

const PROVIDER_ALIAS_TO_ID = new Map(
  Object.entries(AI_PROVIDERS)
    .flatMap(([providerId, providerInfo]) =>
      providerInfo.alias ? [[providerInfo.alias.toLowerCase(), providerId]] : []
    )
    .filter((entry): entry is [string, string] => entry.length === 2)
);

function normalizeProviderId(providerId?: string | null): string {
  const normalized = typeof providerId === "string" ? providerId.trim().toLowerCase() : "";
  if (!normalized) return "";
  return AI_PROVIDERS[normalized] ? normalized : PROVIDER_ALIAS_TO_ID.get(normalized) || normalized;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mergeUpdateStep(steps: UpdateStep[], nextStep: UpdateStep) {
  const idx = steps.findIndex((step) => step.step === nextStep.step);
  if (idx === -1) {
    return [...steps, nextStep];
  }

  const next = [...steps];
  next[idx] = nextStep;
  return next;
}

// Stable no-op subscription for useSyncExternalStore reads of never-changing
// browser globals (location.origin does not change without a full navigation).
function emptySubscribe() {
  return () => {};
}

export default function HomePageClient({ machineId: _machineId }: HomePageClientProps) {
  const router = useRouter();
  const isElectron = useIsElectron();
  const { openExternal } = useOpenExternal();
  const t = useTranslations("home");
  const tp = useTranslations("providers");
  const [providerConnections, setProviderConnections] = useState([]);
  const [models, setModels] = useState([]);
  const [modelCustomizations, setModelCustomizations] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // useSyncExternalStore keeps SSR/hydration consistent ("/v1" on the server,
  // the real origin after hydration) without a setState-in-effect round-trip.
  const baseUrl = useSyncExternalStore(
    emptySubscribe,
    () => `${globalThis.location.origin}/v1`,
    () => "/v1"
  );
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providerMetrics, setProviderMetrics] = useState<Record<string, ProviderMetricSummary>>({});
  const [providerTopology, setProviderTopology] = useState({ lastProvider: "", errorProvider: "" });
  const [providerNodes, setProviderNodes] = useState<
    Array<{ id?: string; prefix?: string; name?: string; isActive?: boolean }>
  >([]);

  // The live in-flight request feed for the Provider Topology pulse animation is owned by
  // <HomeProviderTopologySection>, which subscribes to it (gated by the `enabled` prop)
  // only when the topology is actually shown. HomePageClient must NOT open its own
  // unconditional live socket: the binding here was unused (ReferenceError in prod,
  // #4759/#4745) and the socket opened even when topology was hidden (#4596).

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [updating, setUpdating] = useState(false);

  // Platform detection and download links for Electron
  const platform =
    typeof window === "undefined" ? undefined : (window as any).electronAPI?.platform;
  // Destructured to locals: `versionInfo?.current` in a dependency array trips
  // the lint heuristic that treats any `.current` access as a mutable ref read.
  const installedVersion = versionInfo?.current || "";
  const latestVersion = versionInfo?.latest || "";
  const electronDownload = useMemo(() => {
    const cleanLatest = latestVersion.replace(/^v/, "");
    if (platform === "darwin") {
      return {
        label: t("downloadDmg"),
        url: `https://github.com/diegosouzapw/CheapRoute/releases/download/v${cleanLatest}/CheapRoute-${cleanLatest}.dmg`,
        desc: t("downloadDmgDescription", { version: installedVersion }),
      };
    }
    if (platform === "win32") {
      return {
        label: t("downloadExe"),
        url: `https://github.com/diegosouzapw/CheapRoute/releases/download/v${cleanLatest}/CheapRoute.Setup.${cleanLatest}.exe`,
        desc: t("downloadExeDescription", { version: installedVersion }),
      };
    }
    if (platform === "linux") {
      return {
        label: t("downloadAppImage"),
        url: `https://github.com/diegosouzapw/CheapRoute/releases/download/v${cleanLatest}/CheapRoute-${cleanLatest}.AppImage`,
        desc: t("downloadAppImageDescription", { version: installedVersion }),
      };
    }
    return {
      label: t("downloadUpdate"),
      url: `https://github.com/diegosouzapw/CheapRoute/releases/tag/v${cleanLatest}`,
      desc: t("downloadUpdateDescription", { version: installedVersion }),
    };
  }, [platform, t, latestVersion, installedVersion]);

  // Electron internal auto-updater state and listeners
  const [electronUpdateStatus, setElectronUpdateStatus] = useState<{
    status:
      "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
    version?: string;
    percent?: number;
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    const electronAPI = typeof window !== "undefined" ? (window as any).electronAPI : undefined;
    if (!isElectron || !electronAPI) return;

    // Trigger initial check silently on mount
    electronAPI.checkForUpdates().catch((err: any) => {
      console.error("[Electron] Check for updates failed:", err);
    });

    const dispose = electronAPI.onUpdateStatus((data: any) => {
      setElectronUpdateStatus({
        status: data.status,
        version: data.version,
        percent: data.percent,
        message: data.message,
      });
    });

    return dispose;
  }, [isElectron]);

  const [updateSteps, setUpdateSteps] = useState<UpdateStep[]>([]);
  const [updatePhase, setUpdatePhase] = useState<"idle" | "running" | "done" | "failed">("idle");

  // Appearance settings for home page pinning
  const [showQuickStartOnHome, setShowQuickStartOnHome] = useState(true); // default on
  const [isQuickStartExpanded, setIsQuickStartExpanded] = useState(false); // default collapsed
  const [isApiFlowExpanded, setIsApiFlowExpanded] = useState(false); // default collapsed
  const [isTopologyExpanded, setIsTopologyExpanded] = useState(false); // default collapsed
  // #4596: default hidden until appearance settings load, so the live-WS
  // topology connection is never opened before we know the user wants it.
  const [showProviderTopologyOnHome, setShowProviderTopologyOnHome] = useState(false);
  const [appearanceSettingsLoaded, setAppearanceSettingsLoaded] = useState(false);

  useEffect(() => {
    // Fetch the pin settings (lightweight)
    fetch("/api/settings")
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, any>>) : ({} as Record<string, any>)))
      .then((data: Record<string, any>) => {
        if (data) {
          if (typeof data.showQuickStartOnHome === "boolean") {
            setShowQuickStartOnHome(data.showQuickStartOnHome);
          }
          // #4596 regression fix: the topology card defaults ON (matches the
          // AppearanceTab toggle's `!== false`). Honoring only an explicit boolean
          // left the card hidden whenever the setting was never persisted
          // (undefined), silently removing it for most installs. The live-WS
          // connection is still gated by `appearanceSettingsLoaded` in the data
          // effect, so it is never opened before settings load.
          setShowProviderTopologyOnHome(
            shouldShowProviderTopologyOnHome(data.showProviderTopologyOnHome)
          );
        }
      })
      .catch(() => {
        /* ignore — defaults stay */
      })
      .finally(() => {
        setAppearanceSettingsLoaded(true);
      });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [provRes, modelsRes, versionRes, curationRes, combosRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models"),
        fetch("/api/system/version"),
        fetch("/api/v1/models/curation").catch(() => null),
        fetch("/api/combos").catch(() => null),
      ]);
      if (provRes.ok) {
        const provData = await provRes.json();
        setProviderConnections(provData.connections || []);
      }
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setModels(modelsData.models || []);
      }
      if (versionRes.ok) {
        const versionData = await versionRes.json();
        setVersionInfo(versionData);
      }
      if (curationRes && curationRes.ok) {
        const curationData = await curationRes.json();
        setModelCustomizations(Array.isArray(curationData.customizations) ? curationData.customizations : []);
      }
      if (combosRes && combosRes.ok) {
        const combosData = await combosRes.json();
        const cList = Array.isArray(combosData.combos)
          ? combosData.combos
          : Array.isArray(combosData)
            ? combosData
            : [];
        setCombos(cList);
      }
    } catch (e) {
      console.log("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();
  }, [fetchData]);

  // Fetch provider nodes for display labels (compat providers)
  useEffect(() => {
    fetch("/api/provider-nodes")
      .then((r) => (r.ok ? r.json() : { nodes: [] }))
      .then((d) => setProviderNodes(d.nodes || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!appearanceSettingsLoaded || !showProviderTopologyOnHome) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const loadTopologyActivity = async () => {
      const currentController = new AbortController();
      controller = currentController;
      try {
        const metricsRes = await fetch("/api/provider-metrics", {
          cache: "no-store",
          signal: currentController.signal,
        });
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          if (!cancelled) {
            setProviderMetrics(data.metrics || {});
            setProviderTopology({
              lastProvider: normalizeProviderId(data.topology?.lastProvider),
              errorProvider: normalizeProviderId(data.topology?.errorProvider),
            });
          }
        }
      } catch (error) {
        const isAbortError = error instanceof DOMException && error.name === "AbortError";
        if (!cancelled && !isAbortError) {
          console.error("Failed to load topology activity:", error);
        }
      } finally {
        if (controller === currentController) {
          controller = null;
        }
        if (!cancelled) {
          timeoutId = setTimeout(loadTopologyActivity, 3000);
        }
      }
    };

    loadTopologyActivity();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [appearanceSettingsLoaded, showProviderTopologyOnHome]);

  // T07: Check for unhealthy API keys and show notification (once per session)
  const notifiedUnhealthyKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    const checkApiKeyHealth = () => {
      const newUnhealthyKeys = new Set<string>();
      const unhealthyProviderIds = new Set<string>();
      const unhealthyConnections: string[] = [];
      let firstUnhealthyProviderId: string | null = null;
      let hasWarning = false;

      for (const conn of providerConnections) {
        const health = conn.providerSpecificData?.apiKeyHealth as
          | Record<
              string,
              {
                status: "active" | "warning" | "invalid";
                failures: number;
                lastFailure: string | null;
              }
            >
          | undefined;
        if (!health) continue;

        // Defense-in-depth: skip stale extra_N health entries whose index
        // is out of range of the current extraApiKeys list.
        // The backend cleans this up on PATCH, but existing stale data from
        // before the fix or other code paths could still have orphan entries.
        const extras: string[] = conn.providerSpecificData?.extraApiKeys ?? [];
        const extraKeyCount = Array.isArray(extras) ? extras.length : 0;

        const unhealthyKeys = Object.entries(health).filter(([keyId, h]) => {
          if (h.status !== "invalid" && h.status !== "warning") return false;
          // extra_N entries: only flag if the index is still within bounds
          if (keyId.startsWith("extra_")) {
            const idx = Number.parseInt(keyId.slice(6), 10);
            if (Number.isNaN(idx) || idx >= extraKeyCount) return false;
          }
          return true;
        });

        if (unhealthyKeys.length > 0) {
          for (const [, h] of unhealthyKeys) {
            if (h.status === "warning") hasWarning = true;
            break;
          }
          for (const [keyId] of unhealthyKeys) {
            newUnhealthyKeys.add(`${conn.id}:${keyId}`);
          }
          firstUnhealthyProviderId ??= conn.provider;
          unhealthyConnections.push(conn.name || conn.id);
          unhealthyProviderIds.add(conn.provider);
        }
      }

      // Only notify for newly unhealthy keys (not already notified)
      const hasNewUnhealthy = Array.from(newUnhealthyKeys).some(
        (k) => !notifiedUnhealthyKeys.current.has(k)
      );
      if (hasNewUnhealthy) {
        const navigateTo =
          newUnhealthyKeys.size === 1 && firstUnhealthyProviderId
            ? `/dashboard/providers/${firstUnhealthyProviderId}`
            : `/dashboard/providers?search=${encodeURIComponent(Array.from(unhealthyProviderIds).join(" "))}`;

        const notificationType = hasWarning ? "warning" : "error";

        useNotificationStore.getState().addNotification({
          type: notificationType,
          message: tp(hasWarning ? "apiKeyWarningAlert" : "apiKeyInvalidAlert", {
            count: newUnhealthyKeys.size,
            connections: unhealthyConnections.join(", "),
          }),
          title: tp(hasWarning ? "apiKeyWarningAlertTitle" : "apiKeyInvalidAlertTitle"),
          duration: 10000,
          onClick: () => router.push(navigateTo),
        });
        // Mark all current unhealthy keys as notified
        newUnhealthyKeys.forEach((k) => notifiedUnhealthyKeys.current.add(k));
      }
    };

    if (providerConnections.length > 0) {
      checkApiKeyHealth();
    }
  }, [providerConnections, t, tp, router]);

  const providerStats = useMemo(() => {
    return Object.entries(AI_PROVIDERS).map(([providerId, providerInfo]) => {
      const connections = providerConnections.filter((conn) => conn.provider === providerId);
      const connected = connections.filter((connection) =>
        isProviderConnectionConnected(connection)
      ).length;
      const errors = connections.filter((connection) =>
        isProviderConnectionErrored(connection)
      ).length;

      const providerKeys = new Set([providerId, providerInfo.alias].filter(Boolean));
      const providerModels = models.filter((m) => providerKeys.has(m.provider));

      const authType = NOAUTH_PROVIDERS[providerId]
        ? "no-auth"
        : OAUTH_PROVIDERS[providerId]
          ? "oauth"
          : "apikey";

      return {
        id: providerId,
        provider: providerInfo,
        total: connections.length,
        connected,
        errors,
        modelCount: providerModels.length,
        authType,
      };
    });
  }, [providerConnections, models]);

  const selectedProviderModels = useMemo(() => {
    if (!selectedProvider) return [];
    const providerKeys = new Set(
      [selectedProvider.id, selectedProvider.provider?.alias].filter(Boolean)
    );
    return models.filter((m) => providerKeys.has(m.provider));
  }, [selectedProvider, models]);

  const topologyProviders = useMemo(() => {
    type ProviderHealth = "active" | "error" | "idle";
    const byProvider = new Map<
      string,
      { id: string; provider: string; name?: string; status: ProviderHealth; models?: any[] }
    >();
    const providerConfig = AI_PROVIDERS as Record<string, { name?: string }>;

    // Connection-health per provider, so the topology node reflects "what is connected"
    // at rest (green healthy / red error) instead of going blank between requests.
    const healthByProvider = new Map<string, ProviderHealth>();
    for (const stat of providerStats) {
      const canonical = normalizeProviderId(stat.id);
      if (!canonical) continue;
      healthByProvider.set(
        canonical,
        stat.connected > 0 ? "active" : stat.errors > 0 ? "error" : "idle"
      );
    }

    const activeCustoms = (modelCustomizations || []).filter((c) => c && c.isActive !== false);

    const addProvider = (providerId?: string | null, name?: string) => {
      const rawProviderId = typeof providerId === "string" ? providerId.trim() : "";
      if (!rawProviderId) return;

      const canonicalProviderId = normalizeProviderId(rawProviderId);
      if (!canonicalProviderId || byProvider.has(canonicalProviderId)) return;

      // Provider is active if it has active connection or active piped models
      const hasActiveConn = providerConnections.some(
        (c) => normalizeProviderId(c.provider) === canonicalProviderId && c.isActive !== false
      );
      const hasActiveModels = activeCustoms.some(
        (c) => normalizeProviderId(c.providerId) === canonicalProviderId
      );
      if (!hasActiveConn && !hasActiveModels) return;

      // Exclude paused custom provider nodes
      const customNode = (providerNodes || []).find(
        (n) =>
          normalizeProviderId(n.id) === canonicalProviderId ||
          (n.prefix && normalizeProviderId(n.prefix) === canonicalProviderId)
      );
      if (customNode && customNode.isActive === false) return;

      const resolvedName =
        getProviderDisplayLabel(rawProviderId, providerNodes) ||
        name ||
        providerConfig[canonicalProviderId]?.name ||
        rawProviderId;

      const providerCustoms = activeCustoms.filter(
        (c) => normalizeProviderId(c.providerId) === canonicalProviderId
      );

      let providerModels: any[] = [];
      if (providerCustoms.length > 0) {
        providerModels = providerCustoms.map((c) => {
          const customName = c.customName?.trim();
          const customAlias = c.customAlias?.trim();
          const origId = c.originalModelId || "";
          const cleanOrig = origId.replace(/^[^/]+\//, "");
          const displayName = customName || customAlias || cleanOrig || origId;
          return {
            id: `${canonicalProviderId}/${origId}`,
            originalModelId: origId,
            name: displayName,
            customAlias: customAlias || null,
            isActive: c.isActive !== false,
            isTested: Boolean(c.isTested),
            testStatus: c.testStatus || null,
            testHttpStatus: c.testHttpStatus != null ? Number(c.testHttpStatus) : null,
            testLatencyMs: c.testLatencyMs != null ? Number(c.testLatencyMs) : null,
            pricingTier: c.pricingTier || (c.isFreeOverride ? "free" : null),
            contextWindow: c.contextWindow != null ? Number(c.contextWindow) : null,
          };
        });
      } else {
        const catalogModels = (models || []).filter(
          (m: any) => normalizeProviderId(m.provider) === canonicalProviderId && m.available !== false
        );
        providerModels = catalogModels.slice(0, 10).map((m: any) => ({
          id: `${canonicalProviderId}/${m.model}`,
          originalModelId: m.model,
          name: m.name || m.alias || m.model,
          customAlias: m.alias || null,
          isActive: true,
          isTested: false,
          testStatus: null,
          testHttpStatus: null,
          testLatencyMs: null,
          pricingTier: null,
          contextWindow: null,
        }));
      }

      byProvider.set(canonicalProviderId, {
        id: canonicalProviderId,
        provider: canonicalProviderId,
        name: resolvedName,
        status: healthByProvider.get(canonicalProviderId) ?? (hasActiveConn ? "active" : "idle"),
        models: providerModels,
      });
    };

    providerStats
      .filter((provider) => provider.total > 0 && provider.connected > 0)
      .forEach((provider) => addProvider(provider.id, provider.provider.name));
    providerConnections
      .filter((c) => c.isActive !== false)
      .forEach((conn) => addProvider(conn.provider));
    activeCustoms.forEach((c) => {
      if (c.providerId) addProvider(c.providerId);
    });
    Object.keys(providerMetrics).forEach((provider) => addProvider(provider));

    return Array.from(byProvider.values());
  }, [providerStats, providerMetrics, providerNodes, providerConnections, modelCustomizations, models]);

  const topologyCombos = useMemo(() => {
    return (combos || [])
      .filter((c: any) => c && c.isActive !== false && !c.isHidden)
      .map((c: any) => ({
        id: c.id || c.name,
        name: c.name,
        strategy: c.strategy || "priority",
        models: Array.isArray(c.models)
          ? c.models.map((m: any) => (typeof m === "string" ? m : m.model || m.id))
          : [],
        isActive: c.isActive !== false,
      }));
  }, [combos]);

  const { lastProvider, errorProvider } = providerTopology;

  // Self-defined provider nodes (openai-compatible-* and similar) are not part of
  // the AI_PROVIDERS catalog, so count them separately for the home analytics.
  const customProvidersCount = useMemo(
    () =>
      providerNodes.filter((node) => {
        const nodeId = typeof node?.id === "string" ? node.id.trim() : "";
        return nodeId && !AI_PROVIDERS[nodeId];
      }).length,
    [providerNodes]
  );

  const pollBackgroundUpdate = useCallback(
    async ({
      channel,
      message,
      targetVersion,
    }: {
      channel: string;
      message: string;
      targetVersion: string;
    }) => {
      const notify = useNotificationStore.getState();
      const initialSteps =
        channel === "docker-compose"
          ? [
              {
                step: "install",
                status: "done",
                message: message || t("updateQueued", { version: targetVersion }),
              },
              {
                step: "rebuild",
                status: "running",
                message: t("updateDockerRebuilding"),
              },
              {
                step: "restart",
                status: "pending",
                message: t("updateWaitingRestart"),
              },
            ]
          : [
              {
                step: "install",
                status: "running",
                message: message || t("updateInstalling", { version: targetVersion }),
              },
              {
                step: "restart",
                status: "pending",
                message: t("updateWaitingRestart"),
              },
            ];

      setUpdateSteps(initialSteps);

      const maxAttempts = channel === "docker-compose" ? 72 : 36;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await wait(5000);

        try {
          const versionRes = await fetch("/api/system/version", { cache: "no-store" });
          if (!versionRes.ok) {
            throw new Error(`Version check returned ${versionRes.status}`);
          }

          const latestInfo = await versionRes.json();
          setVersionInfo(latestInfo);

          if (latestInfo.current === targetVersion) {
            setUpdateSteps((prev) => {
              let next = prev.map((step) => {
                if (step.step === "install" || step.step === "rebuild" || step.step === "restart") {
                  return { ...step, status: "done" };
                }
                return step;
              });

              next = mergeUpdateStep(next, {
                step: "complete",
                status: "done",
                message: t("updateRunning", { version: targetVersion }),
              });

              return next;
            });
            setUpdating(false);
            setUpdatePhase("done");
            notify.success(t("updateCompleted", { version: targetVersion }));
            await fetchData();
            return;
          }

          setUpdateSteps((prev) => {
            let next = prev;
            if (channel === "docker-compose") {
              next = mergeUpdateStep(next, {
                step: "rebuild",
                status: "running",
                message: t("updateDockerStillRebuilding", { version: targetVersion }),
              });
            } else {
              next = mergeUpdateStep(next, {
                step: "install",
                status: "running",
                message: t("updateInstallingBackground", { version: targetVersion }),
              });
            }

            next = mergeUpdateStep(next, {
              step: "restart",
              status: "pending",
              message: t("updateWaitingVersion", { version: targetVersion }),
            });

            return next;
          });
        } catch {
          setUpdateSteps((prev) => {
            let next = prev;
            if (channel === "docker-compose") {
              next = mergeUpdateStep(next, {
                step: "rebuild",
                status: "running",
                message: t("updateDockerStillInProgress"),
              });
            } else {
              next = mergeUpdateStep(next, {
                step: "install",
                status: "running",
                message: t("updateInstallingBackground", { version: targetVersion }),
              });
            }

            next = mergeUpdateStep(next, {
              step: "restart",
              status: "running",
              message: t("updateRestarting"),
            });

            return next;
          });
        }
      }

      setUpdateSteps((prev) =>
        mergeUpdateStep(prev, {
          step: "error",
          status: "failed",
          message: t("updateTimeout", { version: targetVersion }),
        })
      );
      setUpdating(false);
      setUpdatePhase("failed");
      notify.error(t("updateTimedOut", { version: targetVersion }));
    },
    [fetchData, t]
  );

  const handleUpdate = async () => {
    const notify = useNotificationStore.getState();
    setUpdating(true);
    setUpdatePhase("running");
    setUpdateSteps([]);

    try {
      const res = await fetch("/api/system/version", { method: "POST" });

      // If response is JSON (error/already up to date)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          // #5991: the error envelope is `{ error: { code, message, correlation_id } }`.
          // Passing the raw object to notify.error() rendered it as a React child →
          // "Minified React error #31" crash ("Internal Server Error" screen), e.g. on
          // the 403 from the loopback-only /api/system/version. Extract the string.
          notify.error(extractApiErrorMessage(data, t("updateStartFailed")));
          setUpdating(false);
          setUpdatePhase("idle");
          return;
        }
        notify.success(data.message || t("updateStarted"));
        await pollBackgroundUpdate({
          channel: data.channel || "docker-compose",
          message: data.message || "",
          targetVersion: data.to || data.latest,
        });
        return;
      }

      // SSE stream — read progress events
      if (!res.body) {
        notify.error(t("noResponseStream"));
        setUpdating(false);
        setUpdatePhase("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            setUpdateSteps((prev) => {
              return mergeUpdateStep(prev, event);
            });

            if (event.step === "complete") {
              setUpdatePhase("done");
              setUpdating(false);
              notify.success(event.message || t("updateComplete"));
            } else if (event.step === "error") {
              setUpdatePhase("failed");
              notify.error(event.message || t("updateFailed"));
              setUpdating(false);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setUpdatePhase("failed");
      setUpdateSteps((prev) => [
        ...prev,
        {
          step: "error",
          status: "failed",
          message: t("updateNetworkError"),
        },
      ]);
      setUpdating(false);
    }
  };

  // Auto-reload after successful update (service restarts, need new page)
  useEffect(() => {
    if (updatePhase !== "done") return;
    const timer = setTimeout(() => {
      globalThis.window.location.reload();
    }, 8000);
    return () => clearTimeout(timer);
  }, [updatePhase]);
  const stepLabels: Record<string, string> = {
    install: t("stepInstallPackage"),
    rebuild: t("stepRebuildNativeModules"),
    restart: t("stepRestartService"),
    complete: t("stepComplete"),
    error: t("stepError"),
  };
  const showUpdateOverlay = updatePhase !== "idle";

  if (loading) {
    return <ShimmerPageLoader variant="dashboard" />;
  }

  const currentEndpoint = baseUrl;

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3">
      {/* Update Progress Overlay */}
      {showUpdateOverlay && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-main border border-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-primary text-[28px] animate-spin">
                progress_activity
              </span>
              <div>
                <h3 className="text-lg font-bold">
                  {updatePhase === "done"
                    ? t("updateCompleteTitle")
                    : updatePhase === "failed"
                      ? t("updateFailedTitle")
                      : t("updatingTitle")}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {updatePhase === "done"
                    ? t("reloadNotice")
                    : updatePhase === "failed"
                      ? t("retryNotice")
                      : t("restartNotice")}
                </p>
              </div>
            </div>

            {/* Step list */}
            <div className="flex flex-col gap-2">
              {updateSteps
                .filter((s) => s.step !== "complete" && s.step !== "error")
                .map((s) => (
                  <div
                    key={s.step}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      s.status === "running"
                        ? "border-primary/40 bg-primary/5"
                        : s.status === "done"
                          ? "border-green-500/30 bg-green-500/5"
                          : s.status === "failed"
                            ? "border-red-500/30 bg-red-500/5"
                            : "border-border bg-bg-subtle"
                    }`}
                  >
                    {s.status === "running" ? (
                      <span className="material-symbols-outlined text-primary text-[18px] animate-spin">
                        progress_activity
                      </span>
                    ) : s.status === "done" ? (
                      <span className="material-symbols-outlined text-green-500 text-[18px]">
                        check_circle
                      </span>
                    ) : s.status === "failed" ? (
                      <span className="material-symbols-outlined text-red-500 text-[18px]">
                        error
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-amber-500 text-[18px]">
                        warning
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{stepLabels[s.step] || s.step}</p>
                      <p className="text-xs text-text-muted truncate">{s.message}</p>
                    </div>
                  </div>
                ))}

              {/* Error message */}
              {updateSteps.find((s) => s.step === "error") && (
                <div className="mt-1 px-3 py-2.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-500">
                  <p className="text-xs font-mono break-all">
                    {updateSteps.find((s) => s.step === "error")?.message}
                  </p>
                </div>
              )}

              {/* Completion message */}
              {updatePhase === "done" && (
                <div className="mt-1 px-3 py-2.5 rounded-lg border border-green-500/30 bg-green-500/5">
                  <p className="text-sm font-semibold text-green-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    {updateSteps.find((s) => s.step === "complete")?.message || t("updateComplete")}
                  </p>
                  <p className="text-xs text-text-muted mt-1">{t("reloadingPageAutomatically")}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(updatePhase === "failed" || updatePhase === "done") && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setUpdating(false);
                    setUpdatePhase("idle");
                    setUpdateSteps([]);
                    if (updatePhase === "done") globalThis.window.location.reload();
                  }}
                >
                  {updatePhase === "done" ? t("reloadNow") : t("closeUpdate")}
                </Button>
                {updatePhase === "failed" && (
                  <Button size="sm" variant="secondary" fullWidth onClick={handleUpdate}>
                    {t("retryUpdate")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Update Notification Banner */}
      {versionInfo?.updateAvailable && !showUpdateOverlay && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/10 px-5 py-4 text-primary">
            <div className="flex min-h-[48px] items-center justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="material-symbols-outlined shrink-0 text-[24px]">
                  {isElectron && electronUpdateStatus.status === "downloading"
                    ? "downloading"
                    : "system_update_alt"}
                </span>
                <div>
                  <p className="font-semibold text-sm">
                    {t("updateAvailableTitle", {
                      version: versionInfo.latest,
                      desktop: isElectron ? ` ${t("desktopAppLabel")}` : "",
                    })}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {isElectron ? (
                      <>
                        {electronUpdateStatus.status === "checking" && t("checkingForUpdates")}
                        {electronUpdateStatus.status === "available" &&
                          t("versionAvailableForDownload", { version: versionInfo.latest })}
                        {electronUpdateStatus.status === "downloading" &&
                          t("downloadingUpdate", { percent: electronUpdateStatus.percent || 0 })}
                        {electronUpdateStatus.status === "downloaded" && t("updateDownloaded")}
                        {electronUpdateStatus.status === "error" &&
                          t("autoUpdateFailed", {
                            reason: electronUpdateStatus.message || t("unknownUpdateError"),
                          })}
                        {(electronUpdateStatus.status === "idle" ||
                          electronUpdateStatus.status === "not-available") &&
                          t("versionAvailableDesktop", { version: versionInfo.latest })}
                      </>
                    ) : versionInfo.autoUpdateSupported ? (
                      t("updateAvailableDesc")
                    ) : (
                      versionInfo.autoUpdateError || t("manualUpdateRequired")
                    )}
                  </p>
                </div>
              </div>

              {isElectron ? (
                <div className="flex gap-2 shrink-0 ml-4">
                  {electronUpdateStatus.status === "available" && (
                    <Button
                      size="sm"
                      onClick={() => (window as any).electronAPI?.downloadUpdate()}
                      className="font-semibold"
                    >
                      {t("downloadUpdate")}
                    </Button>
                  )}
                  {electronUpdateStatus.status === "downloading" && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20">
                      <span className="material-symbols-outlined text-primary text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span className="text-xs font-semibold">
                        {electronUpdateStatus.percent || 0}%
                      </span>
                    </div>
                  )}
                  {electronUpdateStatus.status === "downloaded" && (
                    <Button
                      size="sm"
                      onClick={() => (window as any).electronAPI?.installUpdate()}
                      className="font-semibold animate-pulse"
                    >
                      {t("restartAndInstall")}
                    </Button>
                  )}
                  {(electronUpdateStatus.status === "error" ||
                    electronUpdateStatus.status === "idle" ||
                    electronUpdateStatus.status === "not-available") && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setElectronUpdateStatus({ status: "checking" });
                        (window as any).electronAPI?.checkForUpdates().catch((err: any) => {
                          setElectronUpdateStatus({ status: "error", message: err.message });
                        });
                      }}
                      className="font-semibold"
                    >
                      {t("checkForUpdate")}
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={versionInfo.autoUpdateSupported ? handleUpdate : undefined}
                  disabled={updating || !versionInfo.autoUpdateSupported}
                  className="ml-4 shrink-0 font-semibold"
                  title={versionInfo.autoUpdateError || ""}
                >
                  {versionInfo.autoUpdateSupported ? t("updateNow") : t("manualUpdate")}
                </Button>
              )}
            </div>

            {/* Direct download fallback links shown if in Electron and auto-updater has failed, is idle, or has completed check */}
            {isElectron &&
              (electronUpdateStatus.status === "error" ||
                electronUpdateStatus.status === "idle" ||
                electronUpdateStatus.status === "available" ||
                electronUpdateStatus.status === "not-available") && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-primary/20 mt-2 pt-3 gap-2">
                  <p className="text-xs opacity-75">{t("directDownloadHint")}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        openExternal(
                          `https://github.com/diegosouzapw/CheapRoute/releases/tag/v${versionInfo.latest}`
                        )
                      }
                      className="font-semibold text-xs py-1"
                    >
                      {t("releaseNotes")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openExternal(electronDownload.url)}
                      className="font-semibold text-xs py-1"
                    >
                      {electronDownload.label}
                    </Button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Quick Start (controlled by Appearance setting, default on) */}
      {showQuickStartOnHome && (
        <Card>
          <div className="flex flex-col gap-4">
            {/* Header: Title, Subtitle, Step Badge, Full Docs Link, and Collapse/Expand Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Quick Start Guide
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      8 Steps · Core Workflow
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">
                    Step-by-step setup: connect providers, create combos, pipe models, configure limits & users, query APIs, and track usage.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => setIsQuickStartExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-xs"
                  aria-expanded={isQuickStartExpanded}
                  title={isQuickStartExpanded ? "Collapse guide" : "Expand guide"}
                >
                  <span>{isQuickStartExpanded ? "Collapse" : "Expand Guide"}</span>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                      isQuickStartExpanded ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* Collapsed Preview Roadmap Bar */}
            {!isQuickStartExpanded && (
              <div
                onClick={() => setIsQuickStartExpanded(true)}
                className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2 cursor-pointer group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setIsQuickStartExpanded(true);
                  }
                }}
              >
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  Workflow:
                </span>
                {[
                  { num: "1", name: "Providers", icon: "dns" },
                  { num: "2", name: "Combos", icon: "layers" },
                  { num: "3", name: "Pipe Models", icon: "tune" },
                  { num: "4", name: "Limits", icon: "speed" },
                  { num: "5", name: "Users", icon: "groups" },
                  { num: "6", name: "API Keys", icon: "vpn_key" },
                  { num: "7", name: "Endpoints", icon: "api" },
                  { num: "8", name: "Usage", icon: "analytics" },
                ].map((s, idx) => (
                  <div key={s.num} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/80 group-hover:bg-primary/10 group-hover:text-primary border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover:text-primary">
                        {s.num}
                      </span>
                      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                      <span>{s.name}</span>
                    </span>
                    {idx < 7 && (
                      <span className="text-zinc-300 dark:text-zinc-600 text-xs font-bold">→</span>
                    )}
                  </div>
                ))}
                <span className="text-xs text-primary font-medium ml-auto flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Expand all 8 steps <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </span>
              </div>
            )}

            {/* Expanded Detailed 8 Steps Grid */}
            {isQuickStartExpanded && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Step 1: Connect Provider */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Step 01
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">dns</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Connect Providers
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Connect upstream AI providers (Custom or Pre-configured / Prefix providers). Choose your model types and test models directly in provider details before deploying.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/providers"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Providers
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 2: Create Combo */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        Step 02
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">layers</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Create Model Combos
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Select different models to create load-balanced combos. Give your combo a custom name, add multiple models, and select routing strategies (Auto-Combo, Random, Priority, Weighted, etc.).
                    </p>
                  </div>
                  <Link
                    href="/dashboard/combos"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Combos
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 3: Manage & Pipe Models */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        Step 03
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">tune</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Pipe Models & Combos
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Select models and combos to pipe for usage.{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        Only piped models will be accessible via APIs and available to users.
                      </strong>{" "}
                      Rename models, set custom aliases, adjust context windows, set token prices, and assign Free or Pro tiers.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/manage-models"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Pipe Models
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 4: Limits Bank */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        Step 04
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">speed</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Limits Bank
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Configure token quota ceilings on piped models and combos (e.g. 500M, 10B, 1B, or unlimited). Specify total token capacity and reset windows to protect upstream budgets.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/limits"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Limits Bank
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 5: User Management */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        Step 05
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">groups</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      User Management
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Create reseller users and assign token limits or unlimited access. Set RPM (requests per minute) caps, assign Free or Pro plans, monitor generated API keys and BYOK credentials, or ban and enable/disable accounts.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/users"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Users
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 6: User API Keys */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Step 06
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      User API Keys
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Select created users and generate dedicated API keys. Directly pause and resume keys from the table, view creation dates, copy keys securely, or permanently delete keys.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/api-manager"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open API Keys
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 7: Go to Endpoints */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        Step 07
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">api</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Integrate Endpoints
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Query <code className="px-1 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">{currentEndpoint}/v1/models</code> or send requests to <code className="px-1 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">{currentEndpoint}/v1/chat/completions</code>.{" "}
                      <strong className="text-zinc-800 dark:text-zinc-200">
                        Only piped models will appear in /v1/models.
                      </strong>
                    </p>
                  </div>
                  <Link
                    href="/dashboard/endpoint"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    View Endpoints
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>

                {/* Step 8: Usage & Limits Tracking */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        Step 08
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Usage & Limits
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      Monitor token consumption across all users and models. Track consumed vs remaining tokens against Limits Bank ceilings, inspect RPM request rates, and review active usage logs.
                    </p>
                  </div>
                  <Link
                    href="/dashboard/usage"
                    prefetch={false}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                  >
                    Open Usage Analytics
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* API Creation & Testing Quick Flow */}
      {showQuickStartOnHome && (
        <Card>
          <div className="flex flex-col gap-4">
            {/* Header: Title, Subtitle, Badge, and Collapse/Expand Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">api</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      API Creation & Testing Quick Flow
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      4 Steps · API Access & Test
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">
                    Fast client setup: Register user identity → Issue API key → Test endpoints → Monitor usage & limits.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => setIsApiFlowExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-xs"
                  aria-expanded={isApiFlowExpanded}
                  title={isApiFlowExpanded ? "Collapse API flow" : "Expand API flow"}
                >
                  <span>{isApiFlowExpanded ? "Collapse" : "Expand Flow"}</span>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform duration-200 ${
                      isApiFlowExpanded ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
              </div>
            </div>

            {/* Collapsed Preview Roadmap Bar */}
            {!isApiFlowExpanded && (
              <div
                onClick={() => setIsApiFlowExpanded(true)}
                className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2 cursor-pointer group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setIsApiFlowExpanded(true);
                  }
                }}
              >
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  API Flow:
                </span>
                {[
                  { num: "1", name: "Users", icon: "person_add" },
                  { num: "2", name: "API Keys", icon: "vpn_key" },
                  { num: "3", name: "Test Endpoints", icon: "api" },
                  { num: "4", name: "Check Usage", icon: "analytics" },
                ].map((s, idx) => (
                  <div key={s.num} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/80 group-hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-400 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 group-hover:text-sky-500">
                        {s.num}
                      </span>
                      <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
                      <span>{s.name}</span>
                    </span>
                    {idx < 3 && (
                      <span className="text-zinc-300 dark:text-zinc-600 text-xs font-bold">→</span>
                    )}
                  </div>
                ))}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium ml-1">
                  <span className="material-symbols-outlined text-[14px]">science</span>
                  Playground (Piped Models Only)
                </span>
                <span className="text-xs text-sky-600 dark:text-sky-400 font-medium ml-auto flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Expand full flow <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </span>
              </div>
            )}

            {/* Expanded Detailed 4 Steps Grid + Playground Callout */}
            {isApiFlowExpanded && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Step 1: Add User */}
                  <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                          Step 01
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">person_add</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        Add User First
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        API key issue karne se pehle user create karein. User ID aur username assign karein taake keys, limits aur quota usage specifically us user ke account ke saath link ho sakein.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/users"
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      Manage Users
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>

                  {/* Step 2: Create API Key */}
                  <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Step 02
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">vpn_key</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        Generate API Key
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        Selected user ke liye unique API key create karein. Yahan se key copy karein, pause aur resume states manage karein, ya revoke/delete karein. Extra options bilkul clean aur simple hain.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/api-manager"
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      Open API Keys
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>

                  {/* Step 3: Test Endpoints */}
                  <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          Step 03
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">api</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        View & Test Endpoints
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        Endpoints catalog par jayein aur visual test runner use karein. Apni newly generated API key ke sath OpenAI-compatible `/v1/chat/completions` request test karein aur live response verify karein.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/endpoint"
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      Test Endpoints
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>

                  {/* Step 4: Monitor Usage */}
                  <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-800/40 p-4 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Step 04
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[18px]">analytics</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        Monitor Usage & Limits
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                        Endpoint test calls ke baad token consumption check karein. Kaun se user ne kaun sa model use kiya, kitne tokens kharch hue, Limits Bank ke mutabiq kitni limit bachi hai, sab track karein.
                      </p>
                    </div>
                    <Link
                      href="/dashboard/usage"
                      prefetch={false}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline"
                    >
                      Check Usage
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>

                {/* Playground Interactive Testing Callout */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-linear-to-r from-sky-500/5 via-primary/5 to-purple-500/5 dark:from-sky-500/10 dark:via-primary/10 dark:to-purple-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[22px]">science</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          Test Directly in Playground
                        </h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Strict Policy: Piped Models Only
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed max-w-3xl">
                        Agar aap API code ya terminal ke baghair direct chat completions test karna chahte hain, toh Playground use kar sakte hain. <span className="font-semibold text-zinc-900 dark:text-zinc-100">Zaroori Note:</span> Playground ke andar sirf aur sirf wahi models show honge jo aapne <Link href="/dashboard/curation" className="underline hover:text-primary">Manage Models (Pipe Models)</Link> ke zariye pipe / curate kiye hain aur active combos hain.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/playground"
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shrink-0 transition-all shadow-xs cursor-pointer"
                  >
                    <span>Launch Playground</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Usage analytics: provider/token/key roll-up + topology + charts */}
      <HomeAnalytics
        providerStats={providerStats}
        customProviders={customProvidersCount}
        providerNodes={providerNodes}
        providerConnections={providerConnections}
        topologySection={
          showProviderTopologyOnHome ? (
            !isTopologyExpanded ? (
              <div
                onClick={() => setIsTopologyExpanded(true)}
                className="p-2.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 transition-all cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setIsTopologyExpanded(true);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <span className="material-symbols-outlined text-[15px] text-primary">hub</span>
                    Provider Topology & Recent Requests
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Nodes: {topologyProviders.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium group-hover:translate-x-0.5 transition-transform">
                  <span>Expand Topology & Live Requests</span>
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Provider Topology & Live Feed
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Nodes: {topologyProviders.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTopologyExpanded(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer shadow-xs"
                  >
                    <span>Collapse Topology</span>
                    <span className="material-symbols-outlined text-[16px]">expand_less</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-2.5">
                  <HomeProviderTopologySection
                    providers={topologyProviders}
                    combos={topologyCombos}
                    lastProvider={lastProvider}
                    errorProvider={errorProvider}
                    enabled={showProviderTopologyOnHome && isTopologyExpanded}
                  />
                  <HomeRecentRequests enabled={showProviderTopologyOnHome && isTopologyExpanded} />
                </div>
              </div>
            )
          ) : null
        }
      />

      {/* Provider Models Modal */}
      {selectedProvider && (
        <ProviderModelsModal
          provider={selectedProvider}
          models={selectedProviderModels}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}

function ProviderModelsModal({
  provider,
  models,
  onClose,
}: {
  provider: ProviderSummaryItem;
  models: ProviderModelSummary[];
  onClose: () => void;
}) {
  const [copiedModel, setCopiedModel] = useState(null);
  const notify = useNotificationStore();
  const router = useRouter();
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const ts = useTranslations("sidebar");

  const navigateTo = (path) => {
    onClose();
    router.push(path);
  };

  const handleCopy = async (text) => {
    await copyToClipboard(text);
    setCopiedModel(text);
    notify.success(t("copiedModel", { model: text }));
    setTimeout(() => setCopiedModel(null), 2000);
  };

  return (
    <Modal
      isOpen={true}
      title={t("providerModelsTitle", { provider: provider.provider.name })}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {/* Summary */}
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span className="material-symbols-outlined text-[16px]">token</span>
          {models.length === 1
            ? t("modelAvailable", { count: models.length })
            : t("modelsAvailable", { count: models.length })}
          {provider.total > 0 && (
            <span className="ml-auto text-xs text-green-500">
              ●{" "}
              {provider.connected === 1
                ? t("connectionsActive", { count: provider.connected })
                : t("connectionsActivePlural", { count: provider.connected })}
            </span>
          )}
        </div>

        {models.length === 0 ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">
              search_off
            </span>
            <p className="text-sm text-text-muted">{t("noModelsAvailable")}</p>
            <p className="text-xs text-text-muted mt-1">
              {t("configureFirst", { providers: ts("providers") })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto">
            {models.map((m) => (
              <div
                key={m.fullModel}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-text-main truncate">{m.fullModel}</p>
                  {m.alias !== m.model && (
                    <p className="text-[10px] text-text-muted">
                      {t("aliasLabel")}: {m.alias}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(m.fullModel)}
                  className="shrink-0 ml-2 p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-subtle transition-colors opacity-0 group-hover:opacity-100"
                  title={t("copyModelName")}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedModel === m.fullModel ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            variant="secondary"
            fullWidth
            size="sm"
            onClick={() => navigateTo(`/dashboard/providers/${provider.id}`)}
            className="flex-1"
          >
            <span className="material-symbols-outlined text-[14px] mr-1">settings</span>
            {t("configureProvider")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {tc("close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
