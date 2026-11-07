"use client";

import { useCallback, useEffect, useState } from "react";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Toggle from "@/shared/components/Toggle";
import { useNotificationStore } from "@/store/notificationStore";

export interface AntigravityAccountItem {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  testStatus: string;
  rateLimitedUntil: string | null;
  lastError: string | null;
  lastErrorType: string | null;
  errorCode: number | null;
  priority: number;
  providerSpecificData: Record<string, unknown>;
}

interface AntigravityAccountsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  onAttachAccount?: () => void;
  onConnectionChanged?: () => void;
}

export default function AntigravityAccountsSheet({
  isOpen,
  onClose,
  providerId,
  onAttachAccount,
  onConnectionChanged,
}: AntigravityAccountsSheetProps) {
  if (!isOpen) return null;

  return (
    <AntigravityAccountsSheetPanel
      onClose={onClose}
      providerId={providerId}
      onAttachAccount={onAttachAccount}
      onConnectionChanged={onConnectionChanged}
    />
  );
}

function AntigravityAccountsSheetPanel({
  onClose,
  providerId,
  onAttachAccount,
  onConnectionChanged,
}: {
  onClose: () => void;
  providerId: string;
  onAttachAccount?: () => void;
  onConnectionChanged?: () => void;
}) {
  const notify = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [connections, setConnections] = useState<AntigravityAccountItem[]>([]);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [autoSwitchOnLimit, setAutoSwitchOnLimit] = useState(true);

  const fetchPoolState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/providers/${encodeURIComponent(providerId)}/antigravity-accounts`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load Antigravity accounts");
      const data = await res.json();
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      setNowTs(Date.now());
      if (typeof data.autoSwitchOnLimit === "boolean") {
        setAutoSwitchOnLimit(data.autoSwitchOnLimit);
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [providerId, notify]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetchPoolState();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchPoolState]);

  const handleResumeAccount = async (targetId: string) => {
    try {
      setUpdating(targetId);
      const res = await fetch(
        `/api/providers/${encodeURIComponent(providerId)}/antigravity-accounts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: targetId }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to switch active account");
      }
      const data = await res.json();
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      notify.success("Account resumed & set as active. Standby accounts paused.");
      if (onConnectionChanged) onConnectionChanged();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to switch account");
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleAutoSwitch = async (enabled: boolean) => {
    setAutoSwitchOnLimit(enabled);
    try {
      const res = await fetch(
        `/api/providers/${encodeURIComponent(providerId)}/antigravity-accounts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoSwitchOnLimit: enabled }),
        }
      );
      if (!res.ok) throw new Error("Failed to update auto-switch setting");
      notify.info(
        enabled
          ? "Auto-Switch on Limit Exceeded enabled"
          : "Auto-Switch on Limit Exceeded disabled"
      );
    } catch (err) {
      setAutoSwitchOnLimit(!enabled);
      notify.error(err instanceof Error ? err.message : "Failed to update setting");
    }
  };

  const handleTestConnection = async (connId: string) => {
    try {
      setTestingId(connId);
      const res = await fetch(
        `/api/providers/${encodeURIComponent(connId)}/test`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        notify.success("Account connection tested successfully!");
      } else {
        notify.warning(data.error || "Account test failed or returned warning");
      }
      void fetchPoolState();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteConnection = async (connId: string, connName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove account "${connName}" from the Antigravity pool?`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/providers/${encodeURIComponent(connId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove account");
      notify.success("Account removed");
      void fetchPoolState();
      if (onConnectionChanged) onConnectionChanged();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const activeCount = connections.filter((c) => c.isActive).length;
  const standbyCount = connections.length - activeCount;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Antigravity CLI Accounts Pool"
        className="relative w-[92vw] sm:w-[500px] max-w-full bg-[#141416] border-l border-white/10 shadow-2xl flex flex-col h-full z-10 overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/10 shrink-0 bg-[#18181b]/70 backdrop-blur-md">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 shadow-inner">
              <ProviderIcon providerId="antigravity" size={24} type="color" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight truncate">
                  Antigravity Accounts Pool
                </h2>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                  CLI & Multi-Account
                </span>
              </div>
              <p className="text-xs text-white/60 truncate mt-0.5">
                Single-active routing with automatic quota failover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Controls & Auto-Switch Setting Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-lg">
                    autorenew
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    Auto-Switch on Limit Exceeded
                  </h3>
                </div>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  Automatically switch to the next standby account when the active account reaches
                  429 rate limit or quota exhaustion.
                </p>
              </div>
              <Toggle
                checked={autoSwitchOnLimit}
                onChange={handleToggleAutoSwitch}
                size="md"
              />
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
              <div className="text-xs text-white/50">
                <span>{connections.length} Total Accounts</span>
                <span className="mx-1.5">•</span>
                <span className="text-emerald-400 font-medium">{activeCount} Active</span>
                <span className="mx-1.5">•</span>
                <span className="text-white/70">{standbyCount} Standby</span>
              </div>
              {onAttachAccount && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAttachAccount();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Attach Account</span>
                </button>
              )}
            </div>
          </div>

          {/* Accounts List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Connected Antigravity Accounts
              </h3>
              <button
                type="button"
                onClick={fetchPoolState}
                className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-white/50">
                <span className="material-symbols-outlined text-2xl animate-spin">sync</span>
                <span className="text-xs">Loading attached accounts...</span>
              </div>
            ) : connections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center space-y-3">
                <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-2xl">account_tree</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">No Antigravity Accounts Attached</h4>
                  <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                    Attach multiple Antigravity CLI accounts to toggle between them with a single click.
                  </p>
                </div>
                {onAttachAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAttachAccount();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-all"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Attach First Account</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((conn) => {
                  const isActive = conn.isActive;
                  const isUpdatingThis = updating === conn.id;
                  const isTestingThis = testingId === conn.id;
                  const projectId =
                    (conn.providerSpecificData?.projectId as string) ||
                    (conn.providerSpecificData?.project_id as string) ||
                    null;
                  const profile =
                    (conn.providerSpecificData?.clientProfile as string) ||
                    (conn.providerSpecificData?.antigravityClientProfile as string) ||
                    "CLI";
                  const isRateLimited =
                    Boolean(conn.rateLimitedUntil) &&
                    new Date(conn.rateLimitedUntil).getTime() > nowTs;

                  return (
                    <div
                      key={conn.id}
                      className={`relative rounded-2xl border p-4 transition-all ${
                        isActive
                          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/20 via-[#18181b] to-[#18181b] shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/20"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Radio / Active Indicator */}
                          <button
                            type="button"
                            onClick={() => !isActive && handleResumeAccount(conn.id)}
                            disabled={isActive || isUpdatingThis}
                            className={`mt-0.5 size-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isActive
                                ? "border-emerald-400 bg-emerald-500 text-slate-950 shadow-sm"
                                : "border-white/30 hover:border-amber-400 cursor-pointer"
                            }`}
                            title={isActive ? "Active Account" : "Click to Resume this account"}
                          >
                            {isActive ? (
                              <div className="size-2 rounded-full bg-slate-950" />
                            ) : null}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">
                                {conn.name}
                              </span>
                              {isActive ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Active & Resumed
                                </span>
                              ) : isRateLimited ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                                  <span className="material-symbols-outlined text-[11px]">
                                    hourglass_empty
                                  </span>
                                  Rate Limited
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/10 border border-white/15 px-2 py-0.5 text-[10px] font-medium text-white/60">
                                  Standby
                                </span>
                              )}
                              <span className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[9px] uppercase font-mono text-white/50">
                                {profile}
                              </span>
                            </div>

                            {/* Details: Project ID, Path or ID */}
                            <div className="mt-1 flex items-center gap-2 text-xs text-white/50 flex-wrap">
                              {projectId && (
                                <span className="font-mono text-white/70">
                                  Project: {projectId}
                                </span>
                              )}
                              <span>ID: {conn.id.slice(0, 10)}...</span>
                            </div>

                            {/* Error / Cooldown information if any */}
                            {conn.lastError && (
                              <p className="mt-1.5 text-[11px] text-amber-300/80 truncate">
                                Last note: {conn.lastError}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Top-Right Action / Resume button */}
                        <div className="shrink-0 flex items-center gap-1">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleResumeAccount(conn.id)}
                              disabled={isUpdatingThis}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-slate-950 text-white text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                              {isUpdatingThis ? "Resuming..." : "Resume"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Quick Actions */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-white/40">
                          Priority: {conn.priority}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestConnection(conn.id)}
                            disabled={isTestingThis}
                            className="text-white/60 hover:text-white inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <span
                              className={`material-symbols-outlined text-[13px] ${
                                isTestingThis ? "animate-spin" : ""
                              }`}
                            >
                              {isTestingThis ? "sync" : "network_check"}
                            </span>
                            <span>{isTestingThis ? "Testing..." : "Test"}</span>
                          </button>
                          <span className="text-white/20">•</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteConnection(conn.id, conn.name)}
                            className="text-rose-400/80 hover:text-rose-300 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-[#18181b]/70 backdrop-blur-md flex items-center justify-between text-xs text-white/50">
          <span>CheapRouter Antigravity Multi-Account</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
