"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge, Button, Input, Modal, Select, Toggle, ProviderImagePicker } from "@/shared/components";
import { readFetchErrorMessage } from "@/shared/utils/fetchError";
import { isValidProviderIconUrl } from "@/shared/validation/iconUrl";
import {
  CLIENT_IDENTITY_PROFILE_OPTIONS,
  getClientIdentityProfileHeaders,
} from "@/shared/constants/clientIdentityProfiles";
import NewApiAggregatorFields from "../[id]/components/modals/NewApiAggregatorFields";
import { providerText } from "../[id]/providerPageHelpers";
import ServerPortsSheet from "./ServerPortsSheet";

type CompatibleMode = "openai" | "anthropic" | "cc";
type CompatibleProviderNode = { id: string } & Record<string, unknown>;

interface AddCompatibleProviderModalProps {
  isOpen: boolean;
  mode: CompatibleMode;
  title?: string;
  initialNode?: CompatibleProviderNode | null;
  onClose: () => void;
  onCreated: (node: CompatibleProviderNode) => void;
  onUpdated?: (node: CompatibleProviderNode) => void;
}

interface CompatibleFormState {
  name: string;
  prefix: string;
  apiType: string;
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  iconUrl: string;
  clientIdentityProfile: string;
  newApiAggregatorBalance: boolean;
  consoleApiKey: string;
  newApiUserId: string;
  quotaPerUnit: string;
}

const CC_DEFAULT_CHAT_PATH = "/v1/messages?beta=true";

const MODE_DEFAULTS: Record<
  CompatibleMode,
  {
    baseUrl: string;
    type: "openai-compatible" | "anthropic-compatible";
    compatMode?: "cc";
    chatPath: string;
    hasApiType: boolean;
    hasModelsPath: boolean;
    hasWarning: boolean;
  }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    type: "openai-compatible",
    chatPath: "",
    hasApiType: true,
    hasModelsPath: true,
    hasWarning: false,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    type: "anthropic-compatible",
    chatPath: "",
    hasApiType: false,
    hasModelsPath: true,
    hasWarning: false,
  },
  cc: {
    baseUrl: "",
    type: "anthropic-compatible",
    compatMode: "cc",
    chatPath: CC_DEFAULT_CHAT_PATH,
    hasApiType: false,
    hasModelsPath: false,
    hasWarning: true,
  },
};

function createInitialForm(
  mode: CompatibleMode,
  initialNode?: CompatibleProviderNode | null
): CompatibleFormState {
  const defaults = MODE_DEFAULTS[mode];
  if (initialNode) {
    const pData = (initialNode.providerSpecificData || {}) as Record<string, unknown>;
    return {
      name: String(initialNode.name || ""),
      prefix: String(initialNode.prefix || ""),
      apiType: String(initialNode.apiType || "chat"),
      baseUrl: String(initialNode.baseUrl || defaults.baseUrl),
      chatPath: String(initialNode.chatPath || defaults.chatPath),
      modelsPath: String(initialNode.modelsPath || ""),
      iconUrl: String(initialNode.iconUrl || ""),
      clientIdentityProfile: "default",
      newApiAggregatorBalance: Boolean(pData.newApiAggregatorBalance),
      consoleApiKey: String(pData.consoleApiKey || ""),
      newApiUserId: String(pData.newApiUserId || ""),
      quotaPerUnit: pData.quotaPerUnit ? String(pData.quotaPerUnit) : "",
    };
  }
  return {
    name: "",
    prefix: "",
    apiType: "chat",
    baseUrl: defaults.baseUrl,
    chatPath: defaults.chatPath,
    modelsPath: "",
    iconUrl: "",
    clientIdentityProfile: "default",
    newApiAggregatorBalance: false,
    consoleApiKey: "",
    newApiUserId: "",
    quotaPerUnit: "",
  };
}

