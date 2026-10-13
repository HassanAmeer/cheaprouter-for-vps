"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
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
import { useModelImportHandlers } from "./hooks/useModelImportHandlers";
import ProviderPageHeader from "./components/ProviderPageHeader";
import AddCustomModelCard from "./components/AddCustomModelCard";
import AvailableModelsTable from "./components/AvailableModelsTable";
import DefaultCapabilitiesPromptModal from "../components/DefaultCapabilitiesPromptModal";
import AddCompatibleProviderModal from "../components/AddCompatibleProviderModal";

export default function ProviderDetailPageClient() {
  const params = useParams();
  const providerId = params.id as string;

  // ── Edit Provider Modal State ───────────────────────────────────────────
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
    modelAliases,
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

  const { importingModels, handleImportModels } = useModelImportHandlers({
    providerId,
    models,
    modelMeta,
    modelAliases,
    connections,
    isFreeNoAuth: false,
    handleSetAlias,
    fetchAliases,
    fetchProviderModelMeta,
    fetchConnections,
    notify,
    t,
    providerStorageAlias,
  });

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
      await handleImportModels();
      await fetchProviderModelMeta();
      notify.success(
        Array.isArray(data?.models) && data.models.length > 0
          ? `Discovered and updated ${data.models.length} models successfully.`
          : "All models fetched and updated successfully."
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
        isFetchingModels={fetchingAllModels || importingModels}
        fetchError={fetchError}
      />

      {providerNode && (
        <AddCompatibleProviderModal
          isOpen={editingProviderNode}
          mode={providerNode.type === "anthropic-compatible" ? "anthropic" : "openai"}
          title={`Edit Provider: ${providerNode.name || providerNode.prefix}`}
          initialNode={providerNode}
          onClose={() => setEditingProviderNode(false)}
          onCreated={() => {}}
          onUpdated={async () => {
            setEditingProviderNode(false);
            await fetchConnections();
            await fetchProviderModelMeta();
            notify.success("Provider updated successfully");
          }}
        />
      )}
    </div>
  );
}
