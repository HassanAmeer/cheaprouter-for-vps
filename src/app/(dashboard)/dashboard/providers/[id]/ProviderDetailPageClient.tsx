"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ShimmerPageLoader,
  OAuthModal,
  KiroOAuthWrapper,
  CursorAuthModal,
  TraeAuthModal,
} from "@/shared/components";
import {
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  OAUTH_PROVIDERS,
} from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { providerUsesCuratedModelsOnly } from "@/lib/providers/modelListingCapability";
import { mergeProviderModelListing } from "@/lib/providers/mergeProviderModelListing";
import { normalizeModelCatalogSource } from "@/shared/utils/modelCatalogSearch";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";
import { resolveDashboardProviderInfo, resolveProviderHeaderLink } from "../providerPageUtils";
import { findDefaultReferral } from "@/lib/radar/referrals";
import { useProviderConnections } from "./hooks/useProviderConnections";
import { useProviderModels } from "./hooks/useProviderModels";
import ProviderPageHeader from "./components/ProviderPageHeader";
import { AdaptaTutorialModal } from "./components/AdaptaTutorialModal";
import AddCustomModelCard from "./components/AddCustomModelCard";
import AvailableModelsTable from "./components/AvailableModelsTable";
import ConnectionsTab from "./components/ConnectionsTab";
import EditConnectionModal from "./components/modals/EditConnectionModal";
import DefaultCapabilitiesPromptModal from "../components/DefaultCapabilitiesPromptModal";
import EditCustomProviderSheet from "./components/EditCustomProviderSheet";
import AddApiKeyModal from "./components/modals/AddApiKeyModal";
import KimiCodeAuthMethodModal from "./components/KimiCodeAuthMethodModal";
import SiliconFlowEndpointModal from "./components/SiliconFlowEndpointModal";
import { RemoteTunnelBanner } from "@/shared/components/RemoteTunnelBanner";
import { CupertinoProviderGuideSheet } from "@/shared/components/CupertinoProviderGuideSheet";
import OpenCodeBypassDetailPanel from "./components/OpenCodeBypassDetailPanel";
import AntigravityAccountsSheet from "./components/AntigravityAccountsSheet";
import { addRecentProvider } from "@/lib/providers/recentProviders";

