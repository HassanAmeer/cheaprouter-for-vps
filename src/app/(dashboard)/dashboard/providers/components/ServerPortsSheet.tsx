"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button, Input } from "@/shared/components";
import { matchesSearch } from "@/shared/utils/turkishText";
import { useNotificationStore } from "@/store/notificationStore";

export interface DiscoveredPort {
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

interface PortTestResult {
  testing: boolean;
  accessible?: boolean;
  latencyMs?: number;
  statusCode?: number;
  statusText?: string;
  error?: string;
  preview?: string;
}

interface ServerPortsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBaseUrl: (baseUrl: string) => void;
}

export default function ServerPortsSheet({
  isOpen,
  onClose,
  onSelectBaseUrl,
}: ServerPortsSheetProps) {
  const [ports, setPorts] = useState<DiscoveredPort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "ai" | "system">("all");
  const [testResults, setTestResults] = useState<Record<string, PortTestResult>>({});
  const [expandedCmdlines, setExpandedCmdlines] = useState<Record<string, boolean>>({});

  const notify = useNotificationStore();

  const scanPorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/server-ports", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to scan server ports (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.ports)) {
        setPorts(data.ports);
      } else {
        throw new Error(data.error || "Failed to parse discovered ports");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error scanning ports";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const run = async () => {
      // Async yield so no setState fires synchronously in the effect body
      await Promise.resolve();
      if (cancelled) return;
      await scanPorts();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [isOpen, scanPorts]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleTestPort = async (item: DiscoveredPort) => {
    const key = `${item.ip}:${item.port}`;
    setTestResults((prev) => ({
      ...prev,
      [key]: { testing: true },
    }));

    try {
      const res = await fetch("/api/system/server-ports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: item.ip,
          port: item.port,
          path: item.isAiService ? "/v1/models" : "/",
          timeoutMs: 3000,
        }),
      });

      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          testing: false,
          accessible: data.accessible,
          latencyMs: data.latencyMs,
          statusCode: data.statusCode,
          statusText: data.statusText,
          error: data.error,
          preview: data.preview,
        },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          testing: false,
          accessible: false,
          error: message,
        },
      }));
    }
  };

  const handleApplyUrl = (suggestedBaseUrl: string, serviceName: string) => {
    onSelectBaseUrl(suggestedBaseUrl);
    notify.success(`Selected Base URL: ${suggestedBaseUrl} (${serviceName})`);
    onClose();
  };

  const filteredPorts = useMemo(() => {
    let list = ports;

    if (activeTab === "ai") {
      list = list.filter((p) => p.isAiService || p.category === "ai-cli" || p.category === "ai-local");
    } else if (activeTab === "system") {
      list = list.filter((p) => !p.isAiService);
    }

    if (!searchQuery.trim()) return list;

    return list.filter(
      (p) =>
        matchesSearch(p.port.toString(), searchQuery) ||
        matchesSearch(p.service, searchQuery) ||
        matchesSearch(p.ip, searchQuery) ||
        matchesSearch(p.processName, searchQuery) ||
        matchesSearch(p.cmdline, searchQuery)
    );
  }, [ports, activeTab, searchQuery]);

  const aiServicesCount = useMemo(
    () => ports.filter((p) => p.isAiService || p.category === "ai-cli" || p.category === "ai-local").length,
    [ports]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-bg-surface border-l border-border shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-3 bg-bg-subtle/50">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-[22px]">lan</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">
                    Server Ports & Services
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    {ports.length} Open
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Available TCP listeners & local AI daemons
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={scanPorts}
                disabled={loading}
                title="Refresh Open Ports"
                className="size-8 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-muted hover:text-text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}>
                  refresh
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="size-8 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-muted hover:text-text-primary hover:border-primary/40 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Banner description */}
          <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-start gap-2.5 text-xs text-text-muted">
            <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
              info
            </span>
            <span>
              Real-time scan of listening ports on this host/VPS. Detected services like{" "}
              <strong className="text-text-primary">Antseed (8377)</strong>,{" "}
              <strong className="text-text-primary">OpenCode CLI (4096)</strong>,{" "}
              <strong className="text-text-primary">Ollama (11434)</strong>, or{" "}
              <strong className="text-text-primary">vLLM</strong> can be attached with one click as
              your Custom Provider Base URL.
            </span>
          </div>

          {/* Search & Filter Controls */}
          <div className="px-6 py-3.5 border-b border-border flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center bg-bg-surface">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by port, service, PID..."
              />
            </div>
            <div className="flex items-center gap-1 bg-bg-subtle p-1 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "all"
                    ? "bg-bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                All ({ports.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                  activeTab === "ai"
                    ? "bg-bg-surface text-emerald-400 shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="size-1.5 rounded-full bg-emerald-400" />
                AI & CLI ({aiServicesCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("system")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "system"
                    ? "bg-bg-surface text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Other
              </button>
            </div>
          </div>

          {/* Content / List of Ports */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {error && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-400 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <div className="flex-1">
                  <div className="font-semibold">Port Discovery Error</div>
                  <div className="mt-0.5 opacity-90">{error}</div>
                </div>
                <Button size="sm" variant="outline" onClick={scanPorts}>
                  Retry
                </Button>
              </div>
            )}

            {loading && ports.length === 0 && (
              <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div className="text-sm font-medium text-text-primary">
                  Scanning active listening ports...
                </div>
                <div className="text-xs text-text-muted max-w-xs">
                  Probing TCP sockets and matching known AI daemons and processes
                </div>
              </div>
            )}

            {!loading && filteredPorts.length === 0 && (
              <div className="py-16 text-center border border-dashed border-border rounded-xl p-8 bg-bg-subtle/30">
                <span className="material-symbols-outlined text-4xl text-text-muted/40 mb-2">
                  search_off
                </span>
                <div className="text-sm font-medium text-text-primary">No Ports Found</div>
                <div className="text-xs text-text-muted mt-1">
                  {searchQuery
                    ? "No ports match your current search criteria."
                    : "No active listening ports were detected on this machine."}
                </div>
              </div>
            )}

            {filteredPorts.map((item) => {
              const key = `${item.ip}:${item.port}`;
              const testResult = testResults[key];
              const isExpanded = expandedCmdlines[key] || false;

              return (
                <div
                  key={key}
                  className={`p-4 rounded-xl border transition-all ${
                    item.isAiService
                      ? "bg-bg-surface border-emerald-500/30 hover:border-emerald-500/50 shadow-sm"
                      : "bg-bg-surface border-border hover:border-border-hover"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Port Badge */}
                      <div
                        className={`size-11 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          item.isAiService
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-mono font-bold"
                            : "bg-bg-subtle border-border text-text-primary font-mono font-bold"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-normal text-text-muted leading-tight">
                          PORT
                        </span>
                        <span className="text-xs">{item.port}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-text-primary truncate">
                            {item.service}
                          </h3>
                          {item.isAiService && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              AI Ready
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-subtle text-text-muted border border-border">
                            {item.ip}:{item.port}
                          </span>
                        </div>

                        {/* PID & Process info */}
                        <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Listening
                          </span>
                          {item.processName && (
                            <>
                              <span>•</span>
                              <span>
                                Process:{" "}
                                <strong className="text-text-primary font-mono">
                                  {item.processName}
                                </strong>
                              </span>
                            </>
                          )}
                          {item.pid && (
                            <>
                              <span>•</span>
                              <span>PID: {item.pid}</span>
                            </>
                          )}
                        </div>

                        {/* Command line preview */}
                        {item.cmdline && (
                          <div className="mt-2 text-[11px] font-mono bg-bg-subtle/80 p-2 rounded-lg border border-border text-text-muted break-all">
                            <div className="flex items-center justify-between text-[10px] text-text-muted/60 mb-0.5 uppercase tracking-wider">
                              <span>Command</span>
                              {item.cmdline.length > 80 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedCmdlines((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                  className="text-primary hover:underline"
                                >
                                  {isExpanded ? "Collapse" : "Expand"}
                                </button>
                              )}
                            </div>
                            <div className={isExpanded ? "" : "line-clamp-2"}>
                              {item.cmdline}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Test Result feedback */}
                  {testResult && (
                    <div
                      className={`mt-3 p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 ${
                        testResult.accessible
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="material-symbols-outlined text-[16px]">
                            {testResult.accessible ? "check_circle" : "cancel"}
                          </span>
                          <span>
                            {testResult.accessible
                              ? `Port ${item.port} is Active (HTTP ${testResult.statusCode || 200})`
                              : `Connection Failed: ${testResult.error || "Port closed or timed out"}`}
                          </span>
                        </div>
                        {typeof testResult.latencyMs === "number" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/30 border border-white/10">
                            {testResult.latencyMs}ms
                          </span>
                        )}
                      </div>

                      {testResult.preview && (
                        <pre className="mt-1 p-2 text-[10px] font-mono bg-black/40 rounded border border-white/5 overflow-x-auto max-h-24 whitespace-pre-wrap text-text-muted">
                          {testResult.preview.slice(0, 300)}...
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestPort(item)}
                      disabled={testResult?.testing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-bg-subtle text-text-muted hover:text-text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
                    >
                      <span
                        className={`material-symbols-outlined text-[14px] ${
                          testResult?.testing ? "animate-spin" : ""
                        }`}
                      >
                        {testResult?.testing ? "sync" : "sensors"}
                      </span>
                      <span>{testResult?.testing ? "Testing..." : "Ping / Test"}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-text-muted truncate max-w-[170px] hidden sm:inline" title={item.suggestedBaseUrl}>
                        {item.suggestedBaseUrl}
                      </span>
                      <Button
                        size="sm"
                        icon="arrow_forward"
                        onClick={() => handleApplyUrl(item.suggestedBaseUrl, item.service)}
                      >
                        Use as Base URL
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-bg-subtle/50 flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span>CheapRouter Local Port Discovery</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