export default function AddCompatibleProviderModal({
  isOpen,
  mode,
  title,
  initialNode,
  onClose,
  onCreated,
  onUpdated,
}: AddCompatibleProviderModalProps) {
  const t = useTranslations("providers");
  const defaults = MODE_DEFAULTS[mode];
  const [formData, setFormData] = useState<CompatibleFormState>(() =>
    createInitialForm(mode, initialNode)
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkKey, setCheckKey] = useState("");
  const [checkModelId, setCheckModelId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<null | {
    valid: boolean;
    error?: string | null;
    method?: string | null;
    models?: Array<{ id: string; name?: string }>;
    totalModels?: number;
    probeUrl?: string | null;
  }>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [iconUrlError, setIconUrlError] = useState<string | null>(null);
  const [showServerPorts, setShowServerPorts] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const apiTypeOptions = useMemo(
    () => [
      { value: "chat", label: t("chatCompletions") },
      { value: "responses", label: t("responsesApi") },
      { value: "embeddings", label: t("embeddings") },
      { value: "audio-transcriptions", label: t("audioTranscriptions") },
      { value: "audio-speech", label: t("audioSpeech") },
      { value: "images-generations", label: t("imagesGenerations") },
    ],
    [t]
  );

  const [initializedFor, setInitializedFor] = useState<{
    mode: CompatibleMode;
    nodeId?: string;
  } | null>(null);
  if (isOpen) {
    const currentKey = initialNode?.id || mode;
    const prevKey = initializedFor?.nodeId || initializedFor?.mode;
    if (prevKey !== currentKey) {
      setInitializedFor({ mode, nodeId: initialNode?.id });
      setFormData(createInitialForm(mode, initialNode));
      setValidationResult(null);
      setCheckKey("");
      setShowAdvanced(Boolean(initialNode?.chatPath || initialNode?.modelsPath));
      setSaveError(null);
      setIconUrlError(null);
    }
  } else if (initializedFor !== null) {
    setInitializedFor(null);
  }

  const modalTitle =
    title ||
    (initialNode
      ? `Edit Provider: ${initialNode.name || initialNode.prefix}`
      : mode === "openai"
        ? t("addOpenAICompatible")
        : mode === "anthropic"
          ? t("addAnthropicCompatible")
          : t("addCcCompatible"));

  const namePlaceholder =
    mode === "cc"
      ? t("ccCompatibleNamePlaceholder")
      : t("compatibleProdPlaceholder", {
          type: mode === "openai" ? t("openai") : t("anthropic"),
        });
  const nameHint = mode === "cc" ? t("ccCompatibleNameHint") : t("nameHint");
  const prefixPlaceholder =
    mode === "openai"
      ? t("openaiPrefixPlaceholder")
      : mode === "cc"
        ? t("ccCompatiblePrefixPlaceholder")
        : t("anthropicPrefixPlaceholder");
  const prefixHint = mode === "cc" ? t("ccCompatiblePrefixHint") : t("prefixHint");
  const baseUrlPlaceholder =
    mode === "openai"
      ? t("openaiBaseUrlPlaceholder")
      : mode === "cc"
        ? t("ccCompatibleBaseUrlPlaceholder")
        : t("anthropicBaseUrlPlaceholder");
  const baseUrlHint =
    mode === "cc"
      ? t("ccCompatibleBaseUrlHint")
      : t("compatibleBaseUrlHint", {
          type: mode === "openai" ? t("openai") : t("anthropic"),
        });
  const chatPathPlaceholder =
    mode === "openai" ? "/v1/chat/completions" : mode === "cc" ? CC_DEFAULT_CHAT_PATH : "/messages";
  const chatPathHint = mode === "cc" ? t("ccCompatibleChatPathHint") : t("chatPathHint");
  const advancedId = `advanced-settings-${mode}`;
  const hasRequiredFields = Boolean(
    formData.name.trim() && formData.prefix.trim() && formData.baseUrl.trim()
  );
  const canValidate = Boolean(formData.baseUrl.trim());

  const resetAfterCreate = () => {
    setFormData(createInitialForm(mode));
    setCheckKey("");
    setValidationResult(null);
    setShowAdvanced(false);
    setSaveError(null);
    setIconUrlError(null);
  };

  const handleSubmit = async () => {
    if (!hasRequiredFields) return;
    const iconUrl = formData.iconUrl.trim();
    if (!isValidProviderIconUrl(iconUrl)) {
      setIconUrlError(t("iconUrlInvalid"));
      return;
    }
    setIconUrlError(null);
    setSaveError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        prefix: formData.prefix,
        baseUrl: formData.baseUrl,
        type: defaults.type,
        chatPath: formData.chatPath || (mode === "cc" ? CC_DEFAULT_CHAT_PATH : ""),
      };
      if (defaults.hasApiType) body.apiType = formData.apiType;
      if (defaults.hasModelsPath) body.modelsPath = formData.modelsPath || "";
      if (defaults.compatMode) body.compatMode = defaults.compatMode;
      body.iconUrl = formData.iconUrl.trim();
      // Merge the selected identity profile's preset headers into the SAME
      // `customHeaders` field the node already persists
      const identityHeaders = getClientIdentityProfileHeaders(formData.clientIdentityProfile);
      if (Object.keys(identityHeaders).length > 0) body.customHeaders = identityHeaders;

      // Aggregator gateway fields (#9415)
      if (formData.newApiAggregatorBalance) {
        body.providerSpecificData = {
          ...(body.providerSpecificData as Record<string, unknown> | undefined),
          newApiAggregatorBalance: true,
        };
        if (formData.consoleApiKey.trim()) {
          (body.providerSpecificData as Record<string, unknown>).consoleApiKey =
            formData.consoleApiKey.trim();
        }
        if (formData.newApiUserId.trim()) {
          (body.providerSpecificData as Record<string, unknown>).newApiUserId =
            formData.newApiUserId.trim();
        }
        const parsedQuotaPerUnit = parseInt(formData.quotaPerUnit, 10);
        if (Number.isFinite(parsedQuotaPerUnit) && parsedQuotaPerUnit > 0) {
          (body.providerSpecificData as Record<string, unknown>).quotaPerUnit = parsedQuotaPerUnit;
        }
      }

      const url = initialNode?.id
        ? `/api/provider-nodes/${encodeURIComponent(initialNode.id)}`
        : "/api/provider-nodes";
      const method = initialNode?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const failedMsg = initialNode
        ? "Failed to update provider"
        : providerText(t, "failedCreate", "Failed to create provider");
      if (!res.ok) {
        setSaveError(await readFetchErrorMessage(res, failedMsg));
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.node) {
        if (initialNode && onUpdated) {
          onUpdated(data.node);
        } else {
          onCreated(data.node);
        }
        resetAfterCreate();
        return;
      }
      setSaveError(failedMsg);
    } catch {
      setSaveError(providerText(t, "networkError", "Network error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const body: Record<string, unknown> = {
        baseUrl: formData.baseUrl,
        apiKey: checkKey,
        type: defaults.type,
      };
      if (defaults.hasApiType) body.apiType = formData.apiType;
      if (defaults.hasModelsPath) body.modelsPath = formData.modelsPath || "";
      if (defaults.compatMode) {
        body.compatMode = defaults.compatMode;
        body.chatPath = formData.chatPath || CC_DEFAULT_CHAT_PATH;
      }
      const trimmedModelId = checkModelId.trim();
      if (trimmedModelId) body.modelId = trimmedModelId;

      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setValidationResult({
        valid: !!data.valid,
        error: data.error ?? null,
        method: data.method ?? null,
        models: Array.isArray(data.models) ? data.models : [],
        totalModels:
          typeof data.totalModels === "number" ? data.totalModels : (data.models?.length || 0),
        probeUrl: data.probeUrl ?? null,
      });
    } catch {
      setValidationResult({
        valid: false,
        error: providerText(t, "networkError", "Network error"),
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <>
      <Modal variant="sheet" isOpen={isOpen} title={modalTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {defaults.hasWarning && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-text-muted">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-[18px] text-amber-500">
                warning
              </span>
              <p>{t("ccCompatibleValidationHint")}</p>
            </div>
          </div>
        )}

        <Input
          label={t("nameLabel")}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={namePlaceholder}
          hint={nameHint}
        />
        <Input
          label={t("prefixLabel")}
          value={formData.prefix}
          onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
          placeholder={prefixPlaceholder}
          hint={prefixHint}
        />
        {defaults.hasApiType && (
          <Select
            label={t("apiTypeLabel")}
            options={apiTypeOptions}
            value={formData.apiType}
            onChange={(e) => setFormData({ ...formData, apiType: e.target.value })}
          />
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">{t("baseUrlLabel")}</span>
            <button
              type="button"
              onClick={() => setShowServerPorts(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
            >
              <span className="material-symbols-outlined text-[13px]">lan</span>
              <span>Check Server Ports</span>
            </button>
          </div>
          <Input
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder={baseUrlPlaceholder}
            hint={baseUrlHint}
          />
        </div>
        <ProviderImagePicker
          label={t("iconUrlLabel")}
          value={formData.iconUrl}
          onChange={(val) => setFormData({ ...formData, iconUrl: val })}
          hint={iconUrlError ?? t("iconUrlHint")}
        />

        <Toggle
          label={t("newApiAggregatorToggleLabel")}
          description={t("newApiAggregatorToggleHint")}
          checked={formData.newApiAggregatorBalance}
          onChange={(checked: boolean) =>
            setFormData({ ...formData, newApiAggregatorBalance: checked })
          }
        />
        <NewApiAggregatorFields
          enabled={formData.newApiAggregatorBalance}
          values={{
            consoleApiKey: formData.consoleApiKey,
            newApiUserId: formData.newApiUserId,
            quotaPerUnit: formData.quotaPerUnit,
          }}
          onChange={(patch) => setFormData({ ...formData, ...patch })}
          t={t}
        />

        <button
          type="button"
          className="text-sm text-text-muted hover:text-text-primary flex items-center gap-1"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          aria-controls={advancedId}
        >
          <span
            className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            {">"}
          </span>
          {t("advancedSettings")}
        </button>
        {showAdvanced && (
          <div id={advancedId} className="flex flex-col gap-3 pl-2 border-l-2 border-border">
            <Input
              label={t("chatPathLabel")}
              value={formData.chatPath}
              onChange={(e) => setFormData({ ...formData, chatPath: e.target.value })}
              placeholder={chatPathPlaceholder}
              hint={chatPathHint}
            />
            {defaults.hasModelsPath && (
              <Input
                label={t("modelsPathLabel")}
                value={formData.modelsPath}
                onChange={(e) => setFormData({ ...formData, modelsPath: e.target.value })}
                placeholder={t("modelsPathPlaceholder")}
                hint={t("modelsPathHint")}
              />
            )}
            <Select
              label={t("clientIdentityLabel")}
              options={CLIENT_IDENTITY_PROFILE_OPTIONS.map((option) => ({ ...option }))}
              value={formData.clientIdentityProfile}
              onChange={(e) => setFormData({ ...formData, clientIdentityProfile: e.target.value })}
              hint={t("clientIdentityHint")}
            />
          </div>
        )}

        <div className="flex gap-2">
          <Input
            label={t("apiKeyForCheck")}
            type="password"
            value={checkKey}
            onChange={(e) => setCheckKey(e.target.value)}
            className="flex-1"
          />
          <div className="pt-6">
            <Button
              onClick={handleValidate}
              disabled={!canValidate || validating}
              variant="secondary"
            >
              {validating ? t("checking") : "Check & Fetch Models"}
            </Button>
          </div>
        </div>
        <Input
          label={t("testModelIdLabel")}
          value={checkModelId}
          onChange={(e) => setCheckModelId(e.target.value)}
          placeholder={t("testModelIdPlaceholder")}
          hint={t("testModelIdHint")}
        />
        {validationResult && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={validationResult.valid ? "success" : "error"}>
                {validationResult.valid
                  ? validationResult.totalModels
                    ? `✓ Valid (${validationResult.totalModels} models found)`
                    : t("valid")
                  : t("invalid")}
              </Badge>
              {validationResult.probeUrl && (
                <span className="text-[11px] text-text-muted truncate max-w-[280px]">
                  {validationResult.probeUrl}
                </span>
              )}
            </div>
            {validationResult.error && (
              <span className="text-sm text-red-500">
                {validationResult.error}
              </span>
            )}
            {validationResult.valid && Array.isArray(validationResult.models) && validationResult.models.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-xs text-text-muted font-medium">
                  Discovered Models Preview ({validationResult.models.length}):
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={validationResult.models.map((m: any) => m.id).join("\n")}
                  className="w-full text-xs font-mono bg-black/60 border border-white/10 rounded-lg p-2.5 text-white/90 resize-none focus:outline-none"
                  placeholder="Discovered models list..."
                />
              </div>
            )}
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            aria-live="assertive"
            className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            {saveError}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSubmit} fullWidth disabled={!hasRequiredFields || submitting}>
            {submitting
              ? initialNode
                ? "Saving..."
                : t("creating")
              : initialNode
                ? "Save Changes"
                : t("add")}
          </Button>
          <Button onClick={onClose} variant="ghost" fullWidth>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Modal>
    {showServerPorts && (
      <ServerPortsSheet
        isOpen={showServerPorts}
        onClose={() => setShowServerPorts(false)}
        onSelectBaseUrl={(url) => setFormData((prev) => ({ ...prev, baseUrl: url }))}
      />
    )}
  </>
  );
}
