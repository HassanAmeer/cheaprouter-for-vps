"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Checkbox, Input, Badge, Loading } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useTranslations } from "next-intl";
import { getProviderById } from "@/shared/constants/providers";

type SyncedModel = {
  id: string;
  name?: string;
  contextWindow?: number;
  supportsThinking?: boolean;
  supportsTools?: boolean;
  supportsVideo?: boolean;
  supportsVision?: boolean;
  supportsAudio?: boolean;
};

type Customization = {
  id: number;
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
  createdAt: string;
  updatedAt: string;
};

type CurationData = {
  success: boolean;
  customizations: Customization[];
  connections: Array<{ provider: string; testStatus?: string | null; id?: number | string }>;
  modelsByProvider: Record<string, SyncedModel[]>;
  connectedProviderIds: string[];
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ManageModelsPage() {
  const t = useTranslations("modelCatalog");
  const [data, setData] = useState<CurationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetcher("/api/v1/models/curation")
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-6">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-6">
        <p className="p-4 text-sm text-red-400">{error}</p>
      </Card>
    );
  }

  const providers = (data?.connectedProviderIds ?? []).sort();
  const customMap = new Map<string, Customization>();
  for (const c of data?.customizations ?? []) {
    customMap.set(`${c.providerId}/${c.originalModelId}`, c);
  }

  async function saveCustomization(c: Partial<Customization> & { providerId: string; originalModelId: string }) {
    await fetch("/api/v1/models/curation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", ...c }),
    });
    mutate();
  }

  async function runLiveTest(providerId: string, modelId: string) {
    const res = await fetch("/api/v1/models/curation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "liveTest", providerId, modelId }),
    });
    const result = await res.json();
    mutate();
    return result;
  }

  function mutate() {
    load();
  }

  function toggleActive(providerId: string, modelId: string, active: boolean) {
    saveCustomization({ providerId, originalModelId: modelId, isActive: active });
  }

  function updateAlias(providerId: string, modelId: string, customAlias: string) {
    saveCustomization({ providerId, originalModelId: modelId, customAlias });
  }

  function updateName(providerId: string, modelId: string, customName: string) {
    saveCustomization({ providerId, originalModelId: modelId, customName });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-main">{t("manageModels")}</h1>
        <p className="text-sm text-text-muted mt-1">{t("manageModelsDesc")}</p>
      </div>

      {providers.length === 0 ? (
        <Card className="p-8 text-center">
          <span className="material-symbols-outlined text-[40px] text-text-muted/30 mb-3 block">
            dns
          </span>
          <p className="text-text-muted">{t("noConnectedProviders")}</p>
        </Card>
      ) : (
        providers.map((providerId) => {
          const meta = getProviderById(providerId);
          const models = (data?.modelsByProvider?.[providerId] ?? []).sort((a, b) =>
            (a.id || "").localeCompare(b.id || "")
          );
          return (
            <ProviderModelCard
              key={providerId}
              providerId={providerId}
              providerName={meta?.name ?? providerId}
              models={models}
              customMap={customMap}
              isTested={(providerId, modelId) =>
                customMap.get(`${providerId}/${modelId}`)?.isTested ?? false
              }
              onToggleActive={toggleActive}
              onUpdateAlias={updateAlias}
              onUpdateName={updateName}
              onLiveTest={runLiveTest}
            />
          );
        })
      )}
    </div>
  );
}

