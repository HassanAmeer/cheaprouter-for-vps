"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, Input, Select } from "@/shared/components";
import { readFetchErrorMessage } from "@/shared/utils/fetchError";

/** One repeatable model row — Kilo Code's "ID / Name / Reasoning / Image". */
type ModelRow = {
  key: string;
  id: string;
  name: string;
  reasoning: boolean;
  image: boolean;
};

/** One repeatable header row — Kilo Code's "Header / Value". */
type HeaderRow = {
  key: string;
  name: string;
  value: string;
};

type ProviderApi = "openai" | "anthropic";

interface CustomProviderInlineFormProps {
  /** Upsert the freshly created node into the page's local node list. */
  onCreated: (node: { id: string } & Record<string, unknown>) => void;
  /** Optional connection callback so the page can refresh connections too. */
  onConnectionCreated?: () => void | Promise<void>;
}

let rowSeq = 0;
const nextKey = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${rowSeq++}`;

const emptyModelRow = (): ModelRow => ({
  key: nextKey("model"),
  id: "",
  name: "",
  reasoning: false,
  image: false,
});

const emptyHeaderRow = (): HeaderRow => ({
  key: nextKey("header"),
  name: "",
  value: "",
});

const API_OPTIONS: Array<{ value: ProviderApi; labelKey: string }> = [
  { value: "openai", labelKey: "customProviderApiOpenai" },
  { value: "anthropic", labelKey: "customProviderApiAnthropic" },
];

const API_TYPE_LABEL_KEYS: Record<string, string> = {
  chat: "apiTypeChat",
  responses: "apiTypeResponses",
  embeddings: "apiTypeEmbeddings",
  "audio-transcriptions": "apiTypeAudioTranscriptions",
  "audio-speech": "apiTypeAudioSpeech",
  "images-generations": "apiTypeImagesGenerations",
};

/**
 * Kilo-Code-style custom provider form, inline on the providers page.
 *
 * Deliberately NOT a modal and NOT a wizard: the box expands in place, one
 * screenful of fields, and saving keeps you here (no router.push) so several
 * providers can be added back to back. Only Provider ID, Display name and
 * Base URL are required — everything else matches the optional fields the
 * upstream API already accepts.
 *
 * Save is three sequential calls sharing the new node id:
 *   1. POST /api/provider-nodes            -> node (id is server-generated)
 *   2. POST /api/providers                 -> connection, only when a key is given
 *   3. POST /api/provider-models           -> one call per model row
 */
export default function CustomProviderInlineForm({
  onCreated,
  onConnectionCreated,
}: CustomProviderInlineFormProps) {
  const t = useTranslations("providers");

  const [expanded, setExpanded] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerApi, setProviderApi] = useState<ProviderApi>("openai");
  const [apiType, setApiType] = useState("chat");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [headers, setHeaders] = useState<HeaderRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const resetForm = () => {
    setProviderId("");
    setDisplayName("");
    setProviderApi("openai");
    setApiType("chat");
    setBaseUrl("");
    setApiKey("");
    setModels([]);
    setHeaders([]);
  };

  const patchModel = (key: string, patch: Partial<ModelRow>) =>
    setModels((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const patchHeader = (key: string, patch: Partial<HeaderRow>) =>
    setHeaders((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const nodeBody: Record<string, unknown> = {
      name: displayName.trim(),
      prefix: providerId.trim(),
      baseUrl: baseUrl.trim(),
      type: providerApi === "anthropic" ? "anthropic-compatible" : "openai-compatible",
    };
    if (providerApi === "openai") nodeBody.apiType = apiType;

    // Headers go on the node itself (`customHeaders`) — that is the field the
    // provider executor merges into every upstream request.
    if (trimmedHeaders.length > 0) {
      nodeBody.customHeaders = Object.fromEntries(
        trimmedHeaders.map((row) => [row.name.trim(), row.value])
      );
    }

    try {
      // ── 1. node ────────────────────────────────────────────────────────
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

      // ── 2. connection (only when a key was supplied) ────────────────────
      if (apiKey.trim()) {
        const connectionRes = await fetch("/api/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: node.id,
            name: displayName.trim(),
            apiKey: apiKey.trim(),
            priority: 1,
            testStatus: "unknown",
          }),
        });
        // A failed credential write must not lose the node we just created —
        // report it and keep going so the user can retry from the detail page.
        if (!connectionRes.ok) {
          setError(await readFetchErrorMessage(connectionRes, t("failedCreateConnection")));
          onCreated(node);
          resetForm();
          return;
        }
        await onConnectionCreated?.();
      }

      // ── 3. models (one request per row) ─────────────────────────────────
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
        // Node + any other models landed; only report the partial failure.
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
    <div className="border border-border rounded-xl bg-surface overflow-hidden">
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
          <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
            {expanded ? "expand_less" : "add_circle"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-text-main truncate">
              {t("customProviderTitle")}
            </span>
            <span className="block text-xs text-text-muted truncate">
              {t("customProviderSubtitle")}
            </span>
          </span>
        </span>
        {!expanded && (
          <span className="text-xs text-primary shrink-0">{t("customProviderExpand")}</span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-5 px-4 pb-4 pt-1 border-t border-border">
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

          {/* ── API + base URL ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cp-provider-api"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                {t("customProviderApiLabel")} <span className="text-red-500">*</span>
              </label>
              <Select
                id="cp-provider-api"
                value={providerApi}
                onChange={(event) => setProviderApi(event.target.value as ProviderApi)}
              >
                {API_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="cp-base-url"
                className="block text-xs font-medium text-text-muted mb-1"
              >
                {t("customProviderBaseUrlLabel")} <span className="text-red-500">*</span>
              </label>
              <Input
                id="cp-base-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder={t("customProviderBaseUrlPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* OpenAI-compatible only: the API surface of the base URL. */}
          {providerApi === "openai" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              </div>
              <div>
                <label
                  htmlFor="cp-api-key"
                  className="block text-xs font-medium text-text-muted mb-1"
                >
                  {t("customProviderApiKeyLabel")}
                </label>
                <Input
                  id="cp-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={t("customProviderApiKeyPlaceholder")}
                  autoComplete="off"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  {t("customProviderApiKeyHint")}
                </p>
              </div>
            </div>
          )}

          {/* ── Models ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-main">
                {t("customProviderModelsLabel")}
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon="add"
                onClick={() => setModels((rows) => [...rows, emptyModelRow()])}
              >
                {t("customProviderAddModel")}
              </Button>
            </div>

            {models.length === 0 ? (
              <p className="text-xs text-text-muted">{t("customProviderModelsEmpty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
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
          </div>

          {/* ── Headers ──────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-text-main">
                {t("customProviderHeadersLabel")}
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
                        onChange={(event) =>
                          patchHeader(row.key, { name: event.target.value })
                        }
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
                        onChange={(event) =>
                          patchHeader(row.key, { value: event.target.value })
                        }
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

          {/* ── Feedback + actions ───────────────────────────────────────── */}
          {error && (
            <p className="text-xs text-red-500 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[14px] shrink-0 mt-px">
                error
              </span>
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

          <div className="flex items-center justify-end gap-2 pt-1">
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
            <p className="text-[10px] text-text-muted text-right -mt-2">
              {t("customProviderRequiredHint")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
