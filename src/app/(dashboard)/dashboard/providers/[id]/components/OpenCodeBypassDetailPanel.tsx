"use client";

import { useCallback, useEffect, useState } from "react";
import Toggle from "@/shared/components/Toggle";
import { getProviderAlias } from "@/shared/constants/providers";
import { useNotificationStore } from "@/store/notificationStore";

interface OpenCodeBypassDetailPanelProps {
  providerId: string;
  onFetchModels: () => Promise<void>;
  isFetchingModels: boolean;
  onConfigureBaseUrl?: () => void;
  customBaseUrl?: string | null;
}

export default function OpenCodeBypassDetailPanel({
  providerId,
  onFetchModels,
  isFetchingModels,
  onConfigureBaseUrl,
  customBaseUrl,
}: OpenCodeBypassDetailPanelProps) {
  const notify = useNotificationStore();
  const [blockedProviders, setBlockedProviders] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const providerAlias = getProviderAlias(providerId);
  const isEnabled =
    !blockedProviders.includes(providerId) &&
    !(typeof providerAlias === "string" && blockedProviders.includes(providerAlias));

  const effectiveBaseUrl =
    customBaseUrl?.trim() || "https://opencode.ai/inference/v1";

  useEffect(() => {
    let cancelled = false;
    async function loadBlocked() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.blockedProviders)) {
          setBlockedProviders(data.blockedProviders);
        }
      } catch (err) {
        console.error("Failed to load provider state:", err);
      }
    }
    void loadBlocked();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    async (nextEnabled: boolean) => {
      const prev = blockedProviders;
      const keysToRemove = new Set([providerId, providerAlias].filter(Boolean));
      const next = nextEnabled
        ? prev.filter((k) => !keysToRemove.has(k))
        : Array.from(new Set([...prev.filter((k) => !keysToRemove.has(k)), providerId]));

      setBlockedProviders(next);
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedProviders: next }),
        });
        if (!res.ok) {
          throw new Error("Failed to update provider status");
        }
        notify.success(
          nextEnabled
            ? "OpenCode API (Bypass) enabled"
            : "OpenCode API (Bypass) paused"
        );
      } catch (err) {
        setBlockedProviders(prev);
        notify.error(err instanceof Error ? err.message : "Failed to toggle provider");
      } finally {
        setSaving(false);
      }
    },
    [blockedProviders, notify, providerAlias, providerId]
  );

  const handleCopyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(effectiveBaseUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      notify.info("Base URL copied to clipboard");
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-[#141E18]/80 to-[#121214]/90 p-5 shadow-xl backdrop-blur-xl transition-all">
      {/* Glow highlight */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header row: Title + Master Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner">
            <span className="material-symbols-outlined text-2xl">bolt</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-white tracking-tight">
                OpenCode Free Plan — Direct API Bypass
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Zero Daemon
              </span>
              <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted">
                Zero Extra RAM
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Connect to OpenCode free plan directly via API base URL without heavy CLI.
            </p>
          </div>
        </div>

        {/* Master Active / Paused switch */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center bg-white/5 border border-white/10 rounded-xl px-3.5 py-2">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              isEnabled ? "text-emerald-400" : "text-text-muted"
            }`}
          >
            {saving ? "Saving..." : isEnabled ? "Active" : "Paused"}
          </span>
          <Toggle
            size="sm"
            checked={isEnabled}
            disabled={saving}
            onChange={handleToggle}
            title={isEnabled ? "Disable OpenCode Bypass" : "Enable OpenCode Bypass"}
          />
        </div>
      </div>

      {/* Details Grid: Base URL + RAM savings + Anti-detection features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4">
        {/* Card 1: Direct Base URL */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
              API Base URL
            </span>
            <button
              type="button"
              onClick={handleCopyBaseUrl}
              className="text-text-muted hover:text-white transition-colors p-1"
              title="Copy Base URL"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copiedUrl ? "check" : "content_copy"}
              </span>
            </button>
          </div>
          <div className="font-mono text-xs text-emerald-300 break-all bg-black/40 rounded-lg p-2 border border-white/5">
            {effectiveBaseUrl}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>Direct upstream endpoint</span>
            {onConfigureBaseUrl && (
              <button
                type="button"
                onClick={onConfigureBaseUrl}
                className="text-primary hover:underline font-medium text-[11px]"
              >
                Change URL
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Memory & CPU Optimization */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 flex flex-col justify-between gap-2">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            RAM &amp; CPU Footprint
          </span>
          <div className="text-xs text-white/90 leading-relaxed">
            <strong className="text-emerald-400 font-semibold">0 MB Extra Daemon:</strong> Runs
            in-process via native streaming parser. Local computer ki memory aur battery drain
            nahi hoti.
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/90 font-medium">
            <span className="material-symbols-outlined text-[14px]">eco</span>
            <span>No background CLI daemon needed</span>
          </div>
        </div>

        {/* Card 3: Anti-Detection & Gate Bypass */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 flex flex-col justify-between gap-2">
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            Upstream Protection
          </span>
          <div className="text-xs text-white/90 leading-relaxed">
            Auto-injects <code className="text-emerald-300 font-mono text-[10px]">Bearer public</code>,
            descending bitwise session affinity, and exact OpenCode CLI v2 fingerprint headers.
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-sky-400/90 font-medium">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            <span>Upstream Free Gate Compatible</span>
          </div>
        </div>
      </div>

      {/* Action Footer: Live Fetch Models + Add Custom Connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
          <span>OpenCode Free lane models ready to route and combo-fallback</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFetchModels}
            disabled={isFetchingModels}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isFetchingModels ? "animate-spin" : ""
              }`}
            >
              sync
            </span>
            <span>{isFetchingModels ? "Fetching Models..." : "Fetch Live Models"}</span>
          </button>

          {onConfigureBaseUrl && (
            <button
              type="button"
              onClick={onConfigureBaseUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-medium transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Configure Base URL</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
