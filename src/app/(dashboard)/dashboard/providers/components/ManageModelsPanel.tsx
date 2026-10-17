"use client";

/**
 * ManageModelsPanel — Providers page Tab 4 "Manage Models" (reseller spec §6b–6e).
 *
 * Model studio scoped to CONNECTED providers only: collapsible provider
 * groups, per-model Active checkbox (only checked models flow downstream to
 * combos / API keys), one-click Model ID copy, FREE/PAID badge with manual
 * override, capability badges (context window + modalities), per-model live
 * Test with inline Verified/Failed preview, and custom alias fields
 * (display name + API call alias) persisted to
 * `provider_model_customizations` via `/api/v1/models/curation`.
 *
 * Aliases integrate with routing through the shared `modelAliases` namespace
 * (see providerModelCustomizations.ts::syncAlias) — a client-sent custom
 * alias resolves back to the original upstream model id at dispatch time.
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Card, ShimmerPageLoader } from "@/shared/components";
import { isCatalogFreeModel } from "@/shared/utils/freeModels";
import { getPricingForModel } from "@/shared/constants/pricing";
import { matchesSearch } from "@/shared/utils/turkishText";
import { detectModelCapabilities } from "@/shared/utils/modelCapabilities";
import DefaultCapabilitiesPromptModal, {
  getPromptForCapability,
} from "./DefaultCapabilitiesPromptModal";

function isImageResponse(text?: string): boolean {
  if (!text) return false;
  const t = text.trim();
  return (
    t.startsWith("data:image/") ||
    /^https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>]*)?$/i.test(t) ||
    /https?:\/\/images\.unsplash\.com\/[^\s"'<>]+/i.test(t) ||
    /!\[.*?\]\((https?:\/\/[^\s)]+)\)/.test(t)
  );
}

function extractImageUrl(text?: string): string {
  if (!text) return "";
  const t = text.trim();
  if (t.startsWith("data:image/")) return t;
  const mdMatch = t.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) return mdMatch[1];
  const urlMatch = t.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>]*)?/i);
  if (urlMatch) return urlMatch[0];
  const unsplashMatch = t.match(/https?:\/\/images\.unsplash\.com\/[^\s"'<>]+/i);
  if (unsplashMatch) return unsplashMatch[0];
  return t;
}

interface SyncedModel {
  id: string;
  name?: string;
  contextWindow?: number;
  inputTokenLimit?: number;
  supportedEndpoints?: string[];
  supportsThinking?: boolean;
  alwaysThinking?: boolean;
  supportsTools?: boolean;
  supportsVideo?: boolean;
  supportsVision?: boolean;
  isFree?: boolean;
}

interface Customization {
  providerId: string;
  originalModelId: string;
  customName: string | null;
  customAlias: string | null;
  isActive: boolean;
  isTested: boolean;
  testStatus: "verified" | "failed" | null;
  testHttpStatus: number | null;
  testLatencyMs: number | null;
  testResponse: string | null;
  contextWindow: number | null;
  capabilities: string[] | null;
  isFreeOverride?: boolean | null;
  pricingTier?: "free" | "paid" | null;
  originalInputCost?: number | null;
  originalCacheCost?: number | null;
  originalOutputCost?: number | null;
  inputCost?: number | null;
  cacheCost?: number | null;
  outputCost?: number | null;
}

interface ManagedCombo {
  id: string;
  name: string;
  displayName?: string | null;
  customAlias?: string | null;
  context_length?: number | null;
  computed_context_length?: number | null;
  isActive?: boolean;
  strategy?: string;
  models?: Array<{ providerId?: string; model?: string; provider?: string }>;
  pricing?: {
    tier?: "free" | "paid";
    originalInputCost?: number | null;
    originalCacheCost?: number | null;
    originalOutputCost?: number | null;
    inputCost?: number | null;
    cacheCost?: number | null;
    outputCost?: number | null;
  } | null;
}

interface LiveTestResult {
  ok: boolean;
  httpStatus?: number;
  latencyMs?: number;
  preview?: string;
}

function formatContextWindow(tokens: number | null | undefined): string | null {
  if (!tokens || tokens <= 0) return null;
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return `${tokens}`;
}

function parseContextWindowInput(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.endsWith("m")) {
    const num = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(num) && num > 0 ? Math.round(num * 1_000_000) : null;
  }
  if (trimmed.endsWith("k")) {
    const num = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(num) && num > 0 ? Math.round(num * 1000) : null;
  }
  const parsed = parseInt(trimmed.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface SyncedModelCapabilities {
  hasReasoning: boolean;
  hasVision: boolean;
  hasCode: boolean;
  hasSearch: boolean;
  hasAudio: boolean;
  hasChat: boolean;
  hasImageGen?: boolean;
  hasVideo?: boolean;
  hasEmbedding?: boolean;
  hasTools?: boolean;
}

export function getSyncedModelCapabilities(
  model: SyncedModel,
  cust?: Customization
): SyncedModelCapabilities {
  const mergedModel = {
    ...model,
    ...(cust?.capabilities ? { capabilities: cust.capabilities } : {}),
  };
  return detectModelCapabilities(mergedModel);
}

export const CAPABILITY_FILTER_BUTTONS = [
  { key: "all", label: "All", icon: "select_all" },
  { key: "text", label: "Text", icon: "chat" },
  { key: "vision", label: "Vision", icon: "visibility" },
  { key: "reasoning", label: "Reasoning", icon: "psychology" },
  { key: "code", label: "Code", icon: "code" },
  { key: "image", label: "Image Gen", icon: "palette" },
  { key: "video", label: "Video", icon: "videocam" },
  { key: "audio", label: "Audio", icon: "volume_up" },
  { key: "search", label: "Search", icon: "travel_explore" },
  { key: "embedding", label: "Embedding", icon: "hub" },
] as const;

function matchesSyncedModelFilter(
  model: SyncedModel,
  filter: string,
  cust?: Customization
): boolean {
  if (filter === "all") return true;
  const caps = getSyncedModelCapabilities(model, cust);
  if (filter === "text") return caps.hasChat;
  if (filter === "vision") return caps.hasVision;
  if (filter === "reasoning") return caps.hasReasoning;
  if (filter === "code") return caps.hasCode;
  if (filter === "image") return Boolean(caps.hasImageGen);
  if (filter === "video") return Boolean(caps.hasVideo);
  if (filter === "audio") return caps.hasAudio;
  if (filter === "search") return caps.hasSearch;
  if (filter === "embedding") return Boolean(caps.hasEmbedding);
  return true;
}

async function fetchCurationPayload(): Promise<{
  providerIds: string[];
  modelsByProvider: Record<string, SyncedModel[]>;
  customizations: Customization[];
}> {
  const res = await fetch("/api/v1/models/curation");
  if (!res.ok) throw new Error(`Curation API returned ${res.status}`);
  const data = await res.json();
  return {
    providerIds: Array.isArray(data?.connectedProviderIds) ? data.connectedProviderIds : [],
    modelsByProvider: data?.modelsByProvider ?? {},
    customizations: Array.isArray(data?.customizations) ? data.customizations : [],
  };
}

async function fetchCombosPayload(): Promise<ManagedCombo[]> {
  try {
    const res = await fetch("/api/combos");
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data?.combos) ? data.combos : [];
  } catch {
    return [];
  }
}

async function postCuration(payload: Record<string, unknown>): Promise<Customization | null> {
  const res = await fetch("/api/v1/models/curation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return (data?.customization as Customization) ?? null;
}

const SELECTED_CAPS_STORAGE_KEY = "cheaproute.modelSelectedCapabilities.v1";

export default function ManageModelsPanel() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, SyncedModel[]>>({});
  const [customizations, setCustomizations] = useState<Customization[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [capabilityFilter, setCapabilityFilter] = useState("all");
  const [selectedCapabilities, setSelectedCapabilities] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, LiveTestResult>>({});
  const [aliasDrafts, setAliasDrafts] = useState<
    Record<
      string,
      {
        name: string;
        alias: string;
        contextWindow: string;
        pricingTier?: "free" | "paid";
        originalInputCost?: string;
        originalCacheCost?: string;
        originalOutputCost?: string;
        inputCost?: string;
        cacheCost?: string;
        outputCost?: string;
      }
    >
  >({});
  const [savingAlias, setSavingAlias] = useState<string | null>(null);
  const [savingSelectionsProviderId, setSavingSelectionsProviderId] = useState<string | null>(null);
  const [savedFeedbackProviderId, setSavedFeedbackProviderId] = useState<string | null>(null);

  // ── Combos Management State ──
  const [combos, setCombos] = useState<ManagedCombo[]>([]);
  const [comboDrafts, setComboDrafts] = useState<
    Record<
      string,
      {
        displayName: string;
        customAlias: string;
        contextWindow: string;
        pricingTier: "free" | "paid";
        originalInputCost: string;
        originalCacheCost: string;
        originalOutputCost: string;
        inputCost: string;
        cacheCost: string;
        outputCost: string;
      }
    >
  >({});
  const [savingComboId, setSavingComboId] = useState<string | null>(null);
  const [combosExpanded, setCombosExpanded] = useState<boolean>(true);

  // ── Global Test Prompt State (Modal in Header) ───────────────────────────
  const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);
  const [testPrompt, setTestPrompt] = useState("Hi");
  const [fetchingProviderId, setFetchingProviderId] = useState<string | null>(null);
  const [fetchErrorByProvider, setFetchErrorByProvider] = useState<Record<string, string>>({});

  // ── Hydrate selected capability per model from localStorage ──────────────
  useEffect(() => {
    try {
      const raw = window.localStorage?.getItem(SELECTED_CAPS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration, runs once
          setSelectedCapabilities(parsed);
        }
      }
    } catch {
      // Storage unavailable or invalid JSON
    }
  }, []);

  const handleSelectCapability = useCallback((key: string, capKey: string) => {
    setSelectedCapabilities((prev) => {
      const next = { ...prev, [key]: capKey };
      try {
        window.localStorage?.setItem(SELECTED_CAPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage quota / private mode
      }
      return next;
    });
  }, []);

  const applyPayload = useCallback(
    (payload: {
      providerIds: string[];
      modelsByProvider: Record<string, SyncedModel[]>;
      customizations: Customization[];
    }) => {
      setProviderIds(payload.providerIds);
      setModelsByProvider(payload.modelsByProvider);
      setCustomizations(payload.customizations);
      setExpanded((prev) => {
        const next: Record<string, boolean> = { ...prev };
        payload.providerIds.forEach((id, i) => {
          if (!(id in next)) next[id] = i === 0;
        });
        return next;
      });
    },
    []
  );

  const refresh = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
        setLoadError(null);
      }
      try {
        const [payload, loadedCombos] = await Promise.all([
          fetchCurationPayload(),
          fetchCombosPayload(),
        ]);
        applyPayload(payload);
        setCombos(loadedCombos);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load model curation");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [applyPayload]
  );

  // Initial load: async work runs after the await inside the effect, so no
  // setState fires synchronously in the effect body (react-hooks rule).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [payload, loadedCombos] = await Promise.all([
          fetchCurationPayload(),
          fetchCombosPayload(),
        ]);
        if (cancelled) return;
        applyPayload(payload);
        setCombos(loadedCombos);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load model curation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  const customizationByModel = useMemo(() => {
    const map = new Map<string, Customization>();
    for (const c of customizations) map.set(`${c.providerId}::${c.originalModelId}`, c);
    return map;
  }, [customizations]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      text: 0,
      vision: 0,
      reasoning: 0,
      code: 0,
      image: 0,
      video: 0,
      audio: 0,
      search: 0,
      embedding: 0,
    };
    for (const pId of providerIds) {
      const pModels = modelsByProvider[pId] ?? [];
      for (const m of pModels) {
        counts.all++;
        const cust = customizationByModel.get(`${pId}::${m.id}`);
        const c = getSyncedModelCapabilities(m, cust);
        if (c.hasChat) counts.text++;
        if (c.hasVision) counts.vision++;
        if (c.hasReasoning) counts.reasoning++;
        if (c.hasCode) counts.code++;
        if (c.hasImageGen) counts.image++;
        if (c.hasVideo) counts.video++;
        if (c.hasAudio) counts.audio++;
        if (c.hasSearch) counts.search++;
        if (c.hasEmbedding) counts.embedding++;
      }
    }
    return counts;
  }, [providerIds, modelsByProvider, customizationByModel]);

  const patchCustomization = useCallback((row: Customization) => {
    setCustomizations((prev) => {
      const key = `${row.providerId}::${row.originalModelId}`;
      const idx = prev.findIndex((c) => `${c.providerId}::${row.originalModelId}` === key);
      if (idx === -1) return [...prev, row];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(
    async (providerId: string, modelId: string, active: boolean) => {
      // Optimistic in-place update for instant switch flip
      setCustomizations((prev) => {
        const idx = prev.findIndex(
          (c) => c.providerId === providerId && c.originalModelId === modelId
        );
        if (idx === -1) {
          return [
            ...prev,
            {
              providerId,
              originalModelId: modelId,
              customName: null,
              customAlias: null,
              isActive: active,
              isTested: false,
              testStatus: null,
              testHttpStatus: null,
              testLatencyMs: null,
              testResponse: null,
              contextWindow: null,
              capabilities: null,
            },
          ];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], isActive: active };
        return next;
      });

      const row = await postCuration({
        action: "setActive",
        providerId,
        originalModelId: modelId,
        active,
      });
      if (row) patchCustomization(row);
      else void refresh(false);
    },
    [patchCustomization, refresh]
  );

  const handleToggleAll = useCallback(
    async (providerId: string, active: boolean) => {
      const models = modelsByProvider[providerId] ?? [];
      if (models.length === 0) return;
      const modelIds = models.map((m) => m.id);

      // Optimistic in-place update for instant UI feedback without refresh
      setCustomizations((prev) => {
        const modelIdSet = new Set(modelIds);
        const updated = prev.map((c) =>
          c.providerId === providerId && modelIdSet.has(c.originalModelId)
            ? { ...c, isActive: active }
            : c
        );
        for (const mId of modelIds) {
          if (!updated.some((c) => c.providerId === providerId && c.originalModelId === mId)) {
            updated.push({
              providerId,
              originalModelId: mId,
              customName: null,
              customAlias: null,
              isActive: active,
              isTested: false,
              testStatus: null,
              testHttpStatus: null,
              testLatencyMs: null,
              testResponse: null,
              contextWindow: null,
              capabilities: null,
            });
          }
        }
        return updated;
      });

      try {
        await postCuration({
          action: "setAllActive",
          providerId,
          modelIds,
          active,
        });
      } finally {
        void refresh(false);
      }
    },
    [modelsByProvider, refresh]
  );

  const handleSaveSelections = useCallback(
    async (providerId: string) => {
      const models = modelsByProvider[providerId] ?? [];
      if (models.length === 0) return;

      setSavingSelectionsProviderId(providerId);

      const activeModelIds: string[] = [];
      const inactiveModelIds: string[] = [];

      for (const m of models) {
        const cust = customizationByModel.get(`${providerId}::${m.id}`);
        if (cust?.isActive === true) {
          activeModelIds.push(m.id);
        } else {
          inactiveModelIds.push(m.id);
        }
      }

      try {
        if (activeModelIds.length > 0) {
          await postCuration({
            action: "setAllActive",
            providerId,
            modelIds: activeModelIds,
            active: true,
          });
        }
        if (inactiveModelIds.length > 0) {
          await postCuration({
            action: "setAllActive",
            providerId,
            modelIds: inactiveModelIds,
            active: false,
          });
        }
        // Also persist any pending draft changes for this provider's models
        for (const m of models) {
          const key = `${providerId}::${m.id}`;
          const draft = aliasDrafts[key];
          if (draft) {
            const cust = customizationByModel.get(key);
            const nameChanged = draft.name !== (cust?.customName ?? "");
            const aliasChanged = draft.alias !== (cust?.customAlias ?? "");
            const ctxChanged =
              draft.contextWindow !== (cust?.contextWindow ? String(cust.contextWindow) : "");
            const autoFree = m.isFree === true || isCatalogFreeModel(providerId, m.id);
            const defaultTier: "free" | "paid" =
              cust?.pricingTier ??
              (cust?.isFreeOverride === false
                ? "paid"
                : cust?.isFreeOverride === true
                  ? "free"
                  : autoFree
                    ? "free"
                    : "paid");
            const tier = draft.pricingTier ?? defaultTier;
            const tierChanged =
              draft.pricingTier !== undefined && draft.pricingTier !== defaultTier;
            const origInputStr =
              cust?.inputCost != null && cust.inputCost > 0 ? String(cust.inputCost) : "";
            const origCacheStr =
              cust?.cacheCost != null && cust.cacheCost > 0 ? String(cust.cacheCost) : "";
            const origOutputStr =
              cust?.outputCost != null && cust.outputCost > 0 ? String(cust.outputCost) : "";
            const origInputCostStr =
              cust?.originalInputCost != null && cust.originalInputCost > 0
                ? String(cust.originalInputCost)
                : "";
            const origCacheCostStr =
              cust?.originalCacheCost != null && cust.originalCacheCost > 0
                ? String(cust.originalCacheCost)
                : "";
            const origOutputCostStr =
              cust?.originalOutputCost != null && cust.originalOutputCost > 0
                ? String(cust.originalOutputCost)
                : "";
            const origInputCostChanged =
              draft.originalInputCost !== undefined && draft.originalInputCost !== origInputCostStr;
            const origCacheCostChanged =
              draft.originalCacheCost !== undefined && draft.originalCacheCost !== origCacheCostStr;
            const origOutputCostChanged =
              draft.originalOutputCost !== undefined &&
              draft.originalOutputCost !== origOutputCostStr;
            const inputCostChanged =
              draft.inputCost !== undefined && draft.inputCost !== origInputStr;
            const cacheCostChanged =
              draft.cacheCost !== undefined && draft.cacheCost !== origCacheStr;
            const outputCostChanged =
              draft.outputCost !== undefined && draft.outputCost !== origOutputStr;

            if (
              nameChanged ||
              aliasChanged ||
              ctxChanged ||
              tierChanged ||
              origInputCostChanged ||
              origCacheCostChanged ||
              origOutputCostChanged ||
              inputCostChanged ||
              cacheCostChanged ||
              outputCostChanged
            ) {
              const parsedCtx = parseContextWindowInput(draft.contextWindow);
              const origInputCostNum = (draft.originalInputCost ?? "").trim()
                ? Math.max(0, Number(draft.originalInputCost))
                : 0;
              const origCacheCostNum = (draft.originalCacheCost ?? "").trim()
                ? Math.max(0, Number(draft.originalCacheCost))
                : 0;
              const origOutputCostNum = (draft.originalOutputCost ?? "").trim()
                ? Math.max(0, Number(draft.originalOutputCost))
                : 0;
              const inputCostNum =
                tier === "paid" && (draft.inputCost ?? "").trim()
                  ? Math.max(0, Number(draft.inputCost))
                  : 0;
              const cacheCostNum =
                tier === "paid" && (draft.cacheCost ?? "").trim()
                  ? Math.max(0, Number(draft.cacheCost))
                  : 0;
              const outputCostNum =
                tier === "paid" && (draft.outputCost ?? "").trim()
                  ? Math.max(0, Number(draft.outputCost))
                  : 0;

              const row = await postCuration({
                action: "save",
                providerId,
                originalModelId: m.id,
                customName: draft.name.trim() || null,
                customAlias: draft.alias.trim() || null,
                contextWindow: parsedCtx,
                isActive: cust?.isActive === true,
                isFreeOverride: tier === "free",
                pricingTier: tier,
                originalInputCost: origInputCostNum,
                originalCacheCost: origCacheCostNum,
                originalOutputCost: origOutputCostNum,
                inputCost: inputCostNum,
                cacheCost: cacheCostNum,
                outputCost: outputCostNum,
              });
              if (row) patchCustomization(row);
            }
          }
        }
        setSavedFeedbackProviderId(providerId);
        setTimeout(() => {
          setSavedFeedbackProviderId((cur) => (cur === providerId ? null : cur));
        }, 2000);
      } finally {
        setSavingSelectionsProviderId(null);
        void refresh(false);
      }
    },
    [aliasDrafts, customizationByModel, modelsByProvider, patchCustomization, refresh]
  );

  const handleCopy = useCallback((modelId: string) => {
    const done = () => {
      setCopiedId(modelId);
      window.setTimeout(() => setCopiedId((cur) => (cur === modelId ? null : cur)), 1500);
    };
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(modelId).then(done, done);
    } else {
      done();
    }
  }, []);

  const handleTest = useCallback(
    async (providerId: string, modelId: string, capOverride?: string) => {
      const key = `${providerId}::${modelId}`;
      const model = modelsByProvider[providerId]?.find((m) => m.id === modelId);
      const cust = customizationByModel.get(key);
      const capsMeta = model ? getSyncedModelCapabilities(model, cust) : null;
      const defaultCap = capsMeta?.hasChat
        ? "text"
        : capsMeta?.hasCode
          ? "code"
          : capsMeta?.hasReasoning
            ? "reasoning"
            : capsMeta?.hasVision
              ? "vision"
              : capsMeta?.hasImageGen
                ? "image_gen"
                : capsMeta?.hasAudio
                  ? "audio"
                  : capsMeta?.hasVideo
                    ? "video"
                    : capsMeta?.hasSearch
                      ? "search"
                      : capsMeta?.hasEmbedding
                        ? "embedding"
                        : "text";
      const selectedCap = capOverride || selectedCapabilities[key] || defaultCap;
      const promptToRun = getPromptForCapability(selectedCap, testPrompt);
      setTestingId(key);
      try {
        const res = await fetch("/api/v1/models/curation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "liveTest",
            providerId,
            modelId,
            prompt: promptToRun,
          }),
        });
        const data = await res.json().catch(() => null);
        const isOk = data?.status === "ok";
        setTestResults((prev) => ({
          ...prev,
          [key]: {
            ok: isOk,
            httpStatus: data?.httpStatus,
            latencyMs: data?.latencyMs,
            preview: (data?.responsePreview ?? data?.error ?? "").slice(0, 500),
          },
        }));

        // 💡 Idea 2: Auto-activate model on successful test
        if (isOk) {
          const row = await postCuration({
            action: "setActive",
            providerId,
            originalModelId: modelId,
            active: true,
          });
          if (row) {
            patchCustomization({
              ...row,
              testStatus: "verified",
              isTested: true,
              testHttpStatus: data?.httpStatus ?? 200,
              testLatencyMs: data?.latencyMs,
              testResponse: data?.responsePreview ?? null,
            });
          }
        } else {
          setCustomizations((prev) => {
            const idx = prev.findIndex(
              (c) => c.providerId === providerId && c.originalModelId === modelId
            );
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              isTested: true,
              testStatus: "failed",
              testHttpStatus: data?.httpStatus ?? 500,
              testResponse: data?.error ?? "Test failed",
            };
            return next;
          });
        }

        // The API persists the result onto the curation row — silent refresh without page flicker.
        void refresh(false);
      } catch {
        setTestResults((prev) => ({
          ...prev,
          [key]: { ok: false, preview: "Test request failed" },
        }));
      } finally {
        setTestingId(null);
      }
    },
    [
      refresh,
      testPrompt,
      selectedCapabilities,
      modelsByProvider,
      customizationByModel,
      patchCustomization,
    ]
  );

  const handleFetchModelsForProvider = useCallback(
    async (pId: string) => {
      setFetchingProviderId(pId);
      setFetchErrorByProvider((prev) => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      try {
        const res = await fetch(`/api/providers/${encodeURIComponent(pId)}/models?refresh=true`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(
            errorData?.error || `HTTP ${res.status}: Failed to fetch models from API`
          );
        }
        const data = await res.json().catch(() => ({}));
        const fetchedModels = Array.isArray(data?.models) ? data.models : [];
        if (fetchedModels.length > 0) {
          await fetch("/api/provider-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: pId,
              models: fetchedModels.map((m: any) => ({
                id: m.id || m.model || m.name,
                name: m.name || m.id,
                source: "imported",
                apiFormat: m.apiFormat || "chat-completions",
                supportedEndpoints: Array.isArray(m.supportedEndpoints)
                  ? m.supportedEndpoints
                  : ["chat"],
                ...(Array.isArray(m.capabilities) ? { capabilities: m.capabilities } : {}),
                ...(typeof m.supportsVision === "boolean"
                  ? { supportsVision: m.supportsVision }
                  : {}),
                ...(typeof m.inputTokenLimit === "number"
                  ? { inputTokenLimit: m.inputTokenLimit }
                  : {}),
                ...(typeof m.outputTokenLimit === "number"
                  ? { outputTokenLimit: m.outputTokenLimit }
                  : {}),
              })),
            }),
          });
        }
        await refresh(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to fetch models from API";
        setFetchErrorByProvider((prev) => ({ ...prev, [pId]: msg }));
      } finally {
        setFetchingProviderId(null);
      }
    },
    [refresh]
  );

  const handleSaveAlias = useCallback(
    async (providerId: string, modelId: string) => {
      const key = `${providerId}::${modelId}`;
      const cust = customizationByModel.get(key);
      const autoFree = isCatalogFreeModel(providerId, modelId);
      const defaultTier: "free" | "paid" =
        cust?.pricingTier ??
        (cust?.isFreeOverride === false
          ? "paid"
          : cust?.isFreeOverride === true
            ? "free"
            : autoFree
              ? "free"
              : "paid");
      const catPricing = getPricingForModel(providerId, modelId) as {
        inputCost?: number;
        cacheCost?: number;
        outputCost?: number;
      } | null;
      const draft = aliasDrafts[key] ?? {
        name: cust?.customName ?? "",
        alias: cust?.customAlias ?? "",
        contextWindow: cust?.contextWindow ? String(cust.contextWindow) : "",
        pricingTier: defaultTier,
        originalInputCost:
          cust?.originalInputCost != null && cust.originalInputCost > 0
            ? String(cust.originalInputCost)
            : catPricing?.inputCost != null && catPricing.inputCost > 0
              ? String(catPricing.inputCost)
              : "",
        originalCacheCost:
          cust?.originalCacheCost != null && cust.originalCacheCost > 0
            ? String(cust.originalCacheCost)
            : catPricing?.cacheCost != null && catPricing.cacheCost > 0
              ? String(catPricing.cacheCost)
              : "",
        originalOutputCost:
          cust?.originalOutputCost != null && cust.originalOutputCost > 0
            ? String(cust.originalOutputCost)
            : catPricing?.outputCost != null && catPricing.outputCost > 0
              ? String(catPricing.outputCost)
              : "",
        inputCost: cust?.inputCost != null && cust.inputCost > 0 ? String(cust.inputCost) : "",
        cacheCost: cust?.cacheCost != null && cust.cacheCost > 0 ? String(cust.cacheCost) : "",
        outputCost: cust?.outputCost != null && cust.outputCost > 0 ? String(cust.outputCost) : "",
      };
      const tier = draft.pricingTier ?? defaultTier;
      setSavingAlias(key);
      try {
        const parsedCtx = parseContextWindowInput(draft.contextWindow);
        const origInputCostNum = (draft.originalInputCost ?? "").trim()
          ? Math.max(0, Number(draft.originalInputCost))
          : 0;
        const origCacheCostNum = (draft.originalCacheCost ?? "").trim()
          ? Math.max(0, Number(draft.originalCacheCost))
          : 0;
        const origOutputCostNum = (draft.originalOutputCost ?? "").trim()
          ? Math.max(0, Number(draft.originalOutputCost))
          : 0;
        const inputCostNum =
          tier === "paid" && (draft.inputCost ?? "").trim()
            ? Math.max(0, Number(draft.inputCost))
            : 0;
        const cacheCostNum =
          tier === "paid" && (draft.cacheCost ?? "").trim()
            ? Math.max(0, Number(draft.cacheCost))
            : 0;
        const outputCostNum =
          tier === "paid" && (draft.outputCost ?? "").trim()
            ? Math.max(0, Number(draft.outputCost))
            : 0;

        const row = await postCuration({
          action: "save",
          providerId,
          originalModelId: modelId,
          customName: draft.name.trim() || null,
          customAlias: draft.alias.trim() || null,
          contextWindow: parsedCtx,
          isFreeOverride: tier === "free",
          pricingTier: tier,
          originalInputCost: origInputCostNum,
          originalCacheCost: origCacheCostNum,
          originalOutputCost: origOutputCostNum,
          inputCost: inputCostNum,
          cacheCost: cacheCostNum,
          outputCost: outputCostNum,
        });
        if (row) patchCustomization(row);
      } finally {
        setSavingAlias(null);
      }
    },
    [aliasDrafts, customizationByModel, patchCustomization]
  );

  const handleToggleComboActive = useCallback(
    async (comboId: string, active: boolean) => {
      setCombos((prev) =>
        prev.map((c) => (c.id === comboId ? { ...c, isActive: active } : c))
      );
      try {
        await fetch(`/api/combos/${encodeURIComponent(comboId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: active }),
        });
      } catch {
        void refresh(false);
      }
    },
    [refresh]
  );

  const handleSaveCombo = useCallback(
    async (comboId: string) => {
      const combo = combos.find((c) => c.id === comboId);
      if (!combo) return;
      const draft = comboDrafts[comboId] ?? {
        displayName: combo.displayName ?? "",
        customAlias: combo.customAlias ?? "",
        contextWindow: combo.context_length ? String(combo.context_length) : "",
        pricingTier: combo.pricing?.tier ?? "paid",
        originalInputCost:
          combo.pricing?.originalInputCost != null && combo.pricing.originalInputCost > 0
            ? String(combo.pricing.originalInputCost)
            : "",
        originalCacheCost:
          combo.pricing?.originalCacheCost != null && combo.pricing.originalCacheCost > 0
            ? String(combo.pricing.originalCacheCost)
            : "",
        originalOutputCost:
          combo.pricing?.originalOutputCost != null && combo.pricing.originalOutputCost > 0
            ? String(combo.pricing.originalOutputCost)
            : "",
        inputCost:
          combo.pricing?.inputCost != null && combo.pricing.inputCost > 0
            ? String(combo.pricing.inputCost)
            : "",
        cacheCost:
          combo.pricing?.cacheCost != null && combo.pricing.cacheCost > 0
            ? String(combo.pricing.cacheCost)
            : "",
        outputCost:
          combo.pricing?.outputCost != null && combo.pricing.outputCost > 0
            ? String(combo.pricing.outputCost)
            : "",
      };

      setSavingComboId(comboId);
      try {
        const parsedCtx = parseContextWindowInput(draft.contextWindow);
        const origInputCostNum = (draft.originalInputCost ?? "").trim()
          ? Math.max(0, Number(draft.originalInputCost))
          : 0;
        const origCacheCostNum = (draft.originalCacheCost ?? "").trim()
          ? Math.max(0, Number(draft.originalCacheCost))
          : 0;
        const origOutputCostNum = (draft.originalOutputCost ?? "").trim()
          ? Math.max(0, Number(draft.originalOutputCost))
          : 0;
        const inputCostNum =
          draft.pricingTier === "paid" && (draft.inputCost ?? "").trim()
            ? Math.max(0, Number(draft.inputCost))
            : 0;
        const cacheCostNum =
          draft.pricingTier === "paid" && (draft.cacheCost ?? "").trim()
            ? Math.max(0, Number(draft.cacheCost))
            : 0;
        const outputCostNum =
          draft.pricingTier === "paid" && (draft.outputCost ?? "").trim()
            ? Math.max(0, Number(draft.outputCost))
            : 0;

        const payload = {
          displayName: draft.displayName.trim() || null,
          customAlias: draft.customAlias.trim() || null,
          context_length: parsedCtx,
          pricing: {
            tier: draft.pricingTier,
            originalInputCost: origInputCostNum,
            originalCacheCost: origCacheCostNum,
            originalOutputCost: origOutputCostNum,
            inputCost: inputCostNum,
            cacheCost: cacheCostNum,
            outputCost: outputCostNum,
          },
        };

        const res = await fetch(`/api/combos/${encodeURIComponent(comboId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const updatedCombo = data?.combo;
          if (updatedCombo) {
            setCombos((prev) =>
              prev.map((c) => (c.id === comboId ? { ...c, ...updatedCombo } : c))
            );
          }
        }
      } finally {
        setSavingComboId(null);
      }
    },
    [comboDrafts, combos]
  );

  const _handleFreeOverride = useCallback(
    async (providerId: string, modelId: string, value: boolean | null) => {
      // Optimistic in-place update for instant badge change
      setCustomizations((prev) => {
        const idx = prev.findIndex(
          (c) => c.providerId === providerId && c.originalModelId === modelId
        );
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], isFreeOverride: value };
        return next;
      });
      const row = await postCuration({
        action: "save",
        providerId,
        originalModelId: modelId,
        isFreeOverride: value,
      });
      if (row) patchCustomization(row);
      else void refresh(false);
    },
    [patchCustomization, refresh]
  );

  // Turkish-safe search via matchesSearch (empty query matches all).

  if (loading) {
    return <ShimmerPageLoader variant="table" />;
  }

  if (loadError) {
    return (
      <Card className="p-6">
        <div
          role="alert"
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-400/40 bg-red-500/10 text-sm"
        >
          <span className="material-symbols-outlined text-[18px] text-red-500">error</span>
          <div className="flex-1">
            <p className="font-medium text-red-600 dark:text-red-300">
              Failed to load Pipe Models: {loadError}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 text-xs font-medium text-text-main underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (providerIds.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-main shadow-xs">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-text-main">Pipe Models</h1>
              <p className="text-xs text-text-muted">
                Configure active models, custom aliases, live capability verification, and billing
                tiers.
              </p>
            </div>
          </div>
          <div className="self-end sm:self-auto">
            <DefaultCapabilitiesPromptModal
              testPrompt={testPrompt}
              onPromptChange={setTestPrompt}
              isOpen={showCapabilityPrompt}
              onToggle={() => setShowCapabilityPrompt((prev) => !prev)}
            />
          </div>
        </div>
        <div className="p-6 rounded-xl border border-border bg-surface shadow-xs">
          <p className="text-xs text-text-muted">
            No active connected providers found. Connect a provider first — its models will appear
            here for activation, aliasing, and testing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── Top Header Bar with OpenCode Trigger Button ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-main shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[18px]">tune</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-text-main truncate">
              Pipe Models
            </h1>
            <p className="text-xs text-text-muted">
              Rename the alias models name, ID, and context limits for selected models only. Empty
              fields will be by default original model names and IDs.
            </p>
          </div>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          <DefaultCapabilitiesPromptModal
            testPrompt={testPrompt}
            onPromptChange={setTestPrompt}
            isOpen={showCapabilityPrompt}
            onToggle={() => setShowCapabilityPrompt((prev) => !prev)}
          />
        </div>
      </div>

      {/* ── OpenCode Search & Modality Segmented Bar ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 w-full min-w-0 max-w-full">
        <div className="relative w-full lg:w-64 xl:w-72 shrink-0">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
            search
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models by id or name…"
            className="w-full h-8 rounded-lg border border-border bg-bg-subtle pl-8 pr-7 py-1 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-border-strong transition-all font-mono"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-white/10 hover:bg-white/20 text-text-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>

        {/* Capability Segmented Control Pills with smooth horizontal scrolling */}
        <div className="flex-1 min-w-0 max-w-full overflow-x-auto p-1 rounded-lg bg-bg-subtle border border-border [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30">
          <div className="flex items-center gap-1 min-w-max">
            {CAPABILITY_FILTER_BUTTONS.map((opt) => {
              const isActive = capabilityFilter === opt.key;
              const count = filterCounts[opt.key] ?? 0;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCapabilityFilter(opt.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-surface text-text-main border border-border shadow-xs font-semibold"
                      : "text-text-muted hover:text-text-main hover:bg-white/[0.04]"
                  }`}
                >
                  {opt.icon && (
                    <span className="material-symbols-outlined text-[13px] leading-none">
                      {opt.icon}
                    </span>
                  )}
                  <span>{opt.label}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-bg border border-border/60 text-text-muted">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Combos Inset Group Card ── */}
      {combos.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden transition-all mb-2.5">
          {/* Combos Group Header */}
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 bg-surface hover:bg-bg-subtle/40 transition-colors border-b border-border/40">
            <button
              type="button"
              onClick={() => setCombosExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-left w-full sm:w-auto sm:flex-1 cursor-pointer min-w-0"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-text-muted transition-transform duration-200 ${
                  combosExpanded ? "rotate-90" : ""
                }`}
              >
                chevron_right
              </span>
              <span className="material-symbols-outlined text-[16px] text-purple-400">
                layers
              </span>
              <span className="font-mono font-semibold text-xs tracking-tight text-text-main truncate">
                Routing Combos
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 shrink-0">
                {combos.filter((c) => c.isActive !== false).length}/{combos.length} active
              </span>
            </button>
          </div>

          {/* Combos List */}
          {combosExpanded && (
            <div className="border-t border-border/40">
              {combos
                .filter((c) => {
                  const targetName = c.displayName || c.name || c.id;
                  const targetAlias = c.customAlias || "";
                  return matchesSearch(targetName, filter) || matchesSearch(targetAlias, filter);
                })
                .map((combo, index, arr) => {
                  const draft = comboDrafts[combo.id] ?? {
                    displayName: combo.displayName ?? "",
                    customAlias: combo.customAlias ?? "",
                    contextWindow: combo.context_length ? String(combo.context_length) : "",
                    pricingTier: combo.pricing?.tier ?? "paid",
                    originalInputCost:
                      combo.pricing?.originalInputCost != null && combo.pricing.originalInputCost > 0
                        ? String(combo.pricing.originalInputCost)
                        : "",
                    originalCacheCost:
                      combo.pricing?.originalCacheCost != null && combo.pricing.originalCacheCost > 0
                        ? String(combo.pricing.originalCacheCost)
                        : "",
                    originalOutputCost:
                      combo.pricing?.originalOutputCost != null && combo.pricing.originalOutputCost > 0
                        ? String(combo.pricing.originalOutputCost)
                        : "",
                    inputCost:
                      combo.pricing?.inputCost != null && combo.pricing.inputCost > 0
                        ? String(combo.pricing.inputCost)
                        : "",
                    cacheCost:
                      combo.pricing?.cacheCost != null && combo.pricing.cacheCost > 0
                        ? String(combo.pricing.cacheCost)
                        : "",
                    outputCost:
                      combo.pricing?.outputCost != null && combo.pricing.outputCost > 0
                        ? String(combo.pricing.outputCost)
                        : "",
                  };
                  const isComboActive = combo.isActive !== false;
                  const isComboFree = draft.pricingTier === "free";

                  return (
                    <Fragment key={combo.id}>
                      <div className="px-3 sm:px-4 py-2.5 space-y-2 hover:bg-bg-subtle/30 transition-colors">
                        {/* Header Row */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            {/* Active Toggle Switch */}
                            <label
                              className="relative inline-flex items-center cursor-pointer shrink-0"
                              title={isComboActive ? "Active" : "Disabled"}
                            >
                              <input
                                type="checkbox"
                                checked={isComboActive}
                                onChange={(e) =>
                                  void handleToggleComboActive(combo.id, e.target.checked)
                                }
                                aria-label={`Activate combo ${combo.name}`}
                                className="sr-only"
                              />
                              <div
                                className={`w-7.5 h-4.5 rounded-full transition-colors duration-200 ease-in-out p-0.5 flex items-center ${
                                  isComboActive ? "bg-purple-500 shadow-xs" : "bg-zinc-700"
                                }`}
                              >
                                <div
                                  className={`size-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                                    isComboActive ? "translate-x-3" : "translate-x-0"
                                  }`}
                                />
                              </div>
                            </label>

                            <span className="font-mono text-xs font-semibold text-text-main break-all select-all">
                              {combo.name || combo.id}
                            </span>

                            {combo.strategy && (
                              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-bg-subtle border border-border text-text-muted shrink-0">
                                {combo.strategy}
                              </span>
                            )}

                            {/* Free / Paid Toggle Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setComboDrafts((prev) => ({
                                  ...prev,
                                  [combo.id]: {
                                    ...draft,
                                    pricingTier: draft.pricingTier === "free" ? "paid" : "free",
                                  },
                                }))
                              }
                              title="Click to toggle Free / Paid"
                              className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border select-none shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
                                isComboFree
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                  : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[11px]">
                                {isComboFree ? "check_circle" : "payments"}
                              </span>
                              <span>{isComboFree ? "FREE" : "PAID"}</span>
                            </button>
                          </div>

                          {/* Save Button for this Combo */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleSaveCombo(combo.id)}
                              disabled={savingComboId === combo.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                              title="Save combo configuration and pricing"
                            >
                              <span
                                className={`material-symbols-outlined text-[13px] ${
                                  savingComboId === combo.id ? "animate-spin" : ""
                                }`}
                              >
                                {savingComboId === combo.id ? "progress_activity" : "save"}
                              </span>
                              <span>{savingComboId === combo.id ? "Saving…" : "Save"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Manageable Fields when combo is active */}
                        {isComboActive && (
                          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/40">
                            {/* Original Read-Only Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-2.5 py-1.5 rounded-lg bg-bg-subtle/30 border border-border/40 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted shrink-0">
                                  Orig Name:
                                </span>
                                <span className="font-mono text-zinc-300 truncate">{combo.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted shrink-0">
                                  Orig ID:
                                </span>
                                <span className="font-mono text-zinc-300 truncate">{combo.id}</span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted shrink-0">
                                  Strategy:
                                </span>
                                <span className="font-mono text-zinc-300 truncate">{combo.strategy}</span>
                              </div>
                            </div>

                            {/* Modern Columnar Grid: Original on top, Custom below for every property */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                              {/* 1. Combo Name */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">alt_route</span>
                                    Combo Name
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Original
                                  </span>
                                  <div
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center select-all"
                                    title={combo.name || combo.id}
                                  >
                                    {combo.name || combo.id}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Custom
                                  </span>
                                  <input
                                    value={draft.displayName}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, displayName: e.target.value },
                                      }))
                                    }
                                    placeholder={combo.name || combo.id}
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>

                              {/* 2. Combo Alias */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">fingerprint</span>
                                    Combo ID / Alias
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Original
                                  </span>
                                  <div
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center select-all"
                                    title={combo.id}
                                  >
                                    {combo.id}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Custom
                                  </span>
                                  <input
                                    value={draft.customAlias}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, customAlias: e.target.value },
                                      }))
                                    }
                                    placeholder={combo.id}
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>

                              {/* 3. Context Window */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">memory</span>
                                    Context Window
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Original
                                  </span>
                                  <div
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center"
                                  >
                                    {combo.context_length
                                      ? `${combo.context_length >= 1000 ? Math.round(combo.context_length / 1000) + "K" : combo.context_length}`
                                      : "Inherited"}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    Custom
                                  </span>
                                  <input
                                    value={draft.contextWindow}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, contextWindow: e.target.value },
                                      }))
                                    }
                                    placeholder="e.g. 500k"
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>

                              {/* 4. Input Cost */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">arrow_downward</span>
                                    Input ($/1M)
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Orig (Cut-Bal)
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={draft.originalInputCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, originalInputCost: e.target.value },
                                      }))
                                    }
                                    placeholder="e.g. 1.00"
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom (Rate)
                                    </span>
                                    {isComboFree && (
                                      <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                    )}
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    disabled={isComboFree}
                                    value={isComboFree ? "0" : draft.inputCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, inputCost: e.target.value },
                                      }))
                                    }
                                    placeholder={isComboFree ? "0 (Free)" : "e.g. 0.50"}
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>

                              {/* 5. Cache Read Cost */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">cached</span>
                                    Cache ($/1M)
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Orig (Cut-Bal)
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={draft.originalCacheCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, originalCacheCost: e.target.value },
                                      }))
                                    }
                                    placeholder="e.g. 0.25"
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom (Rate)
                                    </span>
                                    {isComboFree && (
                                      <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                    )}
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    disabled={isComboFree}
                                    value={isComboFree ? "0" : draft.cacheCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, cacheCost: e.target.value },
                                      }))
                                    }
                                    placeholder={isComboFree ? "0 (Free)" : "e.g. 0.125"}
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>

                              {/* 6. Output Cost */}
                              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                  <span className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[13px] text-text-muted">arrow_upward</span>
                                    Output ($/1M)
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    Orig (Cut-Bal)
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={draft.originalOutputCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, originalOutputCost: e.target.value },
                                      }))
                                    }
                                    placeholder="e.g. 3.00"
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom (Rate)
                                    </span>
                                    {isComboFree && (
                                      <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                    )}
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    disabled={isComboFree}
                                    value={isComboFree ? "0" : draft.outputCost}
                                    onChange={(e) =>
                                      setComboDrafts((prev) => ({
                                        ...prev,
                                        [combo.id]: { ...draft, outputCost: e.target.value },
                                      }))
                                    }
                                    placeholder={isComboFree ? "0 (Free)" : "e.g. 1.50"}
                                    className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {index < arr.length - 1 && <div className="w-full h-px bg-zinc-600" />}
                    </Fragment>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── Connected Provider Inset Group Cards ── */}
      <div className="space-y-2.5">
        {providerIds.map((providerId) => {
          const all = modelsByProvider[providerId] ?? [];
          const models = all.filter((m) => {
            const cust = customizationByModel.get(`${providerId}::${m.id}`);
            if (
              capabilityFilter !== "all" &&
              !matchesSyncedModelFilter(m, capabilityFilter, cust)
            ) {
              return false;
            }
            return (
              matchesSearch(m.id, filter) || (Boolean(m.name) && matchesSearch(m.name!, filter))
            );
          });
          const activeCount = all.filter(
            (m) => customizationByModel.get(`${providerId}::${m.id}`)?.isActive === true
          ).length;
          const isOpen = expanded[providerId] !== false;

          return (
            <div
              key={providerId}
              className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden transition-all"
            >
              {/* Group Header */}
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 bg-surface hover:bg-bg-subtle/40 transition-colors border-b border-border/40">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [providerId]: !isOpen }))}
                  className="flex items-center gap-2 text-left w-full sm:w-auto sm:flex-1 cursor-pointer min-w-0"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] text-text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  >
                    chevron_right
                  </span>
                  <span className="font-mono font-semibold text-xs tracking-tight text-text-main truncate">
                    {providerId}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-bg-subtle border border-border text-text-muted shrink-0">
                    {activeCount}/{all.length} active
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleAll(providerId, true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-bg-subtle hover:bg-bg text-text-muted hover:text-text-main text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                    title={`Select all models for ${providerId}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-emerald-400">
                      done_all
                    </span>
                    <span>Select All</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleAll(providerId, false);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-bg-subtle hover:bg-bg text-text-muted hover:text-text-main text-[10px] font-medium transition-all cursor-pointer active:scale-95"
                    title={`Deselect all models for ${providerId}`}
                  >
                    <span className="material-symbols-outlined text-[12px] text-text-muted">
                      remove_done
                    </span>
                    <span>Deselect All</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingSelectionsProviderId === providerId}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSaveSelections(providerId);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] font-medium transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                      savedFeedbackProviderId === providerId
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                        : "border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
                    }`}
                    title={`Save all selected models for ${providerId}`}
                  >
                    <span
                      className={`material-symbols-outlined text-[12px] ${
                        savingSelectionsProviderId === providerId ? "animate-spin" : ""
                      }`}
                    >
                      {savingSelectionsProviderId === providerId
                        ? "progress_activity"
                        : savedFeedbackProviderId === providerId
                          ? "check"
                          : "save"}
                    </span>
                    <span>
                      {savingSelectionsProviderId === providerId
                        ? "Saving…"
                        : savedFeedbackProviderId === providerId
                          ? "Saved!"
                          : "Save Selections"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={fetchingProviderId === providerId}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleFetchModelsForProvider(providerId);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border hover:border-primary/40 bg-bg-subtle hover:bg-bg text-text-main text-[11px] font-medium transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
                    title={`Fetch live models for ${providerId} from /v1/models`}
                  >
                    <span
                      className={`material-symbols-outlined text-[13px] ${
                        fetchingProviderId === providerId ? "animate-spin" : ""
                      }`}
                    >
                      {fetchingProviderId === providerId ? "progress_activity" : "cloud_sync"}
                    </span>
                    <span>{fetchingProviderId === providerId ? "Syncing…" : "Fetch Models"}</span>
                  </button>
                </div>
              </div>

              {/* Provider Fetch Error Alert */}
              {fetchErrorByProvider[providerId] && (
                <div className="px-3.5 py-2 bg-red-950/30 border-y border-red-800/30 text-red-200 text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-400 text-[16px] shrink-0 mt-0.5">
                    error
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-red-300 text-[11px]">Sync Failed</span>
                    <span className="font-mono text-[10px] text-red-200/90 break-all">
                      {fetchErrorByProvider[providerId]}
                    </span>
                  </div>
                </div>
              )}

              {/* Models List */}
              {isOpen && (
                <div className="border-t border-border/40">
                  {models.length === 0 && (
                    <p className="px-4 py-3 text-xs text-text-muted font-mono">
                      {all.length === 0
                        ? "No synced models for this provider yet — click Fetch Models above."
                        : "No models match your search."}
                    </p>
                  )}
                  {models.map((m, index) => {
                    const key = `${providerId}::${m.id}`;
                    const cust = customizationByModel.get(key);
                    const isActive = cust ? cust.isActive === true : false;
                    const autoFree = m.isFree === true || isCatalogFreeModel(providerId, m.id);
                    const defaultTier: "free" | "paid" =
                      cust?.pricingTier ??
                      (cust?.isFreeOverride === false
                        ? "paid"
                        : cust?.isFreeOverride === true
                          ? "free"
                          : autoFree
                            ? "free"
                            : "paid");
                    const catPricing = getPricingForModel(providerId, m.id) as {
                      inputCost?: number;
                      cacheCost?: number;
                      outputCost?: number;
                    } | null;
                    const draft = aliasDrafts[key] ?? {
                      name: cust?.customName ?? "",
                      alias: cust?.customAlias ?? "",
                      contextWindow: cust?.contextWindow ? String(cust.contextWindow) : "",
                      pricingTier: defaultTier,
                      originalInputCost:
                        cust?.originalInputCost != null && cust.originalInputCost > 0
                          ? String(cust.originalInputCost)
                          : catPricing?.inputCost != null && catPricing.inputCost > 0
                            ? String(catPricing.inputCost)
                            : "",
                      originalCacheCost:
                        cust?.originalCacheCost != null && cust.originalCacheCost > 0
                          ? String(cust.originalCacheCost)
                          : catPricing?.cacheCost != null && catPricing.cacheCost > 0
                            ? String(catPricing.cacheCost)
                            : "",
                      originalOutputCost:
                        cust?.originalOutputCost != null && cust.originalOutputCost > 0
                          ? String(cust.originalOutputCost)
                          : catPricing?.outputCost != null && catPricing.outputCost > 0
                            ? String(catPricing.outputCost)
                            : "",
                      inputCost:
                        cust?.inputCost != null && cust.inputCost > 0 ? String(cust.inputCost) : "",
                      cacheCost:
                        cust?.cacheCost != null && cust.cacheCost > 0 ? String(cust.cacheCost) : "",
                      outputCost:
                        cust?.outputCost != null && cust.outputCost > 0
                          ? String(cust.outputCost)
                          : "",
                    };
                    const currentTier: "free" | "paid" = draft.pricingTier ?? defaultTier;
                    const ctxTokens = cust?.contextWindow ?? m.contextWindow ?? m.inputTokenLimit;
                    const ctxLabel = formatContextWindow(ctxTokens ?? null);
                    const origCtxTokens = m.contextWindow ?? m.inputTokenLimit;
                    const origCtxLabel = formatContextWindow(origCtxTokens ?? null);
                    const capsMeta = getSyncedModelCapabilities(m, cust);
                    const defaultCap = capsMeta.hasChat
                      ? "text"
                      : capsMeta.hasCode
                        ? "code"
                        : capsMeta.hasReasoning
                          ? "reasoning"
                          : capsMeta.hasVision
                            ? "vision"
                            : capsMeta.hasImageGen
                              ? "image_gen"
                              : capsMeta.hasAudio
                                ? "audio"
                                : capsMeta.hasVideo
                                  ? "video"
                                  : capsMeta.hasSearch
                                    ? "search"
                                    : capsMeta.hasEmbedding
                                      ? "embedding"
                                      : "text";
                    const selectedCap = selectedCapabilities[key] || defaultCap;
                    const isFree =
                      currentTier === "free"
                        ? true
                        : currentTier === "paid"
                          ? false
                          : cust?.isFreeOverride === true
                            ? true
                            : cust?.isFreeOverride === false
                              ? false
                              : autoFree;
                    const test = testResults[key];
                    const cachedBadge = !test && cust?.isTested && cust.testStatus;

                    return (
                      <Fragment key={m.id}>
                        <div className="px-3 sm:px-4 py-2.5 space-y-2 hover:bg-bg-subtle/30 transition-colors">
                          {/* Responsive Model Row Header */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            {/* Left: Model Identity & Badges */}
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              {/* OpenCode Toggle for Active Status */}
                              <label
                                className="relative inline-flex items-center cursor-pointer shrink-0"
                                title={isActive ? "Active (downstream accessible)" : "Disabled"}
                              >
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  onChange={(e) =>
                                    void handleToggleActive(providerId, m.id, e.target.checked)
                                  }
                                  aria-label={`Activate ${m.id}`}
                                  className="sr-only"
                                />
                                <div
                                  className={`w-7.5 h-4.5 rounded-full transition-colors duration-200 ease-in-out p-0.5 flex items-center ${
                                    isActive ? "bg-emerald-500 shadow-xs" : "bg-zinc-700"
                                  }`}
                                >
                                  <div
                                    className={`size-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                                      isActive ? "translate-x-3" : "translate-x-0"
                                    }`}
                                  />
                                </div>
                              </label>

                              <span className="font-mono text-xs font-semibold text-text-main break-all select-all">
                                {m.id}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleCopy(m.id)}
                                title="Copy model ID"
                                aria-label={`Copy model ID ${m.id}`}
                                className="size-5 rounded hover:bg-bg-subtle text-text-muted hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shrink-0"
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {copiedId === m.id ? "check" : "content_copy"}
                                </span>
                              </button>

                              {/* Interactive FREE / PAID toggle button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setAliasDrafts((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...draft,
                                      pricingTier: currentTier === "free" ? "paid" : "free",
                                    },
                                  }))
                                }
                                title="Click to toggle Free / Paid"
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border select-none shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
                                  isFree
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                    : "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[11px]">
                                  {isFree ? "check_circle" : "payments"}
                                </span>
                                <span>{isFree ? "FREE" : "PAID"}</span>
                                {cust?.isFreeOverride != null && (
                                  <span className="ml-0.5 opacity-70 normal-case text-[8px]">
                                    manual
                                  </span>
                                )}
                              </button>

                              {ctxLabel && (
                                <span
                                  title={
                                    cust?.contextWindow
                                      ? `Custom context window override: ${cust.contextWindow} tokens`
                                      : `Context window: ${ctxTokens} tokens`
                                  }
                                  className={`text-[9px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                                    cust?.contextWindow
                                      ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                                      : "bg-bg-subtle border-border text-text-muted"
                                  }`}
                                >
                                  {ctxLabel} ctx{cust?.contextWindow ? " (custom)" : ""}
                                </span>
                              )}
                            </div>

                            {/* Right: Capability Selector, Test Action & SINGLE Model Save Button */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-between sm:justify-end">
                              {/* Compact & Selectable Capability Icon Buttons */}
                              <div className="inline-flex items-center p-1 rounded-lg bg-bg-subtle/50 border border-border/60 gap-1.5 shrink-0 max-w-full overflow-x-auto">
                                {capsMeta.hasChat && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "text")}
                                    title="Chat"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "text"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      chat
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasVision && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "vision")}
                                    title="Vision"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "vision"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      visibility
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasReasoning && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "reasoning")}
                                    title="Reasoning"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "reasoning"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      psychology
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasCode && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "code")}
                                    title="Code"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "code"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      code
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasImageGen && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "image_gen")}
                                    title="Image Gen"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "image_gen" || selectedCap === "image"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      palette
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasVideo && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "video")}
                                    title="Video"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "video"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      videocam
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasAudio && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "audio")}
                                    title="Audio"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "audio"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      volume_up
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasSearch && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "search")}
                                    title="Search"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "search"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      travel_explore
                                    </span>
                                  </button>
                                )}
                                {capsMeta.hasEmbedding && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCapability(key, "embedding")}
                                    title="Embedding"
                                    className={`size-6 rounded-md shrink-0 transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                                      selectedCap === "embedding"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500 shadow-xs ring-1 ring-emerald-500/30 font-bold"
                                        : "bg-bg-subtle/40 text-text-muted hover:text-text-main border border-border/80 hover:border-zinc-500"
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] scale-[0.55] origin-center leading-none select-none flex items-center justify-center">
                                      hub
                                    </span>
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Test Status Badge */}
                                {(test || cachedBadge) && (
                                  <span
                                    className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                      (test ? test.ok : cust?.testStatus === "verified")
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                                    }`}
                                  >
                                    {(test ? test.ok : cust?.testStatus === "verified")
                                      ? "Verified"
                                      : "Failed"}
                                    {(test?.httpStatus ?? cust?.testHttpStatus) != null &&
                                      ` · ${test?.httpStatus ?? cust?.testHttpStatus}`}
                                  </span>
                                )}

                                {/* OpenCode Test Button with selected capability */}
                                <button
                                  type="button"
                                  onClick={() => void handleTest(providerId, m.id, selectedCap)}
                                  disabled={testingId === key}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-bg-subtle hover:bg-bg active:scale-95 text-text-main border border-border hover:border-emerald-500/50 hover:text-emerald-400 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                                  title={`Test model with ${selectedCap.toUpperCase()} prompt`}
                                >
                                  <span
                                    className={`material-symbols-outlined text-[13px] ${
                                      testingId === key ? "animate-spin text-emerald-400" : ""
                                    }`}
                                  >
                                    {testingId === key ? "progress_activity" : "play_arrow"}
                                  </span>
                                  <span>
                                    {testingId === key
                                      ? `Testing (${selectedCap})…`
                                      : `Test (${selectedCap})`}
                                  </span>
                                </button>

                                {/* ONLY Save Button for this Model - Right Next to Test Button */}
                                <button
                                  type="button"
                                  onClick={() => void handleSaveAlias(providerId, m.id)}
                                  disabled={savingAlias === key}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                                  title="Save this model's custom names and pricing"
                                >
                                  <span
                                    className={`material-symbols-outlined text-[13px] ${
                                      savingAlias === key ? "animate-spin" : ""
                                    }`}
                                  >
                                    {savingAlias === key ? "progress_activity" : "save"}
                                  </span>
                                  <span>{savingAlias === key ? "Saving…" : "Save"}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Test Response Preview */}
                          {(() => {
                            const previewText = (test?.preview ?? cust?.testResponse ?? "").slice(
                              0,
                              500
                            );
                            if (!previewText) return null;
                            const hasImg = isImageResponse(previewText);
                            return (
                              <div className="p-2.5 rounded-lg bg-black/40 border border-border text-[11px] font-mono text-zinc-300 break-words leading-relaxed flex items-start gap-2.5 min-w-0 overflow-hidden">
                                {hasImg && (
                                  <a
                                    href={extractImageUrl(previewText)}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Click to view full image in new tab"
                                    className="shrink-0 group/img"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={extractImageUrl(previewText)}
                                      alt="Generated output"
                                      className="size-12 rounded-lg object-cover border border-white/20 group-hover/img:scale-110 transition-transform shadow-md"
                                    />
                                  </a>
                                )}
                                <div className="flex-1 min-w-0 break-words overflow-hidden">
                                  <span className="break-all sm:break-words">{previewText}</span>
                                  {(test?.latencyMs ?? cust?.testLatencyMs) != null && (
                                    <span className="text-zinc-500 font-sans ml-2 text-[10px] whitespace-nowrap">
                                      · {test?.latencyMs ?? cust?.testLatencyMs}ms
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* OpenCode Manageable Fields: Original vs Custom + Pricing */}
                          {isActive && (
                            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                              {/* Modern Columnar Grid: Original on top, Custom below for every property */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                                {/* 1. Model Name */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">badge</span>
                                      Model Name
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Original
                                    </span>
                                    <div
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center select-all"
                                      title={m.name || m.id}
                                    >
                                      {m.name || m.id}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom
                                    </span>
                                    <input
                                      value={draft.name}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, name: e.target.value },
                                        }))
                                      }
                                      placeholder={m.name || m.id}
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>

                                {/* 2. Model ID / Alias */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">fingerprint</span>
                                      Model ID / Alias
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Original
                                    </span>
                                    <div
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center select-all"
                                      title={m.id}
                                    >
                                      {m.id}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom
                                    </span>
                                    <input
                                      value={draft.alias}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, alias: e.target.value },
                                        }))
                                      }
                                      placeholder={m.id}
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>

                                {/* 3. Context Window */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">memory</span>
                                      Context Window
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Original
                                    </span>
                                    <div
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base/60 border border-border/40 rounded text-text-muted truncate flex items-center"
                                      title={origCtxLabel || "N/A"}
                                    >
                                      {origCtxLabel || "N/A"}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Custom
                                    </span>
                                    <input
                                      value={draft.contextWindow}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, contextWindow: e.target.value },
                                        }))
                                      }
                                      placeholder={
                                        origCtxTokens
                                          ? `${origCtxTokens} (e.g. 500k)`
                                          : "e.g. 500k"
                                      }
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>

                                {/* 4. Input Cost */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">arrow_downward</span>
                                      Input ($/1M)
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Orig (Cut-Bal)
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      value={draft.originalInputCost ?? ""}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, originalInputCost: e.target.value },
                                        }))
                                      }
                                      placeholder="e.g. 1.00"
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Custom (Rate)
                                      </span>
                                      {currentTier === "free" && (
                                        <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                      )}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      disabled={currentTier === "free"}
                                      value={currentTier === "free" ? "0" : (draft.inputCost ?? "")}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, inputCost: e.target.value },
                                        }))
                                      }
                                      placeholder={currentTier === "free" ? "0 (Free)" : "e.g. 0.50"}
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>

                                {/* 5. Cache Read Cost */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">cached</span>
                                      Cache ($/1M)
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Orig (Cut-Bal)
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      value={draft.originalCacheCost ?? ""}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, originalCacheCost: e.target.value },
                                        }))
                                      }
                                      placeholder="e.g. 0.25"
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Custom (Rate)
                                      </span>
                                      {currentTier === "free" && (
                                        <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                      )}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      disabled={currentTier === "free"}
                                      value={currentTier === "free" ? "0" : (draft.cacheCost ?? "")}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, cacheCost: e.target.value },
                                        }))
                                      }
                                      placeholder={currentTier === "free" ? "0 (Free)" : "e.g. 0.125"}
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>

                                {/* 6. Output Cost */}
                                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-subtle/50 border border-border/60">
                                  <div className="flex items-center justify-between text-[11px] font-medium text-text-main pb-1 border-b border-border/40">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px] text-text-muted">arrow_upward</span>
                                      Output ($/1M)
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                      Orig (Cut-Bal)
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      value={draft.originalOutputCost ?? ""}
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, originalOutputCost: e.target.value },
                                        }))
                                      }
                                      placeholder="e.g. 3.00"
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70 transition-all"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/90 flex items-center justify-between">
                                      <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Custom (Rate)
                                      </span>
                                      {currentTier === "free" && (
                                        <span className="text-[8.5px] text-emerald-400 font-semibold">$0 Free</span>
                                      )}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      disabled={currentTier === "free"}
                                      value={
                                        currentTier === "free" ? "0" : (draft.outputCost ?? "")
                                      }
                                      onChange={(e) =>
                                        setAliasDrafts((prev) => ({
                                          ...prev,
                                          [key]: { ...draft, outputCost: e.target.value },
                                        }))
                                      }
                                      placeholder={currentTier === "free" ? "0 (Free)" : "e.g. 1.50"}
                                      className="h-7 px-2 py-1 text-[11px] font-mono bg-bg-base border border-border rounded text-text-main placeholder:text-zinc-600 disabled:opacity-50 disabled:bg-bg-subtle focus:outline-none focus:border-emerald-500/70 transition-all"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Full-Width Visible Grey Divider Between Models */}
                        {index < models.length - 1 && <div className="w-full h-px bg-zinc-600" />}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
