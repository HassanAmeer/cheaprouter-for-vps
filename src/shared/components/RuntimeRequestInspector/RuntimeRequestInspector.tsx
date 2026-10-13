"use client";

import React, { useState, useEffect, useMemo } from "react";
import { runtimeLogger, type CapturedRequestLog } from "@/shared/utils/runtimeRequestLogger";

export default function RuntimeRequestInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<CapturedRequestLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "errors" | "api" | "models">("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    runtimeLogger.install();
    const unsubscribe = runtimeLogger.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return () => unsubscribe();
  }, []);

  const errorCount = useMemo(() => {
    return logs.filter((l) => (l.status && l.status >= 400) || l.error).length;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (activeFilter === "errors") {
        if (!((log.status && log.status >= 400) || log.error)) return false;
      } else if (activeFilter === "api") {
        if (!log.pathname.startsWith("/api/")) return false;
      } else if (activeFilter === "models") {
        if (!log.pathname.includes("models")) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesUrl = log.url.toLowerCase().includes(q);
        const matchesPath = log.pathname.toLowerCase().includes(q);
        const matchesMethod = log.method.toLowerCase().includes(q);
        const matchesStatus = String(log.status || "").includes(q);
        const matchesBody = log.responseBody?.toLowerCase().includes(q) || false;
        return matchesUrl || matchesPath || matchesMethod || matchesStatus || matchesBody;
      }

      return true;
    });
  }, [logs, activeFilter, search]);

  const selectedLog = useMemo(() => {
    if (!selectedId) return filteredLogs[0] || null;
    return logs.find((l) => l.id === selectedId) || null;
  }, [logs, selectedId, filteredLogs]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatJson = (content?: string | null) => {
    if (!content) return "No payload";
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "bg-sky-500/20 text-sky-400 border-sky-500/30";
      case "POST":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "PUT":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "DELETE":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      default:
        return "bg-white/10 text-white/80 border-white/20";
    }
  };

  const getStatusBadgeClass = (status?: number, error?: string | null) => {
    if (error || !status) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (status >= 200 && status < 300) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (status >= 300 && status < 400) return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    if (status >= 400 && status < 500) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <>
      {/* ── FLOATING BUTTON ON EVERY PAGE ── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-white/20 bg-[#121212]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl transition-all duration-200 hover:border-white/40 hover:bg-[#1C1C1C] hover:scale-105 active:scale-95 group text-white cursor-pointer"
        title="Open Live Request Inspector (Runtime Logs)"
      >
        <span className="material-symbols-outlined text-[19px] text-[#C0C0C0] group-hover:text-white transition-colors">
          terminal
        </span>
        <span className="text-xs font-semibold tracking-wide text-white">Live Logs</span>
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] font-mono text-white/80">
          {logs.length}
        </span>
        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/25 border border-red-500/40 px-1.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
            {errorCount} err
          </span>
        )}
      </button>

      {/* ── RIGHT-SIDE SLIDE-OVER SHEET ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/15 bg-[#0C0C0C] text-white shadow-2xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#141414]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-white">receipt_long</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-tight">Live Request Inspector</h2>
                    <span className="rounded-full bg-white/10 border border-white/10 px-2 py-0.5 text-[10px] uppercase font-mono text-white/70">
                      Runtime In-Memory
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Live captured HTTP requests • Zero persistence to DB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runtimeLogger.clearLogs()}
                  disabled={logs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  title="Clear all in-memory logs"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  Clear Logs
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-2.5 border-b border-white/10 bg-[#111111] p-3.5">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-white/40">
                  search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by URL, method, status, response..."
                  className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:border-white/30 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2 text-xs text-white/40 hover:text-white"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-0.5">
                {[
                  { id: "all", label: `All (${logs.length})` },
                  { id: "errors", label: `Errors (${errorCount})` },
                  { id: "api", label: "API Routes" },
                  { id: "models", label: "Models Discovery" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      activeFilter === tab.id
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content: Split Layout (List on Top or Left, Inspector Details Below) */}
            <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
              {/* Request List Column */}
              <div className="flex flex-col md:w-1/2 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto custom-scrollbar">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">
                    <span className="material-symbols-outlined text-3xl mb-2 text-white/20 block">
                      inbox
                    </span>
                    No requests match filter
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredLogs.map((log) => {
                      const isSelected = selectedLog?.id === log.id;
                      return (
                        <div
                          key={log.id}
                          onClick={() => setSelectedId(log.id)}
                          className={`flex items-start gap-2.5 p-3 text-xs transition-colors cursor-pointer ${
                            isSelected ? "bg-white/10 border-l-2 border-white" : "hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${getMethodBadgeClass(
                              log.method
                            )}`}
                          >
                            {log.method}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border ${getStatusBadgeClass(
                              log.status,
                              log.error
                            )}`}
                          >
                            {log.error ? "ERR" : log.status || "..."}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-mono text-white/90 font-medium" title={log.pathname}>
                              {log.pathname}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                              <span>{log.timestamp}</span>
                              {log.durationMs !== undefined && <span>{log.durationMs}ms</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Request Details Inspector Column */}
              <div className="flex flex-col md:w-1/2 overflow-y-auto custom-scrollbar bg-[#0A0A0A] p-4 text-xs">
                {selectedLog ? (
                  <div className="flex flex-col gap-4">
                    {/* Overview Header */}
                    <div className="rounded-lg border border-white/10 bg-black/40 p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-xs font-bold border ${getMethodBadgeClass(
                              selectedLog.method
                            )}`}
                          >
                            {selectedLog.method}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-xs font-bold border ${getStatusBadgeClass(
                              selectedLog.status,
                              selectedLog.error
                            )}`}
                          >
                            {selectedLog.error
                              ? "ERROR"
                              : `${selectedLog.status} ${selectedLog.statusText || ""}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/40 font-mono">
                          {selectedLog.durationMs !== undefined ? `${selectedLog.durationMs}ms` : ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <p className="font-mono text-xs text-white/90 break-all select-all">
                          {selectedLog.url}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(selectedLog.url, "url")}
                          className="text-[11px] text-white/60 hover:text-white shrink-0"
                          title="Copy URL"
                        >
                          {copiedKey === "url" ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>

                    {/* Network Error Alert */}
                    {selectedLog.error && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-400">
                        <strong className="block mb-1">Network Error:</strong>
                        <p className="font-mono text-[11px] break-all">{selectedLog.error}</p>
                      </div>
                    )}

                    {/* Request Headers */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/80">Request Headers</span>
                        {Object.keys(selectedLog.requestHeaders).length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(selectedLog.requestHeaders, null, 2),
                                "req_headers"
                              )
                            }
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "req_headers" ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/80 overflow-x-auto max-h-36">
                        {Object.keys(selectedLog.requestHeaders).length === 0 ? (
                          <span className="text-white/40">No request headers</span>
                        ) : (
                          Object.entries(selectedLog.requestHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-white/40 select-all">{k}:</span>
                              <span className="text-white/90 select-all">{v}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Request Body */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/80">Request Body</span>
                        {selectedLog.requestBody && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(formatJson(selectedLog.requestBody), "req_body")
                            }
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "req_body" ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <textarea
                        readOnly
                        rows={5}
                        value={formatJson(selectedLog.requestBody)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                      />
                    </div>

                    {/* Response Headers */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/80">Response Headers</span>
                        {selectedLog.responseHeaders &&
                          Object.keys(selectedLog.responseHeaders).length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  JSON.stringify(selectedLog.responseHeaders, null, 2),
                                  "res_headers"
                                )
                              }
                              className="text-[11px] text-white/40 hover:text-white"
                            >
                              {copiedKey === "res_headers" ? "Copied" : "Copy"}
                            </button>
                          )}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/80 overflow-x-auto max-h-36">
                        {!selectedLog.responseHeaders ||
                        Object.keys(selectedLog.responseHeaders).length === 0 ? (
                          <span className="text-white/40">No response headers</span>
                        ) : (
                          Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-white/40 select-all">{k}:</span>
                              <span className="text-white/90 select-all">{v}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Response Payload */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/80">Response Body</span>
                        {selectedLog.responseBody && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(formatJson(selectedLog.responseBody), "res_body")
                            }
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "res_body" ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <textarea
                        readOnly
                        rows={8}
                        value={formatJson(selectedLog.responseBody)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center text-xs text-white/40">
                    Select a request from the list to inspect full details
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
