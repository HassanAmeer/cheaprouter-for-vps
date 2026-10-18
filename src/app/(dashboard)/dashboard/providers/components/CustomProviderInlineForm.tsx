"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Input, Select, Badge, Textarea, ProviderImagePicker } from "@/shared/components";
import { readFetchErrorMessage } from "@/shared/utils/fetchError";
import ServerPortsSheet from "./ServerPortsSheet";

/** One repeatable model row — "ID / Name / Reasoning / Image". */
export type ModelRow = {
  key: string;
  id: string;
  name: string;
  reasoning: boolean;
  image: boolean;
};

/** One repeatable header row — "Header / Value". */
export type HeaderRow = {
  key: string;
  name: string;
  value: string;
};

/** The 5 provider categories supported for custom providers. */
export type CustomProviderCategory =
  | "openai-compatible"
  | "anthropic-compatible"
  | "gemini-native"
  | "local-self-hosted"
  | "aggregator-router";

interface ProviderCategoryConfig {
  value: CustomProviderCategory;
  label: string;
  badge: string;
  description: string;
  placeholderBaseUrl: string;
  defaultApi: "openai" | "anthropic";
  apiTypeDefault: string;
  keyHint: string;
  defaultHeaders?: Array<{ name: string; value: string }>;
}

export const PROVIDER_CATEGORIES: ProviderCategoryConfig[] = [
  {
    value: "openai-compatible",
    label: "OpenAI Compatible",
    badge: "vLLM / FastChat / OpenAI",
    description: "Standard OpenAI endpoint (/v1/chat/completions)",
    placeholderBaseUrl: "https://api.openai.com/v1",
    defaultApi: "openai",
    apiTypeDefault: "chat",
    keyHint: "Optional. Leave blank if your proxy has no auth.",
  },
  {
    value: "anthropic-compatible",
    label: "Anthropic Compatible",
    badge: "Claude Messages API",
    description: "Claude Messages protocol (/v1/messages)",
    placeholderBaseUrl: "https://api.anthropic.com/v1",
    defaultApi: "anthropic",
    apiTypeDefault: "chat",
    keyHint: "Anthropic API key or custom proxy key.",
  },
  {
    value: "gemini-native",
    label: "Google Gemini Native",
    badge: "Google AI Studio",
    description: "Google Gemini API (/v1beta/openai or /v1beta/models)",
    placeholderBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultApi: "openai",
    apiTypeDefault: "chat",
    keyHint: "Google AI Studio API key.",
  },
  {
    value: "local-self-hosted",
    label: "Local / Self-Hosted / Antseed",
    badge: "Antseed / Ollama / LM Studio",
    description: "Local P2P daemon or self-hosted models running without an API key (e.g. Antseed port 8377, Ollama)",
    placeholderBaseUrl: "http://127.0.0.1:8377/v1",
    defaultApi: "openai",
    apiTypeDefault: "chat",
    keyHint: "No API key required. Leave blank for Antseed / Ollama.",
  },
  {
    value: "aggregator-router",
    label: "Multi-Model Router / Aggregator",
    badge: "OpenRouter / LiteLLM",
    description: "OpenAI format with routing headers (HTTP-Referer, X-Title)",
    placeholderBaseUrl: "https://openrouter.ai/api/v1",
    defaultHeaders: [
      { name: "HTTP-Referer", value: "https://cheaproute.ai" },
      { name: "X-Title", value: "CheapRouter" },
    ],
    defaultApi: "openai",
    apiTypeDefault: "chat",
    keyHint: "Aggregator API key (e.g. OpenRouter, LiteLLM).",
  },
];

interface CustomProviderInlineFormProps {
  /** Upsert the freshly created node into the page's local node list. */
  onCreated: (node: { id: string } & Record<string, unknown>) => void;
  /** Optional connection callback so the page can refresh connections too. */
  onConnectionCreated?: () => void | Promise<void>;
}

