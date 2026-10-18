"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useNotificationStore } from "@/store/notificationStore";

export interface DiscoveredServerPort {
  ip: string;
  port: number;
  protocol: "tcp";
  service: string;
  category: "ai-cli" | "ai-local" | "router" | "system" | "custom";
  isAiService: boolean;
  pid: number | null;
  processName: string;
  cmdline: string;
  suggestedBaseUrl: string;
  status: "listening";
}

interface CliConnectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  providerName?: string;
  onConnected?: () => void;
}

export default function CliConnectSheet({
  isOpen,
  onClose,
  providerId,
  providerName,
  onConnected,
}: CliConnectSheetProps) {
  if (!isOpen) return null;

  return (
    <CliConnectSheetPanel
      onClose={onClose}
      providerId={providerId}
      providerName={providerName}
      onConnected={onConnected}
    />
  );
}

function CliConnectSheetPanel({
  onClose,
  providerId,
  providerName,
  onConnected,
}: {
  onClose: () => void;
  providerId: string;
  providerName?: string;
  onConnected?: () => void;
}) {
  const notify = useNotificationStore();
  const isKilo = providerId === "kilo-code-cli";
  const defaultPort = isKilo ? 4098 : 4099;
  const displayName =
    providerName || (isKilo ? "Kilo Code CLI Server" : "OpenCode CLI Server");
  const defaultUrl = `http://127.0.0.1:${defaultPort}`;

  const [baseUrl, setBaseUrl] = useState<string>(defaultUrl);
  const [scanning, setScanning] = useState<boolean>(false);
  const [ports, setPorts] = useState<DiscoveredServerPort[]>([]);
  const [detectedPort, setDetectedPort] = useState<DiscoveredServerPort | null>(null);
  const [scanAttempted, setScanAttempted] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAllPorts, setShowAllPorts] = useState<boolean>(false);

  const [fetchingModels, setFetchingModels] = useState<boolean>(false);
  const [discoveredModels, setDiscoveredModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [connectSuccess, setConnectSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scan system server ports
  const scanPorts = useCallback(async () => {
    setScanning(true);
    setErrorMessage(null);
    setScanAttempted(true);
    try {
      const res = await fetch("/api/system/server-ports");
      if (!res.ok) {
        throw new Error(`Port discovery returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const discoveredList: DiscoveredServerPort[] = Array.isArray(data.ports) ? data.ports : [];
      setPorts(discoveredList);

      // Find matching port for this CLI
      const match = discoveredList.find((p) => {
        const lowerCmd = (p.cmdline + " " + p.processName + " " + p.service).toLowerCase();
        if (isKilo) {
          return (
            p.port === 4098 ||
            lowerCmd.includes("kilo") ||
            p.processName.includes("kilo")
          );
        } else {
          return (
            p.port === 4099 ||
            p.port === 4096 ||
            lowerCmd.includes("opencode") ||
            p.processName.includes("opencode")
          );
        }
      });

      if (match) {
        setDetectedPort(match);
        const url = `http://${match.ip === "0.0.0.0" || match.ip === "::" ? "127.0.0.1" : match.ip}:${match.port}`;
        setBaseUrl(url);
      } else {
        setDetectedPort(null);
      }
    } catch (err: unknown) {
      console.warn("Error scanning ports:", err);
      setDetectedPort(null);
    } finally {
      setScanning(false);
    }
  }, [isKilo]);

  // Initial scan on mount
  useEffect(() => {
    void scanPorts();
  }, [scanPorts]);

  // Filtered port list
  const filteredPorts = useMemo(() => {
    if (!searchQuery.trim()) return ports;
    const q = searchQuery.toLowerCase().trim();
    return ports.filter(
      (p) =>
        String(p.port).includes(q) ||
        p.service.toLowerCase().includes(q) ||
        p.processName.toLowerCase().includes(q) ||
        p.cmdline.toLowerCase().includes(q)
    );
  }, [ports, searchQuery]);

  // Handle Fetch Models & Connect
  const handleFetchModelsAndConnect = async () => {
    const targetUrl = baseUrl.trim().replace(/\/+$/, "");
    if (!targetUrl) {
      setErrorMessage("Please enter a valid Base URL");
      return;
    }

    setFetchingModels(true);
    setErrorMessage(null);
    setConnectSuccess(false);

    try {
      // 1. Validate / Probe models from the CLI server
      const validateRes = await fetch("/api/providers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          baseUrl: targetUrl,
        }),
      });

      const validateData = await validateRes.json().catch(() => null);
      if (!validateRes.ok || !validateData?.valid) {
        const errMsg =
          validateData?.error ||
          `Could not connect to ${displayName} at ${targetUrl}. Check that the CLI server is running.`;
        setErrorMessage(errMsg);
        setFetchingModels(false);
        return;
      }

      // 2. Fetch model list via probe
      const modelsList: Array<{ id: string; name?: string }> = [];
      try {
        const probeRes = await fetch(
          `/api/system/server-ports`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: new URL(targetUrl).hostname || "127.0.0.1",
              port: Number(new URL(targetUrl).port) || defaultPort,
              path: "/api/model",
            }),
          }
        );
        const probeData = await probeRes.json().catch(() => null);
        if (probeData?.preview) {
          try {
            const parsed = JSON.parse(probeData.preview);
            if (Array.isArray(parsed?.data)) {
              for (const m of parsed.data) {
                modelsList.push({ id: m.id || m.name, name: m.name || m.id });
              }
            }
          } catch {
            // Non-JSON preview
          }
        }
      } catch {
        // Fallback model probe
      }

      // If probe was empty, check config/providers (Kilo Code format)
      if (modelsList.length === 0) {
        try {
          const cfgRes = await fetch(`/api/system/server-ports`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: new URL(targetUrl).hostname || "127.0.0.1",
              port: Number(new URL(targetUrl).port) || defaultPort,
              path: "/config/providers",
            }),
          });
          const cfgData = await cfgRes.json().catch(() => null);
          if (cfgData?.preview) {
            try {
              const parsed = JSON.parse(cfgData.preview);
              if (Array.isArray(parsed?.providers)) {
                for (const p of parsed.providers) {
                  if (p.models && typeof p.models === "object") {
                    for (const [mid, m] of Object.entries(p.models)) {
                      modelsList.push({
                        id: (m as any)?.id || mid,
                        name: (m as any)?.name || mid,
                      });
                    }
                  }
                }
              }
            } catch {
              // Non-JSON preview
            }
          }
        } catch {
          // Ignore
        }
      }

      if (modelsList.length > 0) {
        setDiscoveredModels(modelsList);
      }

      // 3. Save connection into provider_connections
      const createRes = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          name: displayName,
          allowNoCredential: true,
          testStatus: "active",
          priority: 1,
          providerSpecificData: {
            baseUrl: targetUrl,
            modelsPath: "/api/model",
          },
        }),
      });

      if (!createRes.ok) {
        const createData = await createRes.json().catch(() => null);
        throw new Error(createData?.error || "Failed to save provider connection");
      }

      setConnectSuccess(true);
      notify.success(`${displayName} connected successfully!`);

      // Trigger sync of models in background
      void fetch(`/api/providers/${encodeURIComponent(providerId)}/models?refresh=true`).catch(() => {});

      if (onConnected) {
        onConnected();
      }

      // Close sheet after brief confirmation
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect to CLI");
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />

      {/* Slide-over Sheet (90% width on mobile as requested) */}
      <div
        role="dialog"
        aria-label={`Connect ${displayName}`}
        className="relative w-[90vw] sm:w-[480px] max-w-full bg-surface border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200 z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0 bg-surface">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ProviderIcon providerId={providerId} size={24} type="color" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-text-main truncate">
                Connect {displayName}
              </h2>
              <p className="text-xs text-text-muted truncate">
                CLI Headless Server Passthrough
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-subtle transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Check / Fetch Section */}
          <div className="rounded-xl border border-border bg-bg-subtle/50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-text-main">
                  {isKilo
                    ? "Check Kilo Code CLI Connection"
                    : "Check OpenCode CLI Connection"}
                </h3>
                <p className="text-xs text-text-muted">
                  Fetch active listening ports on this machine / VPS.
                </p>
              </div>
              <button
                type="button"
                onClick={scanPorts}
                disabled={scanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-contrast hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50 shadow-sm"
              >
                <span
                  className={`material-symbols-outlined text-[15px] leading-none${
                    scanning ? " animate-spin" : ""
                  }`}
                >
                  {scanning ? "sync" : "refresh"}
                </span>
                {scanning ? "Scanning..." : "Fetch the URL"}
              </button>
            </div>

            {/* Port Detection Result Banner */}
            {detectedPort ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-emerald-500 text-[18px] shrink-0 mt-0.5">
                  check_circle
                </span>
                <div className="text-xs space-y-1 min-w-0">
                  <div className="font-medium text-emerald-400">
                    Detected {detectedPort.service} on port {detectedPort.port}
                  </div>
                  <div className="text-text-muted text-[11px] font-mono break-all">
                    PID {detectedPort.pid ?? "active"} · {detectedPort.suggestedBaseUrl}
                  </div>
                </div>
              </div>
            ) : scanAttempted && !scanning ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">
                  warning
                </span>
                <div className="text-xs space-y-1.5 min-w-0">
                  <div className="font-semibold text-amber-400">
                    {isKilo
                      ? "You should install the Kilo Code CLI first on your machine"
                      : "You should install the OpenCode CLI first on your machine"}
                  </div>
                  <p className="text-text-muted text-[11px]">
                    Ensure the CLI headless server is active and listening on your server:
                  </p>
                  <pre className="p-2 rounded bg-black/40 text-[11px] font-mono text-text-main overflow-x-auto select-all">
                    {isKilo
                      ? "kilo serve --port 4098 --hostname 127.0.0.1"
                      : "opencode serve --port 4099 --hostname 127.0.0.1"}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* Discovered Ports list toggle & search */}
            {ports.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowAllPorts(!showAllPorts)}
                  className="flex items-center justify-between w-full text-xs text-text-muted hover:text-text-main py-1"
                >
                  <span className="font-medium">
                    All Discovered Ports ({ports.length})
                  </span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform ${
                      showAllPorts ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {showAllPorts && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      placeholder="Search port or process..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md bg-surface border border-border text-text-main focus:outline-none focus:border-primary/50"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-border/60 bg-surface p-1">
                      {filteredPorts.length === 0 ? (
                        <div className="text-[11px] text-text-muted p-2 text-center">
                          No matching ports found
                        </div>
                      ) : (
                        filteredPorts.map((p) => {
                          const isSelected = baseUrl.includes(`:${p.port}`);
                          return (
                            <button
                              key={`${p.ip}:${p.port}`}
                              type="button"
                              onClick={() => {
                                const url = `http://${
                                  p.ip === "0.0.0.0" || p.ip === "::" ? "127.0.0.1" : p.ip
                                }:${p.port}`;
                                setBaseUrl(url);
                              }}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors ${
                                isSelected
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "hover:bg-bg-subtle text-text-main"
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-semibold">
                                  {p.port}
                                </span>{" "}
                                <span className="text-[11px] text-text-muted truncate">
                                  · {p.service}
                                </span>
                              </div>
                              <span className="text-[10px] text-text-muted shrink-0 font-mono">
                                PID {p.pid ?? "—"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Base URL Input Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-main flex items-center justify-between">
              <span>CLI Server Base URL</span>
              <span className="text-[11px] text-emerald-400 font-normal">
                No API Key Required
              </span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:4099"
              className="w-full text-sm font-mono px-3.5 py-2.5 rounded-lg bg-bg-subtle border border-border text-text-main focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-[11px] text-text-muted">
              Connects directly to your local or VPS headless server without needing any paid credentials or authentication keys.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">
                error
              </span>
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {connectSuccess && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] shrink-0">
                check_circle
              </span>
              <span className="font-medium">
                Connected successfully! Connection is now active.
              </span>
            </div>
          )}

          {/* Discovered Models Preview */}
          {discoveredModels.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-bg-subtle/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-main">
                  Available Models ({discoveredModels.length})
                </span>
                <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  Ready
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {discoveredModels.map((m) => (
                  <span
                    key={m.id}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-muted"
                    title={m.name || m.id}
                  >
                    {m.name || m.id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action: Fetch Models & Connect */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleFetchModelsAndConnect}
              disabled={fetchingModels || connectSuccess}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-contrast hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {fetchingModels ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    sync
                  </span>
                  Fetching Models & Connecting...
                </>
              ) : connectSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                  Connected!
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    power
                  </span>
                  Fetch Models & Connect
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Bar with explicit Close button */}
        <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-surface shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span
              className={`size-2 rounded-full ${
                detectedPort || connectSuccess ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span>{connectSuccess ? "Connected" : detectedPort ? "Port Active" : "Waiting for Server"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-border bg-bg-subtle hover:bg-bg-subtle/80 text-text-main transition-colors ml-auto shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
