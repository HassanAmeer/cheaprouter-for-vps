"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/shared/components";
import {
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
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
import AddCustomModelCard from "./components/AddCustomModelCard";
import AvailableModelsTable from "./components/AvailableModelsTable";
import DefaultCapabilitiesPromptModal from "../components/DefaultCapabilitiesPromptModal";
import EditCustomProviderSheet from "./components/EditCustomProviderSheet";

export default function ProviderDetailPageClient() {
  const router = useRouter();
  const params = useParams();
  const providerId = params.id as string;

  // ── Edit Provider Sheet State ───────────────────────────────────────────
  const [editingProviderNode, setEditingProviderNode] = useState(false);

  // ── Global Test Prompt State (Modal in Header) ───────────────────────────
  const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Hi");

  // ── Fetch Models State ───────────────────────────────────────────────────
  const [fetchingAllModels, setFetchingAllModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { connections, providerNode, loading, fetchConnections } = useProviderConnections(
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
            return {
              id: modelId,
              name: m.name || modelId,
              source: "imported",
              apiFormat: m.apiFormat || "chat-completions",
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
    return (
      <div className="flex flex-col gap-6 p-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
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
          onOpenTutorial={() => {}}
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
    </div>
  );
}