let rowSeq = 0;
const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${rowSeq++}`;

const emptyModelRow = (id = "", name = ""): ModelRow => ({
  key: nextKey("model"),
  id,
  name: name || id,
  reasoning: /r1|reasoning|thinking|o1|o3/i.test(id),
  image: /vision|vl|image|omni/i.test(id),
});

const emptyHeaderRow = (name = "", value = ""): HeaderRow => ({
  key: nextKey("header"),
  name,
  value,
});

const API_TYPE_LABEL_KEYS: Record<string, string> = {
  chat: "apiTypeChat",
  responses: "apiTypeResponses",
  embeddings: "apiTypeEmbeddings",
  "audio-transcriptions": "apiTypeAudioTranscriptions",
  "audio-speech": "apiTypeAudioSpeech",
  "images-generations": "apiTypeImagesGenerations",
};

export function cleanCustomBaseUrl(raw: string): string {
  let val = raw.trim();
  val = val.replace(/\/chat\/completions$/i, "");
  val = val.replace(/\/completions$/i, "");
  val = val.replace(/\/models$/i, "");
  return val.replace(/\/+$/, "");
}

export default function CustomProviderInlineForm({
  onCreated,
  onConnectionCreated,
}: CustomProviderInlineFormProps) {
  const t = useTranslations("providers");

  const [expanded, setExpanded] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerCategory, setProviderCategory] =
    useState<CustomProviderCategory>("openai-compatible");
  const [apiType, setApiType] = useState("chat");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [iconUrl, setIconUrl] = useState("");
  const [showServerPorts, setShowServerPorts] = useState(false);

  // Models view mode: "rows" or "bulk"
  const [modelsViewMode, setModelsViewMode] = useState<"rows" | "bulk">("rows");
  const [bulkText, setBulkText] = useState("");

  // Testing & Model Fetching state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    latencyMs?: number;
    statusCode?: number;
    message?: string;
    rawResponse?: string | null;
  } | null>(null);

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchResult, setFetchResult] = useState<{
    count: number;
    probeUrl?: string | null;
    error?: string | null;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentCategoryConfig = useMemo(
    () =>
      PROVIDER_CATEGORIES.find((cat) => cat.value === providerCategory) ?? PROVIDER_CATEGORIES[0],
    [providerCategory]
  );

  const providerIdError = useMemo(() => {
    const value = providerId.trim();
    if (!value) return null;
    if (!/^[a-z0-9_-]+$/.test(value)) return t("customProviderIdInvalid");
    return null;
  }, [providerId, t]);

  const trimmedModels = useMemo(
    () => models.filter((row) => row.id.trim().length > 0),
    [models]
  );
  const trimmedHeaders = useMemo(
    () => headers.filter((row) => row.name.trim().length > 0),
    [headers]
  );

  const requiredMissing = !providerId.trim() || !displayName.trim() || !baseUrl.trim();
  const canSubmit = !requiredMissing && !providerIdError && !submitting;

  const handleCategoryChange = (newCat: CustomProviderCategory) => {
    setProviderCategory(newCat);
    const cfg = PROVIDER_CATEGORIES.find((c) => c.value === newCat);
    if (!cfg) return;

    // If Base URL was empty or previously a category placeholder, suggest the new default
    const currentBaseUrlTrimmed = baseUrl.trim();
    const wasDefault = PROVIDER_CATEGORIES.some(
      (c) => c.placeholderBaseUrl === currentBaseUrlTrimmed
    );
    if (!currentBaseUrlTrimmed || wasDefault) {
      setBaseUrl(cfg.placeholderBaseUrl);
    }

    // For aggregator-router, inject router headers if not already present
    if (newCat === "aggregator-router" && cfg.defaultHeaders) {
      setHeaders((prev) => {
        const next = [...prev];
        for (const dh of cfg.defaultHeaders || []) {
          if (!next.some((h) => h.name.toLowerCase() === dh.name.toLowerCase())) {
            next.push(emptyHeaderRow(dh.name, dh.value));
          }
        }
        return next;
      });
    }

    // Clear test results on category switch
    setTestResult(null);
    setFetchResult(null);
  };

  const resetForm = () => {
    setProviderId("");
    setDisplayName("");
    setProviderCategory("openai-compatible");
    setApiType("chat");
    setBaseUrl("");
    setApiKey("");
    setModels([]);
    setHeaders([]);
    setIconUrl("");
    setBulkText("");
    setTestResult(null);
    setFetchResult(null);
  };

  const patchModel = (key: string, patch: Partial<ModelRow>) =>
    setModels((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const patchHeader = (key: string, patch: Partial<HeaderRow>) =>
    setHeaders((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // Sync bulk text -> models
  const applyBulkText = (text: string) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    const unique = [...new Set(lines)];
    const existingMap = new Map(models.map((m) => [m.id, m]));
    const nextModels: ModelRow[] = unique.map((id) => {
      const existing = existingMap.get(id);
      return existing || emptyModelRow(id);
    });
    setModels(nextModels);
    setBulkText(text);
  };

  // ── Test Provider Connectivity ───────────────────────────────────────────
  const handleTestProvider = async () => {
    const sanitizedUrl = cleanCustomBaseUrl(baseUrl);
    if (!sanitizedUrl) return;

    setTesting(true);
    setTestResult(null);

    const headersObj: Record<string, string> = {};
    for (const h of trimmedHeaders) {
      headersObj[h.name.trim()] = h.value;
    }

    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: sanitizedUrl,
          apiKey: apiKey.trim() || undefined,
          type: providerCategory,
          customHeaders: Object.keys(headersObj).length > 0 ? headersObj : undefined,
          modelId: models[0]?.id?.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        setTestResult({
          valid: true,
          latencyMs: data.latencyMs,
          message:
            `✓ Connected successfully (${data.latencyMs ?? 0}ms)` +
            (data.totalModels ? ` — ${data.totalModels} models available` : ""),
        });

        // If models were discovered and current list is empty, auto-populate
        if (Array.isArray(data.models) && data.models.length > 0 && models.length === 0) {
          const autoRows = data.models.map((m: { id: string; name?: string }) =>
            emptyModelRow(m.id, m.name)
          );
          setModels(autoRows);
          setBulkText(autoRows.map((r: ModelRow) => r.id).join("\n"));
        }
      } else {
        setTestResult({
          valid: false,
          statusCode: data.statusCode || res.status,
          latencyMs: data.latencyMs,
          message: data.error || `HTTP ${data.statusCode || res.status} upstream error`,
          rawResponse: data.rawResponse || null,
        });
      }
    } catch {
      setTestResult({
        valid: false,
        message: "Network error connecting to endpoint",
      });
    } finally {
      setTesting(false);
    }
  };

  // ── Fetch Models ─────────────────────────────────────────────────────────
  const handleFetchModels = async () => {
    const sanitizedUrl = cleanCustomBaseUrl(baseUrl);
    if (!sanitizedUrl) return;

    setFetchingModels(true);
    setFetchResult(null);

    const headersObj: Record<string, string> = {};
    for (const h of trimmedHeaders) {
      headersObj[h.name.trim()] = h.value;
    }

    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: sanitizedUrl,
          apiKey: apiKey.trim() || undefined,
          type: providerCategory,
          customHeaders: Object.keys(headersObj).length > 0 ? headersObj : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid && Array.isArray(data.models) && data.models.length > 0) {
        const discoveredRows: ModelRow[] = data.models.map((m: { id: string; name?: string }) =>
          emptyModelRow(m.id, m.name)
        );
        setModels(discoveredRows);
        setBulkText(discoveredRows.map((r) => r.id).join("\n"));
        setFetchResult({
          count: discoveredRows.length,
          probeUrl: data.probeUrl,
        });
      } else {
        setFetchResult({
          count: 0,
          error: data.error || "No models returned by upstream endpoint",
        });
      }
    } catch {
      setFetchResult({
        count: 0,
        error: "Failed to fetch models: network error",
      });
    } finally {
      setFetchingModels(false);
    }
  };

  // ── Submit Provider ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const sanitizedBaseUrl = cleanCustomBaseUrl(baseUrl);
    const nodeType =
      providerCategory === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible";

    const nodeBody: Record<string, unknown> = {
      name: displayName.trim(),
      prefix: providerId.trim(),
      baseUrl: sanitizedBaseUrl,
      type: nodeType,
    };
    if (iconUrl.trim()) {
      nodeBody.iconUrl = iconUrl.trim();
    }
    if (nodeType === "openai-compatible") {
      nodeBody.apiType = apiType;
    }

    // Merge headers (auto-adding router headers if aggregator-router)
    const effectiveHeaders = [...trimmedHeaders];
    if (providerCategory === "aggregator-router") {
      if (!effectiveHeaders.some((h) => h.name.toLowerCase() === "http-referer")) {
        effectiveHeaders.push({
          key: nextKey("header"),
          name: "HTTP-Referer",
          value: "https://cheaproute.ai",
        });
      }
      if (!effectiveHeaders.some((h) => h.name.toLowerCase() === "x-title")) {
        effectiveHeaders.push({
          key: nextKey("header"),
          name: "X-Title",
          value: "CheapRouter",
        });
      }
    }

    if (effectiveHeaders.length > 0) {
      nodeBody.customHeaders = Object.fromEntries(
        effectiveHeaders.map((row) => [row.name.trim(), row.value])
      );
    }

    try {
      // ── 1. Create provider node ──────────────────────────────────────────
      const nodeRes = await fetch("/api/provider-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeBody),
      });
      if (!nodeRes.ok) {
        setError(await readFetchErrorMessage(nodeRes, t("failedCreate")));
        return;
      }
      const nodeData = await nodeRes.json().catch(() => ({}));
      const node = nodeData?.node;
      if (!node?.id) {
        setError(t("failedCreate"));
        return;
      }

      // ── 2. Create connection (works with or without API key) ───────────────
      const connectionPayload: Record<string, unknown> = {
        provider: node.id,
        name: displayName.trim() || node.name || node.id,
        priority: 1,
        testStatus: "unknown",
        providerSpecificData: {
          customCategory: providerCategory,
        },
      };
      if (apiKey.trim()) {
        connectionPayload.apiKey = apiKey.trim();
      } else {
        connectionPayload.allowNoCredential = true;
      }

      const connectionRes = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(connectionPayload),
      });
      if (!connectionRes.ok) {
        setError(await readFetchErrorMessage(connectionRes, t("failedCreateConnection")));
        onCreated(node);
        resetForm();
        return;
      }
      await onConnectionCreated?.();

      // ── 3. Create models (one per row) ───────────────────────────────────
      const failedModels: string[] = [];
      for (const row of trimmedModels) {
        const modelRes = await fetch("/api/provider-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: node.id,
            modelId: row.id.trim(),
            modelName: row.name.trim() || undefined,
            ...(row.reasoning ? { reasoning: true } : {}),
            ...(row.image ? { supportsVision: true } : {}),
          }),
        });
        if (!modelRes.ok) failedModels.push(row.id.trim());
      }

      onCreated(node);
      resetForm();

      if (failedModels.length > 0) {
        setError(
          t("customProviderModelsPartial", {
            count: failedModels.length,
            models: failedModels.join(", "),
          })
        );
        return;
      }

      setSuccess(t("customProviderAdded", { name: displayName.trim() }));
    } catch {
      setError(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-xl bg-surface overflow-hidden shadow-sm">
      {/* ── Collapsed trigger ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setExpanded((prev) => !prev);
          setError(null);
          setSuccess(null);
        }}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-subtle transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0">
            {expanded ? "expand_less" : "add_circle"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-main truncate">
              {t("customProviderTitle")}
            </span>
            <span className="block text-xs text-text-muted truncate">
              Add OpenAI, Anthropic, Gemini, Local (Ollama/LM Studio), or Multi-Model Routers
            </span>
          </span>
        </span>
        {!expanded && (
          <span className="text-xs text-primary font-medium shrink-0">
            {t("customProviderExpand")}
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pb-4 pt-2 border-t border-border">
          {/* ── Provider Type Dropdown (The 5 User-Requested Categories) ──── */}
          <div className="rounded-xl border border-white/10 bg-black/10 dark:bg-white/[0.03] p-3 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label
                htmlFor="cp-provider-category"
                className="text-xs font-semibold text-text-main flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">category</span>
                Provider Type / Architecture <span className="text-red-500">*</span>
              </label>
              <Badge variant="info" size="sm" className="w-fit">
                {currentCategoryConfig.badge}
              </Badge>
            </div>
            <Select
              id="cp-provider-category"
              value={providerCategory}
              onChange={(e) => handleCategoryChange(e.target.value as CustomProviderCategory)}
              className="font-medium"
            >
              {PROVIDER_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} ({cat.badge})
                </option>
              ))}
            </Select>
            <p className="text-[11px] text-text-muted">{currentCategoryConfig.description}</p>
          </div>

          {/* ── Identity ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cp-provider-id"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                {t("customProviderIdLabel")} <span className="text-red-500">*</span>
              </label>
              <Input
                id="cp-provider-id"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
                placeholder={t("customProviderIdPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[10px] text-text-muted mt-1">
                {providerIdError ?? t("customProviderIdHint")}
              </p>
            </div>
            <div>
              <label
                htmlFor="cp-display-name"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                {t("customProviderDisplayNameLabel")} <span className="text-red-500">*</span>
              </label>
              <Input
                id="cp-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("customProviderDisplayNamePlaceholder")}
                autoComplete="off"
              />
              <p className="text-[10px] text-text-muted mt-1">
                {t("customProviderDisplayNameHint")}
              </p>
            </div>
          </div>

          {/* ── Icon / Logo Picker ────────────────────────────────────────── */}
          <div className="pt-1">
            <ProviderImagePicker
              label="Provider Logo / Icon (Optional)"
              value={iconUrl}
              onChange={setIconUrl}
              hint="Select from 140+ storage assets or paste an image link (Google image, CDN, etc.)"
            />
          </div>

          {/* ── Base URL & Test Connection ───────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="cp-base-url"
                className="block text-xs font-medium text-text-muted"
              >
                {t("customProviderBaseUrlLabel")} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowServerPorts(true)}
                  title="Check available listening ports on server (Antseed, OpenCode, Antigravity, Ollama, etc.)"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">lan</span>
                  <span>Check Server Ports</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestProvider}
                  disabled={testing || !baseUrl.trim()}
                  title="Test connection to Base URL"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {testing ? "sync" : "sensors"}
                  </span>
                  <span>{testing ? "Testing..." : "Test Provider"}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  id="cp-base-url"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder={currentCategoryConfig.placeholderBaseUrl}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <p className="text-[10px] text-text-muted">
              Supports both HTTP & HTTPS. Trailing paths like /chat/completions or /models are
              auto-cleaned.
            </p>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={`mt-1 p-2 rounded-lg border text-xs flex flex-col gap-1 ${
                  testResult.valid
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-[15px]">
                    {testResult.valid ? "check_circle" : "error"}
                  </span>
                  <span>{testResult.message}</span>
                </div>
                {testResult.rawResponse && (
                  <pre className="mt-1 p-1.5 text-[10px] font-mono bg-black/40 rounded border border-white/5 overflow-x-auto max-h-24 whitespace-pre-wrap">
                    {testResult.rawResponse}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* ── API Key & API Type ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cp-api-key"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                {t("customProviderApiKeyLabel")}{" "}
                <span className="text-[10px] font-normal text-text-muted/70">(Optional)</span>
              </label>
              <Input
                id="cp-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={currentCategoryConfig.keyHint}
                autoComplete="off"
              />
              <p className="text-[10px] text-text-muted mt-1">{currentCategoryConfig.keyHint}</p>
            </div>

            {providerCategory !== "anthropic-compatible" && (
              <div>
                <label
                  htmlFor="cp-api-type"
                  className="block text-xs font-medium text-text-muted mb-1"
                >
                  {t("apiTypeLabel")}
                </label>
                <Select
                  id="cp-api-type"
                  value={apiType}
                  onChange={(event) => setApiType(event.target.value)}
                >
                  {Object.entries(API_TYPE_LABEL_KEYS).map(([value, labelKey]) => (
                    <option key={value} value={value}>
                      {t(labelKey)}
                    </option>
                  ))}
                </Select>
                <p className="text-[10px] text-text-muted mt-1">
                  API surface type for routing requests.
                </p>
              </div>
            )}
          </div>

          {/* ── Models Section (Fetch Models + Rows / Bulk Mode) ─────────── */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">token</span>
                  Models ({models.length})
                </span>
                {/* View Mode Toggle: Rows vs Bulk Textarea */}
                <div className="flex items-center rounded-lg bg-bg-subtle p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setModelsViewMode("rows")}
                    className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                      modelsViewMode === "rows"
                        ? "bg-surface text-text-main shadow-xs"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkText(models.map((m) => m.id).join("\n"));
                      setModelsViewMode("bulk");
                    }}
                    className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                      modelsViewMode === "bulk"
                        ? "bg-surface text-text-main shadow-xs"
                        : "text-text-muted hover:text-text-main"
                    }`}
                  >
                    Bulk Textarea
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={fetchingModels ? "sync" : "cloud_download"}
                  onClick={handleFetchModels}
                  disabled={fetchingModels || !baseUrl.trim()}
                  title="Query endpoint for available models"
                >
                  {fetchingModels ? "Fetching..." : "Fetch Models"}
                </Button>
                {modelsViewMode === "rows" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="add"
                    onClick={() => setModels((rows) => [...rows, emptyModelRow()])}
                  >
                    {t("customProviderAddModel")}
                  </Button>
                )}
              </div>
            </div>

            {/* Fetch feedback */}
            {fetchResult && (
              <div
                className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 ${
                  fetchResult.count > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {fetchResult.count > 0 ? "check_circle" : "error"}
                </span>
                <span>
                  {fetchResult.count > 0
                    ? `✓ Discovered ${fetchResult.count} models from ${
                        fetchResult.probeUrl || "upstream"
                      }`
                    : fetchResult.error}
                </span>
              </div>
            )}

            {/* Bulk Textarea Mode */}
            {modelsViewMode === "bulk" ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-text-muted">
                  Paste model IDs one per line. They will automatically be parsed into model rows.
                </p>
                <Textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => applyBulkText(e.target.value)}
                  placeholder={`llama3.2:latest\ndeepseek-r1:7b\ngpt-4o\nclaude-3-5-sonnet-20241022`}
                  className="font-mono text-xs bg-bg-subtle"
                />
              </div>
            ) : (
              /* Rows Mode */
              <>
                {models.length === 0 ? (
                  <p className="text-xs text-text-muted py-2">{t("customProviderModelsEmpty")}</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {models.map((row, index) => (
                      <div
                        key={row.key}
                        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] items-end gap-2 p-2 rounded-lg bg-bg-subtle border border-border"
                      >
                        <div>
                          {index === 0 && (
                            <label className="block text-[10px] text-text-muted mb-1">
                              {t("customProviderModelIdLabel")}
                            </label>
                          )}
                          <Input
                            aria-label={t("customProviderModelIdLabel")}
                            value={row.id}
                            onChange={(event) => patchModel(row.key, { id: event.target.value })}
                            placeholder={t("customProviderModelIdPlaceholder")}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <div>
                          {index === 0 && (
                            <label className="block text-[10px] text-text-muted mb-1">
                              {t("customProviderModelNameLabel")}
                            </label>
                          )}
                          <Input
                            aria-label={t("customProviderModelNameLabel")}
                            value={row.name}
                            onChange={(event) =>
                              patchModel(row.key, { name: event.target.value })
                            }
                            placeholder={t("customProviderModelNamePlaceholder")}
                            autoComplete="off"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.reasoning}
                            onChange={(event) =>
                              patchModel(row.key, { reasoning: event.target.checked })
                            }
                            className="rounded border-border"
                          />
                          {t("customProviderModelReasoning")}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.image}
                            onChange={(event) =>
                              patchModel(row.key, { image: event.target.checked })
                            }
                            className="rounded border-border"
                          />
                          {t("customProviderModelImage")}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setModels((rows) => rows.filter((item) => item.key !== row.key))
                          }
                          aria-label={t("remove")}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-bg-alt transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Headers Section ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">tune</span>
                {t("customProviderHeadersLabel")} ({headers.length})
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon="add"
                onClick={() => setHeaders((rows) => [...rows, emptyHeaderRow()])}
              >
                {t("customProviderAddHeader")}
              </Button>
            </div>

            {headers.length === 0 ? (
              <p className="text-xs text-text-muted">{t("customProviderHeadersEmpty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {headers.map((row, index) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] items-end gap-2 p-2 rounded-lg bg-bg-subtle border border-border"
                  >
                    <div>
                      {index === 0 && (
                        <label className="block text-[10px] text-text-muted mb-1">
                          {t("customProviderHeaderNameLabel")}
                        </label>
                      )}
                      <Input
                        aria-label={t("customProviderHeaderNameLabel")}
                        value={row.name}
                        onChange={(event) => patchHeader(row.key, { name: event.target.value })}
                        placeholder={t("customProviderHeaderNamePlaceholder")}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      {index === 0 && (
                        <label className="block text-[10px] text-text-muted mb-1">
                          {t("customProviderHeaderValueLabel")}
                        </label>
                      )}
                      <Input
                        aria-label={t("customProviderHeaderValueLabel")}
                        value={row.value}
                        onChange={(event) => patchHeader(row.key, { value: event.target.value })}
                        placeholder={t("customProviderHeaderValuePlaceholder")}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setHeaders((rows) => rows.filter((item) => item.key !== row.key))
                      }
                      aria-label={t("remove")}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-bg-alt transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Feedback + Actions ───────────────────────────────────────── */}
          {error && (
            <p className="text-xs text-red-500 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[14px] shrink-0 mt-px">error</span>
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-emerald-500 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[14px] shrink-0 mt-px">
                check_circle
              </span>
              {success}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setExpanded(false);
                resetForm();
                setError(null);
                setSuccess(null);
              }}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button size="sm" icon="add" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? t("adding") : t("customProviderSubmit")}
            </Button>
          </div>

          {requiredMissing && (
            <p className="text-[10px] text-text-muted text-right -mt-1">
              {t("customProviderRequiredHint")}
            </p>
          )}
        </div>
      )}

      {showServerPorts && (
        <ServerPortsSheet
          isOpen={showServerPorts}
          onClose={() => setShowServerPorts(false)}
          onSelectBaseUrl={(url) => setBaseUrl(url)}
        />
      )}
    </div>
  );
}