function ProviderModelCard({
  providerId,
  providerName,
  models,
  customMap,
  isTested,
  onToggleActive,
  onUpdateAlias,
  onUpdateName,
  onLiveTest,
}: {
  providerId: string;
  providerName: string;
  models: SyncedModel[];
  customMap: Map<string, Customization>;
  isTested: (providerId: string, modelId: string) => boolean;
  onToggleActive: (providerId: string, modelId: string, active: boolean) => void;
  onUpdateAlias: (providerId: string, modelId: string, alias: string) => void;
  onUpdateName: (providerId: string, modelId: string, name: string) => void;
  onLiveTest: (providerId: string, modelId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-4">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <ProviderIcon providerId={providerId} size={28} />
          <div>
            <span className="font-medium text-text-main">{providerName}</span>
            <span className="text-xs text-text-muted/60"> ({providerId})</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-[16px] text-text-muted/40">
          {open ? "expand_more" : "chevron_right"}
        </span>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 space-y-2">
          {models.map((model) => {
            const cust = customMap.get(`${providerId}/${model.id}`);
            const active = cust?.isActive ?? false;
            return (
              <ModelRow
                key={model.id}
                providerId={providerId}
                model={model}
                customization={cust}
                active={active}
                isTested={isTested(providerId, model.id)}
                onToggleActive={onToggleActive}
                onUpdateAlias={onUpdateAlias}
                onUpdateName={onUpdateName}
                onLiveTest={onLiveTest}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ModelRow({
  providerId,
  model,
  customization,
  active,
  isTested,
  onToggleActive,
  onUpdateAlias,
  onUpdateName,
  onLiveTest,
}: {
  providerId: string;
  model: SyncedModel;
  customization?: Customization;
  active: boolean;
  isTested: boolean;
  onToggleActive: (providerId: string, modelId: string, active: boolean) => void;
  onUpdateAlias: (providerId: string, modelId: string, alias: string) => void;
  onUpdateName: (providerId: string, modelId: string, name: string) => void;
  onLiveTest: (providerId: string, modelId: string) => Promise<unknown>;
}) {
  const [customName, setCustomName] = useState(customization?.customName ?? "");
  const [customAlias, setCustomAlias] = useState(customization?.customAlias ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onLiveTest(providerId, model.id);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/30 bg-surface-hover/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox
            checked={active}
            onChange={(e) => onToggleActive(providerId, model.id, e.target.checked)}
            disabled={testing}
          />
          <span className="font-mono text-sm text-text-main truncate">{model.id}</span>
          {model.name && model.name !== model.id && (
            <span className="text-xs text-text-muted/60 truncate">{model.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="text-xs px-2.5 py-1 rounded border border-border/50 hover:bg-surface/50 disabled:opacity-50 flex items-center gap-1"
          title="Test upstream"
        >
          {testing ? (
            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
          ) : isTested ? (
            <span className="material-symbols-outlined text-[14px] text-green-400">
              check_circle
            </span>
          ) : (
            <span className="material-symbols-outlined text-[14px]">play_arrow</span>
          )}
          <span>{testing ? "Testing…" : "Test"}</span>
        </button>
      </div>

      {/* Capability badges */}
      <CapabilityBadges model={model} customization={customization} />

      {/* Editable alias + name (shown when active) */}
      {active && (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Custom display name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={() => onUpdateName(providerId, model.id, customName)}
            />
          </div>
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Custom API call ID (alias)"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              onBlur={() => onUpdateAlias(providerId, model.id, customAlias)}
            />
          </div>
        </div>
      )}

      {/* Live test result */}
      {testResult && (
        <div className="mt-1 text-xs">
          {testResult.status === "ok" ? (
            <div className="flex items-center gap-2 text-green-400">
              <span>✓ Verified</span>
              <span className="text-text-muted/60">
                {testResult.latencyMs ? `${testResult.latencyMs}ms` : ""}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <span>✗ {testResult.error || testResult.status}</span>
              {testResult.httpStatus && <span>{testResult.httpStatus}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CapabilityBadges({
  model,
  customization,
}: {
  model: SyncedModel;
  customization?: Customization;
}) {
  const caps: { label: string; on: boolean }[] = [];
  const knownCaps = new Set(customization?.capabilities ?? []);

  if (model.contextWindow) {
    caps.push({ label: `${formatTokens(model.contextWindow)} ctx`, on: true });
  }
  caps.push({ label: "Thinking", on: model.supportsThinking ?? knownCaps.has("reasoning") });
  caps.push({ label: "Vision", on: model.supportsVision ?? model.supportsVideo ?? knownCaps.has("vision") });
  caps.push({ label: "Audio", on: model.supportsAudio ?? knownCaps.has("audio") });
  caps.push({ label: "Code", on: knownCaps.has("code") });
  caps.push({ label: "Tools", on: model.supportsTools ?? knownCaps.has("function_calling") });

  return (
    <div className="flex flex-wrap gap-1.5">
      {caps.filter((c) => c.on).map((c) => (
        <Badge key={c.label} className="text-[10px] bg-surface-hover/50 text-text-muted/70">
          {c.label}
        </Badge>
      ))}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
