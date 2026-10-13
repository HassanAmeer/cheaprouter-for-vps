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
import {
  resolveDashboardProviderInfo,
  resolveProviderHeaderLink,
} from "../providerPageUtils";
import { findDefaultReferral } from "@/lib/radar/referrals";
import { useProviderConnections } from "./hooks/useProviderConnections";
import { useProviderModels } from "./hooks/useProviderModels";
import { useModelImportHandlers } from "./hooks/useModelImportHandlers";
import ProviderPageHeader from "./components/ProviderPageHeader";
import AddCustomModelCard from "./components/AddCustomModelCard";
import AvailableModelsTable from "./components/AvailableModelsTable";

export default function ProviderDetailPageClient() {
  const params = useParams();
  const providerId = params.id as string;

  // ── Section 1: Default Capabilities Prompt State ────────────────────────
  const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Hi");

  // ── Section 2: Fetch Live State ──────────────────────────────────────────
  const [fetchingAllModels, setFetchingAllModels] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    isAnthropicCompatibleProvider(providerId) && !isClaudeCodeCompatibleProvider(providerId);
  const isCompatible = isOpenAICompatible || isAnthropicCompatible || isCcCompatible;
  const isAnthropicProtocolCompatible = isAnthropicCompatible || isCcCompatible;
  const usesCuratedModelsOnly = providerUsesCuratedModelsOnly(providerId);

  const {
    connections,
    providerNode,
    loading,
    fetchConnections,
  } = useProviderConnections(providerId, isCompatible, false);

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

  const {
    importingModels,
    handleImportModels,
  } = useModelImportHandlers({
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
    setFetchFailed(false);
    try {
      const importTargetId = isCompatible ? providerNode?.prefix || providerId : providerId;
      const res = await fetch(`/api/providers/${encodeURIComponent(importTargetId)}/models?refresh=true`);
      if (!res.ok) {
        throw new Error("Failed to fetch models from API");
      }
      await handleImportModels();
      await fetchProviderModelMeta();
      notify.success("All models fetched and updated successfully.");
    } catch {
      setFetchFailed(true);
      notify.error("Failed to fetch models from API. Please add models manually below.");
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
      {/* ── PROVIDER HEADER (Title, Provider ID, Status, Back to List) ── */}
      <ProviderPageHeader
        providerId={providerId}
        providerInfo={{ ...providerInfo, website: providerHeaderWebsite }}
        connectionsCount={connections.length}
        isOpenAICompatible={isOpenAICompatible}
        isAnthropicProtocolCompatible={isAnthropicProtocolCompatible}
        onOpenTutorial={() => {}}
        t={t}
        isReferralLink={isReferralLink}
      />

      {/* ── SECTION 1: 🔘 "Default Capabilities Prompt" (COLLAPSIBLE TEST PANEL) ── */}
      <div className="rounded-xl border border-[#262626] bg-[#121212] overflow-hidden transition-all shadow-sm">
        <button
          type="button"
          onClick={() => setShowCapabilityPrompt((prev) => !prev)}
          className="w-full flex items-center justify-between px-5 py-4 bg-[#161616] hover:bg-[#1a1a1a] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-[#C0C0C0]">
              psychology_alt
            </span>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Default Capabilities Prompt</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#A3A3A3]">
                  Global Test Payload
                </span>
              </div>
              <p className="text-xs text-[#737373] mt-0.5">
                Configures the test prompt dispatched when clicking &ldquo;Test&rdquo; on any model in Section 3.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#A3A3A3] font-mono bg-[#0A0A0A] px-2.5 py-1 rounded border border-[#262626] max-w-[240px] truncate">
              <span className="text-[#737373]">Prompt:</span>
              <span className="text-white truncate">&ldquo;{testPrompt}&rdquo;</span>
            </div>
            <span className="material-symbols-outlined text-[20px] text-[#C0C0C0] transition-transform">
              {showCapabilityPrompt ? "expand_less" : "expand_more"}
            </span>
          </div>
        </button>

        {showCapabilityPrompt && (
          <div className="p-5 border-t border-[#262626] flex flex-col gap-4 bg-[#0E0E0E]">
            {/* Quick preset buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#737373] mr-1">Quick Presets:</span>
              <button
                type="button"
                onClick={() => setTestPrompt("Hi")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  testPrompt === "Hi"
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-[#181818] border-[#2E2E2E] text-[#A3A3A3] hover:text-white hover:bg-[#222]"
                }`}
              >
                <span>💬</span>
                <span>Text / Hi</span>
              </button>

              <button
                type="button"
                onClick={() => setTestPrompt("Generate a modern CSS button with HTML.")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  testPrompt === "Generate a modern CSS button with HTML."
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-[#181818] border-[#2E2E2E] text-[#A3A3A3] hover:text-white hover:bg-[#222]"
                }`}
              >
                <span>💻</span>
                <span>Code / HTML</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setTestPrompt(
                    "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400 Describe this image in detail."
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  testPrompt.includes("Describe this image in detail.")
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-[#181818] border-[#2E2E2E] text-[#A3A3A3] hover:text-white hover:bg-[#222]"
                }`}
              >
                <span>👁️</span>
                <span>Vision</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setTestPrompt(
                    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400 Extract all text from this receipt."
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  testPrompt.includes("Extract all text from this receipt.")
                    ? "bg-white/10 border-white/30 text-white"
                    : "bg-[#181818] border-[#2E2E2E] text-[#A3A3A3] hover:text-white hover:bg-[#222]"
                }`}
              >
                <span>🔍</span>
                <span>OCR</span>
              </button>
            </div>

            {/* Prompt Editor Box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#A3A3A3]">
                Customizable Test Prompt:
              </label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                placeholder="Enter prompt to verify model capabilities..."
                className="w-full p-3 text-xs bg-[#141414] text-white border border-[#2E2E2E] rounded-lg font-mono focus:outline-none focus:border-[#C0C0C0] transition-colors resize-y placeholder-[#555]"
              />
              <div className="text-[11px] text-[#737373] flex items-center gap-1.5 mt-0.5">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                <span>
                  Clicking &ldquo;Test&rdquo; on any row in the Available Models Table will dispatch this prompt upstream.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 2: ⚡ "Fetch All Models" Button + ➕ "Add Custom Model" Form ── */}
      <div className="flex flex-col gap-4">
        {/* Fetch Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-[#262626] bg-[#121212]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-[#C0C0C0]">cloud_sync</span>
            <div>
              <div className="text-sm font-semibold text-white">Upstream Model Discovery</div>
              <p className="text-xs text-[#737373]">
                Synchronize live model catalogs from upstream or register custom endpoints.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={fetchingAllModels || importingModels}
            onClick={handleFetchAllModels}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-white text-black hover:bg-[#E5E5E5] transition-colors disabled:opacity-50 cursor-pointer font-sans shadow-sm"
          >
            {fetchingAllModels || importingModels ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span>Fetching Models...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Fetch All Models</span>
              </>
            )}
          </button>
        </div>

        {/* Orange alert box if fetch failed */}
        {fetchFailed && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-xs flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0">
              warning
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-amber-300">
                Failed to fetch models from API.
              </span>
              <span className="text-amber-200/80">
                Please add models manually below.
              </span>
            </div>
          </div>
        )}

        {/* Add Custom Model Form Card */}
        <AddCustomModelCard
          providerId={providerId}
          onModelAdded={fetchProviderModelMeta}
        />
      </div>

      {/* ── SECTION 3: 📋 AVAILABLE MODELS TABLE ── */}
      <AvailableModelsTable
        providerId={providerId}
        providerDisplayAlias={providerDisplayAlias}
        models={models}
        testPrompt={testPrompt}
        onRefreshModels={fetchProviderModelMeta}
        copied={copied}
        onCopy={copy}
      />
    </div>
  );
}