export default function ProviderDetailPageClient() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const providerId = params.id as string;

  // ── Connection Auth Modals State ─────────────────────────────────────────
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showAddApiKeyModal, setShowAddApiKeyModal] = useState(false);
  const [showKimiAuthMethodModal, setShowKimiAuthMethodModal] = useState(false);
  const [showSiliconFlowEndpointModal, setShowSiliconFlowEndpointModal] = useState(false);
  const [showGuideSheet, setShowGuideSheet] = useState(false);
  const [showAdaptaTutorial, setShowAdaptaTutorial] = useState(false);
  // Detail page tabs: the models of a provider and the credentials that make
  // them reachable. The connection list used to live here and was lost in the
  // redesign — you could connect but never see or edit a credential.
  const [detailTab, setDetailTab] = useState<"models" | "connections">("models");
  const [editingConnection, setEditingConnection] = useState<any>(null);
  const [showAntigravitySheet, setShowAntigravitySheet] = useState(false);
  const [siliconFlowInitialBaseUrl, setSiliconFlowInitialBaseUrl] = useState<string | undefined>(
    undefined
  );
  const [, setDisconnecting] = useState(false);

  // ── Edit Provider Sheet State ───────────────────────────────────────────
  const [editingProviderNode, setEditingProviderNode] = useState(false);

  // ── Global Test Prompt State (Modal in Header) ───────────────────────────
  const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Hi");

  // ── Fetch Models State ───────────────────────────────────────────────────
  const [fetchingAllModels, setFetchingAllModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const {
    connections,
    providerNode,
    loading,
    fetchConnections,
    retestingId,
    cpaProviderEnabled,
    upstreamProxyMode,
    upstreamProxyFallbackBackend,
    handleUpdateConnectionStatus,
    handleToggleRateLimit,
    handleRetestConnection,
    handleRefreshToken,
    handleSwapPriority,
    handleToggleProxyEnabled,
    handleTogglePerKeyProxyEnabled,
    handleToggleCliproxyapiMode,
    handleSetUpstreamProxyMode,
    deleteConfirm,
  } = useProviderConnections(
    providerId,
    isOpenAICompatibleProvider(providerId) ||
      isAnthropicCompatibleProvider(providerId) ||
      isClaudeCodeCompatibleProvider(providerId),
    false
  );

  const isOpenAICompatible =
    isOpenAICompatibleProvider(providerId) ||
    Boolean(providerNode && providerNode.type !== "anthropic-compatible");
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    (isAnthropicCompatibleProvider(providerId) ||
      Boolean(providerNode && providerNode.type === "anthropic-compatible")) &&
    !isClaudeCodeCompatibleProvider(providerId);
  const isCompatible =
    isOpenAICompatible || isAnthropicCompatible || isCcCompatible || Boolean(providerNode);
  const isAnthropicProtocolCompatible = isAnthropicCompatible || isCcCompatible;
  const usesCuratedModelsOnly = providerUsesCuratedModelsOnly(providerId);

  const {
    modelMeta,
    syncedAvailableModels,
    syncedCatalogAuthoritative,
    fetchProviderModelMeta,
    fetchAliases,
    handleSetAlias,
  } = useProviderModels(providerId, false);

  const { copied, copy } = useCopyToClipboard();
  const t = useTranslations("providers");
  const notify = useNotificationStore();

  const providerInfo = resolveDashboardProviderInfo(providerId, {
    providerNode,
    compatibleLabels: {
      ccCompatibleName: t("ccCompatibleLabel"),
      anthropicCompatibleName: t("anthropicCompatibleName"),
      openAiCompatibleName: t("openaiCompatibleName"),
    },
  });

  useEffect(() => {
    if (providerId) {
      addRecentProvider(providerId, providerInfo?.name);
    }
  }, [providerId, providerInfo?.name]);

  const [referralUrl, setReferralUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/radar/referrals");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const fixed = Array.isArray(data?.fixed) ? data.fixed : [];
        const match = findDefaultReferral(fixed, providerId);
        setReferralUrl(match?.url ?? null);
      } catch {
        // Best-effort only — never blocks rendering
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const { website: providerHeaderWebsite, isReferralLink } = resolveProviderHeaderLink(
    providerInfo?.website,
    referralUrl
  );

  const providerAlias = getProviderAlias(providerId);
  const providerStorageAlias = isCompatible ? providerId : providerAlias;
  const providerDisplayAlias = isCompatible ? providerNode?.prefix || providerId : providerAlias;

  const registryModels = getModelsByProviderId(providerId);

  const models = useMemo(() => {
    return mergeProviderModelListing({
      providerId,
      registryModels,
      syncedModels: syncedAvailableModels,
      syncedCatalogAuthoritative,
      customModels: (modelMeta.customModels || []).map((cm) => ({
        ...cm,
        id: cm.id,
        name: cm.name || cm.id,
        source: normalizeModelCatalogSource(cm.source) === "imported" ? "imported" : "custom",
      })),
      usesCuratedModelsOnly,
    });
  }, [
    providerId,
    registryModels,
    syncedAvailableModels,
    modelMeta.customModels,
    syncedCatalogAuthoritative,
    usesCuratedModelsOnly,
  ]);

  const isOAuth = useMemo(() => {
    return Boolean(
      (OAUTH_PROVIDERS as Record<string, unknown>)[providerId] ||
      providerInfo?.oauthProviderId ||
      (providerInfo as Record<string, unknown>)?.authType === "oauth"
    );
  }, [providerId, providerInfo]);

  const openPrimaryAddFlow = useCallback(() => {
    if (providerId === "kimi-coding") {
      setShowKimiAuthMethodModal(true);
      return;
    }
    if (isOAuth) {
      setShowOAuthModal(true);
      return;
    }
    if (providerId === "siliconflow") {
      setShowSiliconFlowEndpointModal(true);
      return;
    }
    setShowAddApiKeyModal(true);
  }, [providerId, isOAuth]);

  // Handle URL ?action=connect (e.g. from ProviderCard "Connect" button)
  useEffect(() => {
    if (searchParams?.get("action") === "connect") {
      queueMicrotask(() => openPrimaryAddFlow());
    }
  }, [searchParams, openPrimaryAddFlow]);

  // Handle URL ?action=guide (e.g. from ProviderCard "info" button fallback).
  // Opens the same Cupertino guide sheet that the header info icon opens, so
  // every provider exposes the guide through the header info affordance.
  useEffect(() => {
    if (searchParams?.get("action") === "guide") {
      queueMicrotask(() => setShowGuideSheet(true));
    }
  }, [searchParams]);

  // Load this provider's model metadata (custom models, the synced catalog and
  // compat overrides) plus the alias map on mount / provider change.
  //
  // Without this the page only ever showed the STATIC registry models: every
  // model the operator imported ("Fetch All Models"), added by hand ("Add
  // Custom Model") or synced from the provider vanished after a reload, and
  // the "N models" counter disagreed with the list.
  // The fetchers are kept in refs: their identity changes whenever the
  // translation function or the notification store re-renders, and putting them
  // in the effect deps re-triggered the fetch on every render (an endless
  // fetch loop).
  const fetchProviderModelMetaRef = useRef(fetchProviderModelMeta);
  const fetchAliasesRef = useRef(fetchAliases);
  useEffect(() => {
    fetchProviderModelMetaRef.current = fetchProviderModelMeta;
    fetchAliasesRef.current = fetchAliases;
  });

  useEffect(() => {
    if (loading) return;
    void fetchProviderModelMetaRef.current();
    void fetchAliasesRef.current();
  }, [loading, providerId]);

  const handleOAuthSuccess = useCallback(async () => {
    setShowOAuthModal(false);
    await fetchConnections();
    await fetchProviderModelMeta();
    notify.success("Connected successfully");
  }, [fetchConnections, fetchProviderModelMeta, notify]);

  const handleSaveApiKey = useCallback(
    async (formData: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: providerId === "kimi-coding" ? "kimi-coding-apikey" : providerId,
            ...formData,
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.error || "Failed to save API key");
        }
        setShowAddApiKeyModal(false);
        setSiliconFlowInitialBaseUrl(undefined);
        await fetchConnections();
        await fetchProviderModelMeta();
        notify.success("Connection added successfully");
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Failed to save API key");
      }
    },
    [providerId, fetchConnections, fetchProviderModelMeta, notify]
  );

  const handleDisconnect = useCallback(async () => {
    if (connections.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${providerInfo?.name || providerId}? This will remove your credentials/connections for this provider.`
    );
    if (!confirmed) return;
    setDisconnecting(true);
    try {
      // `fetch` does NOT reject on a 4xx/5xx — check the status explicitly so
      // a rejected delete never reports "Disconnected successfully".
      const results = await Promise.allSettled(
        connections.map((conn) =>
          fetch(`/api/providers/${encodeURIComponent(conn.id)}`, { method: "DELETE" }).then(
            (res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res;
            }
          )
        )
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      await fetchConnections();
      await fetchProviderModelMeta();
      if (failed > 0) {
        notify.error(
          `Failed to disconnect ${failed} of ${connections.length} connection(s) — credentials may still be stored`
        );
      } else {
        notify.success("Disconnected successfully");
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to disconnect provider");
    } finally {
      setDisconnecting(false);
    }
  }, [
    connections,
    providerInfo?.name,
    providerId,
    fetchConnections,
    fetchProviderModelMeta,
    notify,
  ]);

  const handleFetchAllModels = async () => {
    setFetchingAllModels(true);
    setFetchError(null);
    try {
      const importTargetId = isCompatible ? providerNode?.prefix || providerId : providerId;
      const res = await fetch(
        `/api/providers/${encodeURIComponent(importTargetId)}/models?refresh=true`
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errDetail =
          errorData?.error ||
          (errorData?.statusCode
            ? `HTTP ${errorData.statusCode}: Failed to fetch models from API`
            : `HTTP ${res.status}: Failed to fetch models from API`);
        throw new Error(errDetail);
      }
      const data = await res.json().catch(() => ({}));
      const fetchedModels = Array.isArray(data?.models) ? data.models : [];
      if (fetchedModels.length === 0) {
        notify.info("No models returned by upstream provider.");
        return;
      }

      // Batch save all models into database in one atomic request
      await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          models: fetchedModels.map((m: any) => {
            const rawId = m.id || m.name || m.model;
            const modelId = typeof rawId === "string" ? rawId : String(rawId ?? "");
            const isFree =
              m.isFree === true ||
              (Array.isArray(m.capabilities) && m.capabilities.includes("free"));
            return {
              id: modelId,
              name: m.name || modelId,
              source: "imported",
              apiFormat: m.apiFormat || "chat-completions",
              isFree,
              supportedEndpoints: Array.isArray(m.supportedEndpoints)
                ? m.supportedEndpoints
                : ["chat"],
              ...(m.targetFormat ? { targetFormat: m.targetFormat } : {}),
              ...(typeof m.dimensions === "number" && m.dimensions > 0
                ? { dimensions: m.dimensions }
                : {}),
              ...(Array.isArray(m.supportedInputTypes)
                ? { supportedInputTypes: m.supportedInputTypes }
                : {}),
              ...(typeof m.modelType === "string" ? { modelType: m.modelType } : {}),
              ...(typeof m.inputTokenLimit === "number" && m.inputTokenLimit > 0
                ? { inputTokenLimit: m.inputTokenLimit }
                : {}),
              ...(typeof m.max_input_tokens === "number" && m.max_input_tokens > 0
                ? { inputTokenLimit: m.max_input_tokens }
                : {}),
              ...(Array.isArray(m.capabilities) ? { capabilities: m.capabilities } : {}),
              ...(m.supportsVision !== undefined
                ? { supportsVision: Boolean(m.supportsVision) }
                : {}),
              ...(m.reasoning !== undefined ? { reasoning: Boolean(m.reasoning) } : {}),
            };
          }),
        }),
      });

      // Register aliases silently in parallel chunks
      const CHUNK_SIZE = 15;
      for (let i = 0; i < fetchedModels.length; i += CHUNK_SIZE) {
        const chunk = fetchedModels.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(
          chunk.map(async (m: any) => {
            const rawId = m.id || m.name || m.model;
            const modelId = typeof rawId === "string" ? rawId : String(rawId ?? "");
            if (!modelId) return;
            const parts = modelId.split("/");
            const baseAlias = parts[parts.length - 1];
            await handleSetAlias(modelId, baseAlias, providerStorageAlias, true);
          })
        );
      }

      // Immediately synchronize React state so models render in the table instantly
      await fetchProviderModelMeta();
      await fetchAliases();

      // Exactly ONE success toast notification
      notify.success(
        `Successfully fetched and synchronized ${fetchedModels.length} ${
          fetchedModels.length === 1 ? "model" : "models"
        }.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch models from API";
      setFetchError(msg);
      notify.error(msg);
    } finally {
      setFetchingAllModels(false);
    }
  };

  if (loading) {
    return <ShimmerPageLoader variant="provider-detail" />;
  }

  if (!providerInfo) {
    return (
      <div className="text-center py-20">
        <p className="text-[#A3A3A3]">{t("providerNotFound")}</p>
        <Link href="/dashboard/providers" className="text-white hover:underline mt-4 inline-block">
          {t("backToProviders")}
        </Link>
      </div>
    );
  }

  const isNodePaused = providerNode?.isActive === false;
  const handleTogglePause = async () => {
    if (!providerNode?.id) return;
    const nextActive = isNodePaused;
    try {
      const res = await fetch(`/api/provider-nodes/${encodeURIComponent(providerNode.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error("Failed to update provider status");
      await fetchConnections();
      notify.info(nextActive ? "Provider resumed" : "Provider paused");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to toggle pause status");
    }
  };

  const handleDeleteProvider = async () => {
    if (!providerNode?.id) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete custom provider "${providerNode.name || providerId}"?\nAll associated connections, models, and aliases will be permanently removed.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/provider-nodes/${encodeURIComponent(providerNode.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete provider");
      notify.success("Provider deleted successfully");
      router.push("/dashboard/providers");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to delete provider");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 text-white">
      {/* ── PROVIDER HEADER (Title, Provider ID, Status, Back to List) + TOP-RIGHT CAPABILITIES BUTTON ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <ProviderPageHeader
          providerId={providerId}
          providerInfo={{ ...providerInfo, website: providerHeaderWebsite }}
          connectionsCount={connections.length}
          isOpenAICompatible={isOpenAICompatible}
          isAnthropicProtocolCompatible={isAnthropicProtocolCompatible}
          onOpenTutorial={() => setShowAdaptaTutorial(true)}
          onConnect={openPrimaryAddFlow}
          onDisconnect={handleDisconnect}
          onOpenGuide={() => setShowGuideSheet(true)}
          onEditProvider={providerNode ? () => setEditingProviderNode(true) : undefined}
          onTogglePause={providerNode ? handleTogglePause : undefined}
          onDeleteProvider={providerNode ? handleDeleteProvider : undefined}
          isPaused={isNodePaused}
          t={t}
          isReferralLink={isReferralLink}
        />

        <div className="self-end sm:self-start pt-2">
          <DefaultCapabilitiesPromptModal
            testPrompt={testPrompt}
            onPromptChange={setTestPrompt}
            isOpen={showCapabilityPrompt}
            onToggle={() => setShowCapabilityPrompt((prev) => !prev)}
          />
        </div>
      </div>

      {/* ── OPENCODE BYPASS DEDICATED PANEL (DETAILS, DIRECT BASE URL & CONTROLS) ── */}
      {providerId === "opencode-bypass" && (
        <OpenCodeBypassDetailPanel
          providerId={providerId}
          onFetchModels={handleFetchAllModels}
          isFetchingModels={fetchingAllModels}
          onConfigureBaseUrl={openPrimaryAddFlow}
          customBaseUrl={
            typeof connections?.[0]?.providerSpecificData?.baseUrl === "string"
              ? (connections[0].providerSpecificData.baseUrl as string)
              : undefined
          }
        />
      )}

      {/* ── ANTIGRAVITY MULTI-ACCOUNT CLI POOL BANNER ── */}
      {(providerId === "antigravity" || providerId === "agy") && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-[#1C1C1E]/80 to-[#1C1C1E]/60 p-4 sm:p-5 shadow-lg backdrop-blur-xl transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-inner">
                <span className="material-symbols-outlined text-2xl">account_tree</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Antigravity CLI Accounts Pool
                  </h3>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    Single-Active & Auto-Switch
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-1 leading-relaxed max-w-2xl">
                  Attach multiple Antigravity CLI accounts. Switch the active account with one
                  click, or let the router automatically failover to the next standby account when
                  quota/rate limits (429) are reached.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAntigravitySheet(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <span className="material-symbols-outlined text-base">layers</span>
              <span>Manage Accounts Pool</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* ── REMOTE TUNNEL HELPER BANNER (WHEN NOT CONNECTED) ── */}
      {connections.length === 0 && providerId !== "opencode-bypass" && <RemoteTunnelBanner />}

      {/* ── DETAIL TABS: MODELS | CONNECTIONS ── */}
      <div className="flex items-center gap-1 border-b border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={detailTab === "models"}
          onClick={() => setDetailTab("models")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            detailTab === "models"
              ? "border-primary text-text-main"
              : "border-transparent text-text-muted hover:text-text-main hover:border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">dns</span>
          Models
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={detailTab === "connections"}
          onClick={() => setDetailTab("connections")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            detailTab === "connections"
              ? "border-primary text-text-main"
              : "border-transparent text-text-muted hover:text-text-main hover:border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">link</span>
          Connections
          {connections.length > 0 && (
            <span className="text-[11px] bg-bg-subtle border border-border text-text-muted rounded-full px-1.5 py-0.5 font-mono">
              {connections.length}
            </span>
          )}
        </button>
      </div>

      {detailTab === "connections" ? (
        <ConnectionsTab
          connections={connections}
          providerId={providerId}
          retestingId={retestingId}
          cpaProviderEnabled={cpaProviderEnabled}
          upstreamProxyMode={upstreamProxyMode}
          upstreamProxyFallbackBackend={upstreamProxyFallbackBackend}
          onToggleActive={handleUpdateConnectionStatus}
          onToggleRateLimit={handleToggleRateLimit}
          onRetest={handleRetestConnection}
          onEdit={(connection) => setEditingConnection(connection)}
          onDelete={(id, name) => deleteConfirm.request(id, name)}
          onMoveUp={(connection) => {
            const sorted = [...connections].sort(
              (a, b) => (a.priority ?? 999) - (b.priority ?? 999)
            );
            const index = sorted.findIndex((c) => c.id === connection.id);
            if (index > 0) void handleSwapPriority(connection, sorted[index - 1]);
          }}
          onMoveDown={(connection) => {
            const sorted = [...connections].sort(
              (a, b) => (a.priority ?? 999) - (b.priority ?? 999)
            );
            const index = sorted.findIndex((c) => c.id === connection.id);
            if (index !== -1 && index < sorted.length - 1) {
              void handleSwapPriority(connection, sorted[index + 1]);
            }
          }}
          onRefreshToken={handleRefreshToken}
          onToggleProxyEnabled={handleToggleProxyEnabled}
          onTogglePerKeyProxyEnabled={handleTogglePerKeyProxyEnabled}
          onToggleCliproxyapiMode={handleToggleCliproxyapiMode}
          onSetUpstreamProxyMode={handleSetUpstreamProxyMode}
          onAddConnection={openPrimaryAddFlow}
          onDisconnectAll={connections.length > 0 ? handleDisconnect : undefined}
        />
      ) : (
        <>
          {/* ── SECTION 1: ➕ "Add Custom Model" Form ── */}
          <AddCustomModelCard providerId={providerId} onModelAdded={fetchProviderModelMeta} />

          {/* ── SECTION 2: 📋 AVAILABLE MODELS TABLE (with "Fetch All Models" in header) ── */}
          <AvailableModelsTable
            providerId={providerId}
            providerDisplayAlias={providerDisplayAlias}
            models={models}
            testPrompt={testPrompt}
            onRefreshModels={fetchProviderModelMeta}
            copied={copied}
            onCopy={copy}
            onFetchModels={handleFetchAllModels}
            isFetchingModels={fetchingAllModels}
            fetchError={fetchError}
            connectionId={connections?.[0]?.id}
          />
        </>
      )}

      {/* ── EDIT CONNECTION MODAL ── */}
      {editingConnection && (
        <EditConnectionModal
          isOpen={Boolean(editingConnection)}
          connection={editingConnection}
          providerId={providerId}
          providerWebsite={providerInfo?.website}
          onClose={() => setEditingConnection(null)}
          onSave={async (data: unknown) => {
            const res = await fetch(`/api/providers/${encodeURIComponent(editingConnection.id)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!res.ok) {
              const error = await res.json().catch(() => ({}));
              throw new Error(error?.error || "Failed to save connection");
            }
            setEditingConnection(null);
            await fetchConnections();
          }}
        />
      )}

      {/* ── DELETE CONNECTION CONFIRM ── */}
      {deleteConfirm.connection && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={deleteConfirm.cancel}
        >
          <div
            className="relative bg-bg-primary border border-border rounded-xl w-full max-w-[420px] mx-4 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <h3 className="font-semibold text-text-main">Delete connection</h3>
            <p className="text-sm text-text-muted mt-2">
              Remove{" "}
              <strong className="text-text-main">
                {deleteConfirm.connection.name || deleteConfirm.connection.id}
              </strong>{" "}
              and its stored credentials? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={deleteConfirm.cancel}
                className="px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirm.deleting}
                onClick={() => void deleteConfirm.confirm()}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {deleteConfirm.deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {providerNode && (
        <EditCustomProviderSheet
          isOpen={editingProviderNode}
          providerNode={providerNode}
          onClose={() => setEditingProviderNode(false)}
          onUpdated={async () => {
            setEditingProviderNode(false);
            await fetchConnections();
            await fetchProviderModelMeta();
          }}
          onSyncModels={handleFetchAllModels}
          isSyncingModels={fetchingAllModels}
          notify={notify}
        />
      )}

      {/* ── CONNECTION AUTH MODALS ── */}
      {providerId === "kimi-coding" && (
        <KimiCodeAuthMethodModal
          isOpen={showKimiAuthMethodModal}
          onSelectOAuth={() => {
            setShowKimiAuthMethodModal(false);
            setShowOAuthModal(true);
          }}
          onSelectApiKey={() => {
            setShowKimiAuthMethodModal(false);
            setShowAddApiKeyModal(true);
          }}
          onClose={() => setShowKimiAuthMethodModal(false)}
          t={t}
        />
      )}

      {providerId === "kiro" || providerId === "amazon-q" ? (
        <KiroOAuthWrapper
          isOpen={showOAuthModal}
          providerInfo={{ ...providerInfo, id: providerId }}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "trae" ? (
        <TraeAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuthModal}
          provider={providerInfo?.oauthProviderId || providerId}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      )}

      {providerId === "siliconflow" && (
        <SiliconFlowEndpointModal
          isOpen={showSiliconFlowEndpointModal}
          onSelect={(baseUrl) => {
            setSiliconFlowInitialBaseUrl(baseUrl);
            setShowSiliconFlowEndpointModal(false);
            setShowAddApiKeyModal(true);
          }}
          onClose={() => {
            setShowSiliconFlowEndpointModal(false);
            setSiliconFlowInitialBaseUrl(undefined);
          }}
        />
      )}

      <AddApiKeyModal
        isOpen={showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo?.name}
        providerWebsite={providerInfo?.website}
        initialBaseUrl={siliconFlowInitialBaseUrl}
        existingConnectionNames={connections.map((c) => c.name)}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicProtocolCompatible}
        isCcCompatible={isCcCompatible}
        onSave={handleSaveApiKey}
        onClose={() => {
          setShowAddApiKeyModal(false);
          setSiliconFlowInitialBaseUrl(undefined);
        }}
      />

      {/* The header's "Tutorial" button used to call a no-op handler, so the
          Adapta setup guide could never be opened. */}
      <AdaptaTutorialModal
        isOpen={showAdaptaTutorial}
        onClose={() => setShowAdaptaTutorial(false)}
      />

      <CupertinoProviderGuideSheet
        isOpen={showGuideSheet}
        onClose={() => setShowGuideSheet(false)}
        providerId={providerId}
        providerName={providerInfo?.name || providerId}
        liveModels={syncedAvailableModels}
      />

      <AntigravityAccountsSheet
        isOpen={showAntigravitySheet}
        onClose={() => setShowAntigravitySheet(false)}
        providerId={providerId}
        onAttachAccount={openPrimaryAddFlow}
        onConnectionChanged={() => {
          void fetchConnections();
        }}
      />
    </div>
  );
}
