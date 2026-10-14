"use client";

import React, { useState } from "react";
import { Button, Input, Select } from "@/shared/components";
import { isValidProviderIconUrl } from "@/shared/validation/iconUrl";
import {
  CLIENT_IDENTITY_PROFILE_OPTIONS,
  getClientIdentityProfileHeaders,
} from "@/shared/constants/clientIdentityProfiles";

interface EditCustomProviderSheetProps {
  isOpen: boolean;
  providerNode: any;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onSyncModels: () => Promise<void>;
  isSyncingModels: boolean;
  notify: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export default function EditCustomProviderSheet(props: EditCustomProviderSheetProps) {
  if (!props.isOpen || !props.providerNode) return null;
  return <EditCustomProviderSheetContent key={props.providerNode.id} {...props} />;
}

function EditCustomProviderSheetContent({
  providerNode,
  onClose,
  onUpdated,
  onSyncModels,
  isSyncingModels,
  notify,
}: EditCustomProviderSheetProps) {
  const [name, setName] = useState(String(providerNode.name || ""));
  const [prefix, setPrefix] = useState(String(providerNode.prefix || ""));
  const [apiType, setApiType] = useState(String(providerNode.apiType || "chat"));
  const [baseUrl, setBaseUrl] = useState(String(providerNode.baseUrl || ""));
  const [chatPath, setChatPath] = useState(String(providerNode.chatPath || ""));
  const [modelsPath, setModelsPath] = useState(String(providerNode.modelsPath || ""));
  const [iconUrl, setIconUrl] = useState(String(providerNode.iconUrl || ""));
  const [clientIdentityProfile, setClientIdentityProfile] = useState("default");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(providerNode.chatPath || providerNode.modelsPath)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Test & Probe models state
  const [probingModels, setProbingModels] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    valid: boolean;
    models: Array<{ id: string; name?: string }>;
    error?: string | null;
    totalModels?: number;
    probeUrl?: string | null;
  } | null>(null);

  const apiTypeOptions = [
    { value: "chat", label: "Chat Completions (/v1/chat/completions)" },
    { value: "responses", label: "Responses API" },
    { value: "embeddings", label: "Embeddings (/v1/embeddings)" },
    { value: "audio-transcriptions", label: "Audio Transcriptions" },
    { value: "audio-speech", label: "Audio Speech" },
    { value: "images-generations", label: "Images Generations" },
  ];

  const handleProbeModels = async () => {
    if (!baseUrl.trim()) {
      setErrorMsg("Please enter a valid Base URL first.");
      return;
    }
    setProbingModels(true);
    setProbeResult(null);
    setErrorMsg(null);

    try {
      const body: Record<string, unknown> = {
        baseUrl: baseUrl.trim(),
        type: providerNode.type || "openai-compatible",
        apiType,
        modelsPath: modelsPath.trim() || undefined,
        chatPath: chatPath.trim() || undefined,
      };

      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setProbeResult({
        valid: Boolean(data?.valid),
        models: Array.isArray(data?.models) ? data.models : [],
        totalModels: typeof data?.totalModels === "number" ? data.totalModels : (data?.models?.length || 0),
        error: data?.error || null,
        probeUrl: data?.probeUrl || null,
      });

      if (data?.valid) {
        notify.success(`Discovered ${data.models?.length || 0} models from upstream.`);
      } else {
        notify.error(data?.error || "Could not fetch models from upstream endpoint.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error checking endpoint";
      setProbeResult({
        valid: false,
        models: [],
        error: msg,
      });
      notify.error(msg);
    } finally {
      setProbingModels(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !prefix.trim() || !baseUrl.trim()) {
      setErrorMsg("Name, Prefix, and Base URL are required.");
      return;
    }

    const trimmedIcon = iconUrl.trim();
    if (trimmedIcon && !isValidProviderIconUrl(trimmedIcon)) {
      setErrorMsg("Invalid icon URL. Please provide a valid HTTP/HTTPS image URL.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        prefix: prefix.trim(),
        baseUrl: baseUrl.trim(),
        type: providerNode.type || "openai-compatible",
        apiType,
        chatPath: chatPath.trim() || null,
        modelsPath: modelsPath.trim() || null,
        iconUrl: trimmedIcon || null,
      };

      const identityHeaders = getClientIdentityProfileHeaders(clientIdentityProfile);
      if (Object.keys(identityHeaders).length > 0) {
        body.customHeaders = identityHeaders;
      }

      const res = await fetch(`/api/provider-nodes/${encodeURIComponent(providerNode.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const msg = errData?.error?.message || errData?.error || `HTTP ${res.status}: Failed to update provider`;
        setErrorMsg(msg);
        notify.error(msg);
        return;
      }

      notify.success("Provider settings updated successfully.");
      await onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error saving provider settings";
      setErrorMsg(msg);
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Right Slide-Over Sheet */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#0E0E0E] text-white shadow-2xl sm:max-w-md md:max-w-lg lg:max-w-xl animate-in slide-in-from-right duration-300">
        {/* Sheet Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#141414]">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-white">tune</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Edit Custom Provider</h2>
                <span className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] font-mono text-white/70">
                  {providerNode.prefix}
                </span>
              </div>
              <p className="text-xs text-white/50">
                Update core endpoint settings & sync models directly to table
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Sheet Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar">
          {errorMsg && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          {/* 1. Core Settings */}
          <div className="flex flex-col gap-4">
            <Input
              label="Provider Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VPS Fast Router"
              hint="Human-readable name shown in dashboard"
            />

            <Input
              label="Route Prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. vps1"
              hint="Unique model route prefix (e.g. vps1/model-id)"
            />

            <Select
              label="API Protocol Type"
              options={apiTypeOptions}
              value={apiType}
              onChange={(e) => setApiType(e.target.value)}
            />

            <Input
              label="Upstream Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://187.52.117.2:8377/v1"
              hint="Root or /v1 endpoint URL of the upstream server"
            />

            <Input
              label="Icon URL (Optional)"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              hint="Image URL displayed in sidebar and headers"
            />
          </div>

          {/* 2. Advanced Collapsible */}
          <div className="border-t border-white/10 pt-3">
            <button
              type="button"
              className="text-xs font-semibold text-white/70 hover:text-white flex items-center gap-1.5 cursor-pointer py-1"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className={`material-symbols-outlined text-base transition-transform ${showAdvanced ? "rotate-90" : ""}`}>
                chevron_right
              </span>
              Advanced Path & Header Settings
            </button>

            {showAdvanced && (
              <div className="mt-3 flex flex-col gap-3.5 pl-3 border-l-2 border-white/10">
                <Input
                  label="Custom Chat Path"
                  value={chatPath}
                  onChange={(e) => setChatPath(e.target.value)}
                  placeholder="/v1/chat/completions"
                  hint="Leave empty to use protocol default"
                />

                <Input
                  label="Custom Models Path"
                  value={modelsPath}
                  onChange={(e) => setModelsPath(e.target.value)}
                  placeholder="/v1/models"
                  hint="Path or full URL to probe models"
                />

                <Select
                  label="Client Identity Profile"
                  options={CLIENT_IDENTITY_PROFILE_OPTIONS.map((o) => ({ ...o }))}
                  value={clientIdentityProfile}
                  onChange={(e) => setClientIdentityProfile(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 3. Live Models Fetch & Sync Section */}
          <div className="rounded-xl border border-white/15 bg-[#121212] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Upstream Models Sync
                </h3>
                <p className="text-[11px] text-white/50">
                  Probe upstream and sync all AI models directly into the table
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleProbeModels}
                disabled={probingModels || isSyncingModels}
                className="flex-1 text-xs"
              >
                {probingModels ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Checking Endpoint...
                  </span>
                ) : (
                  "Test & Inspect Models"
                )}
              </Button>

              <Button
                onClick={async () => {
                  await onSyncModels();
                }}
                disabled={isSyncingModels || probingModels}
                className="flex-1 text-xs"
              >
                {isSyncingModels ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Syncing to Table...
                  </span>
                ) : (
                  "Fetch & Sync to Table"
                )}
              </Button>
            </div>

            {/* Probe Results Feedback */}
            {probeResult && (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={probeResult.valid ? "text-emerald-400" : "text-red-400"}>
                    {probeResult.valid
                      ? `✓ Upstream Reachable: ${probeResult.models.length} AI Models Found`
                      : "✗ Upstream Probe Failed"}
                  </span>
                  {probeResult.probeUrl && (
                    <span className="text-[10px] text-white/40 truncate max-w-[200px]">
                      {probeResult.probeUrl}
                    </span>
                  )}
                </div>

                {probeResult.error && (
                  <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 rounded p-2">
                    {probeResult.error}
                  </p>
                )}

                {probeResult.valid && probeResult.models.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[11px] font-medium text-white/60">
                      Discovered AI Models List ({probeResult.models.length}):
                    </label>
                    <textarea
                      readOnly
                      rows={5}
                      value={probeResult.models.map((m) => m.id).join("\n")}
                      className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sheet Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4 bg-[#141414]">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Provider Settings"
            )}
          </Button>
        </div>
      </aside>
    </div>
  );
}
