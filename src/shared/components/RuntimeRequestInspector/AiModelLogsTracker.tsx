"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { CapturedRequestLog } from "@/shared/utils/runtimeRequestLogger";

export interface AiModelLogItem {
  id: string;
  timestamp: string;
  timeDisplay: string;
  status: number;
  statusText?: string;
  provider: string;
  providerDisplay?: string;
  model: string;
  requestedModel?: string;
  comboName?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  tokensTotal?: number;
  error?: string | null;
  errorType?: string | null;
  active?: boolean;
  source: "server-call-log" | "client-runtime";

  // Request details
  userMessage?: string | null;
  systemPrompt?: string | null;
  messages?: Array<{ role: string; content: string }>;
  baseUrl?: string | null;
  requestHeaders?: Record<string, string>;
  parameters?: Record<string, any>;
  rawRequestBody?: any;

  // Response details
  assistantResponse?: string | null;
  responseHeaders?: Record<string, string>;
  rawResponseBody?: any;

  // Pipeline details loaded status
  detailsLoaded?: boolean;
  loadingDetails?: boolean;
}

interface AiModelLogsTrackerProps {
  clientLogs: CapturedRequestLog[];
}

function parseServerCallLogs(data: any[]): AiModelLogItem[] {
  return data.map((row: any) => {
    const time = row.timestamp ? new Date(row.timestamp) : new Date();
    const timeDisplay =
      !isNaN(time.getTime())
        ? time.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
          "." +
          String(time.getMilliseconds()).padStart(3, "0")
        : String(row.timestamp || "");

    const tokensIn = row.tokens?.in ?? row.tokensIn ?? 0;
    const tokensOut = row.tokens?.out ?? row.tokensOut ?? 0;

    return {
      id: String(row.id || Math.random()),
      timestamp: String(row.timestamp || new Date().toISOString()),
      timeDisplay,
      status: Number(row.status || 0),
      statusText: row.statusText || (row.status === 200 ? "OK" : row.status ? `HTTP ${row.status}` : "Pending"),
      provider: String(row.provider || "unknown"),
      providerDisplay: String(row.providerDisplay || row.provider || "Unknown Provider"),
      model: String(row.model || row.requestedModel || "default-model"),
      requestedModel: row.requestedModel ? String(row.requestedModel) : undefined,
      comboName: row.comboName ? String(row.comboName) : undefined,
      durationMs: typeof row.duration === "number" ? row.duration : undefined,
      tokensIn,
      tokensOut,
      tokensTotal: tokensIn + tokensOut,
      error: row.error ? String(row.error) : null,
      errorType: row.errorType ? String(row.errorType) : null,
      active: Boolean(row.active),
      source: "server-call-log",
    };
  });
}

export default function AiModelLogsTracker({ clientLogs }: AiModelLogsTrackerProps) {
  const [serverLogs, setServerLogs] = useState<AiModelLogItem[]>([]);
  const [loadingServerLogs, setLoadingServerLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "errors" | "success" | "streaming">("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [detailTab, setDetailTab] = useState<"chat" | "request" | "response" | "diagnostics" | "raw">("chat");
  const [revealApiKey, setRevealApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detailedCache, setDetailedCache] = useState<Record<string, Partial<AiModelLogItem>>>({});

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── 1. Fetch Server Call Logs ──────────────────────────────────────────
  const loadServerLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/call-logs?limit=40", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      if (isMountedRef.current) {
        setServerLogs(parseServerCallLogs(data));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleManualRefresh = async () => {
    setLoadingServerLogs(true);
    await loadServerLogs();
    if (isMountedRef.current) {
      setLoadingServerLogs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/usage/call-logs?limit=40", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!Array.isArray(data) || cancelled) return;
        setServerLogs(parseServerCallLogs(data));
      } catch {
        // ignore
      }
    };

    void run();
    if (!autoRefresh) {
      return () => {
        cancelled = true;
      };
    }
    const interval = setInterval(run, 3500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [autoRefresh]);

  // ── 2. Convert Client Runtime Logs to AI Model Logs ───────────────────
  const clientAiLogs = useMemo(() => {
    const results: AiModelLogItem[] = [];

    for (const log of clientLogs) {
      const isChatCompletion =
        log.pathname.includes("/chat/completions") ||
        log.pathname.includes("/v1/chat") ||
        log.pathname.includes("/api/translator/send");
      const isModelProbe =
        log.pathname.includes("/models") ||
        log.pathname.includes("/test") ||
        log.pathname.includes("/validate");

      if (!isChatCompletion && !isModelProbe) continue;

      let parsedReq: any = null;
      let parsedRes: any = null;
      try {
        if (log.requestBody) parsedReq = JSON.parse(log.requestBody);
      } catch {
        parsedReq = log.requestBody;
      }
      try {
        if (log.responseBody) parsedRes = JSON.parse(log.responseBody);
      } catch {
        parsedRes = log.responseBody;
      }

      // Extract model
      let model =
        (typeof parsedReq === "object" && (parsedReq?.model || parsedReq?.requestedModel)) ||
        (typeof parsedRes === "object" && parsedRes?.model) ||
        null;
      if (!model && log.pathname.includes("/providers/")) {
        const parts = log.pathname.split("/");
        const provIdx = parts.indexOf("providers");
        if (provIdx !== -1 && parts[provIdx + 1]) {
          model = parts[provIdx + 1];
        }
      }

      // Extract provider
      let provider = "cheaproute";
      if (log.pathname.includes("/providers/")) {
        const parts = log.pathname.split("/");
        const idx = parts.indexOf("providers");
        if (idx !== -1 && parts[idx + 1]) {
          provider = decodeURIComponent(parts[idx + 1]);
        }
      } else if (typeof parsedReq === "object" && parsedReq?.provider) {
        provider = String(parsedReq.provider);
      }

      // Extract messages and prompts
      const messagesList: Array<{ role: string; content: string }> = [];
      let userMsg: string | null = null;
      let sysMsg: string | null = null;

      if (Array.isArray(parsedReq?.messages)) {
        for (const m of parsedReq.messages) {
          const content =
            typeof m.content === "string"
              ? m.content
              : Array.isArray(m.content)
              ? m.content.map((c: any) => c.text || JSON.stringify(c)).join("\n")
              : JSON.stringify(m.content);
          messagesList.push({ role: m.role || "user", content });
          if (m.role === "user") userMsg = content;
          if (m.role === "system") sysMsg = content;
        }
      } else if (typeof parsedReq?.prompt === "string") {
        userMsg = parsedReq.prompt;
        messagesList.push({ role: "user", content: parsedReq.prompt });
      }

      // Extract assistant response
      let assistantMsg: string | null = null;
      if (typeof parsedRes === "object" && parsedRes !== null) {
        if (Array.isArray(parsedRes.choices) && parsedRes.choices[0]) {
          const ch = parsedRes.choices[0];
          assistantMsg = ch.message?.content || ch.text || (ch.delta?.content ? String(ch.delta.content) : null);
        } else if (typeof parsedRes.text === "string") {
          assistantMsg = parsedRes.text;
        } else if (parsedRes.error) {
          assistantMsg =
            typeof parsedRes.error === "string"
              ? parsedRes.error
              : parsedRes.error?.message || JSON.stringify(parsedRes.error);
        }
      } else if (typeof parsedRes === "string") {
        assistantMsg = parsedRes;
      }

      const status = Number(log.status || 0);
      const errorMsg =
        log.error ||
        (status >= 400 && typeof parsedRes === "object" ? parsedRes?.error?.message || parsedRes?.error : null);

      results.push({
        id: "client_" + log.id,
        timestamp: log.timestamp,
        timeDisplay: log.timestamp,
        status,
        statusText: log.statusText || (status === 200 ? "OK" : status ? `HTTP ${status}` : "Failed"),
        provider,
        providerDisplay: provider,
        model: model || (isModelProbe ? "Model Probe / Discovery" : "Custom AI Request"),
        durationMs: log.durationMs,
        error: errorMsg,
        errorType: parsedRes?.error?.type || (status >= 500 ? "UPSTREAM_ERROR" : status === 429 ? "RATE_LIMITED" : null),
        source: "client-runtime",
        userMessage: userMsg,
        systemPrompt: sysMsg,
        messages: messagesList.length > 0 ? messagesList : undefined,
        baseUrl: log.url,
        requestHeaders: log.requestHeaders,
        responseHeaders: log.responseHeaders,
        rawRequestBody: parsedReq,
        rawResponseBody: parsedRes,
        assistantResponse: assistantMsg,
        detailsLoaded: true,
      });
    }

    return results;
  }, [clientLogs]);

  // ── 3. Combined & Filtered Logs ────────────────────────────────────────
  const allLogs = useMemo(() => {
    // Interleave client and server logs without duplicates
    const seen = new Set<string>();
    const merged: AiModelLogItem[] = [];

    // Prioritize client logs for immediate response visualization
    for (const cl of clientAiLogs) {
      merged.push(cl);
      seen.add(cl.id);
    }

    for (const sl of serverLogs) {
      if (!seen.has(sl.id)) {
        merged.push(sl);
        seen.add(sl.id);
      }
    }

    return merged;
  }, [clientAiLogs, serverLogs]);

  // Provider list for filter pills
  const availableProviders = useMemo(() => {
    const set = new Set<string>();
    for (const log of allLogs) {
      if (log.provider && log.provider !== "unknown") set.add(log.provider);
    }
    return Array.from(set);
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // Provider filter
      if (selectedProvider !== "all" && log.provider.toLowerCase() !== selectedProvider.toLowerCase()) {
        return false;
      }

      // Status filter
      if (statusFilter === "errors") {
        if (!(log.status >= 400 || log.error || log.status === 0)) return false;
      } else if (statusFilter === "success") {
        if (!(log.status >= 200 && log.status < 300 && !log.error)) return false;
      } else if (statusFilter === "streaming") {
        const isStream =
          log.parameters?.stream === true ||
          log.rawRequestBody?.stream === true ||
          log.responseHeaders?.["content-type"]?.includes("text/event-stream") ||
          log.assistantResponse === "[SSE Stream Active]";
        if (!isStream) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchModel = log.model.toLowerCase().includes(q);
        const matchProvider = (log.providerDisplay || log.provider).toLowerCase().includes(q);
        const matchUser = (log.userMessage || "").toLowerCase().includes(q);
        const matchAsst = (log.assistantResponse || "").toLowerCase().includes(q);
        const matchErr = (log.error || "").toLowerCase().includes(q);
        const matchStatus = String(log.status).includes(q);
        return matchModel || matchProvider || matchUser || matchAsst || matchErr || matchStatus;
      }

      return true;
    });
  }, [allLogs, selectedProvider, statusFilter, search]);

  // Active selected log with detailed cache merge
  const selectedLog: AiModelLogItem | null = useMemo(() => {
    const raw = selectedId ? allLogs.find((l) => l.id === selectedId) || filteredLogs[0] || null : filteredLogs[0] || null;
    if (!raw) return null;
    const cached = detailedCache[raw.id];
    if (cached) {
      return { ...raw, ...cached, detailsLoaded: true };
    }
    return raw;
  }, [allLogs, filteredLogs, selectedId, detailedCache]);

  // Auto-fetch details for server call log if not cached
  useEffect(() => {
    if (!selectedLog) return;
    if (selectedLog.source !== "server-call-log") return;
    if (detailedCache[selectedLog.id]) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/logs/${encodeURIComponent(selectedLog.id)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const p = data.pipelinePayloads || {};
        const clientReq = p.clientRequest || {};
        const providerReq = p.providerRequest || {};
        const providerRes = p.providerResponse || {};
        const clientRes = p.clientResponse || {};

        // Extract user prompt & messages
        const msgs: Array<{ role: string; content: string }> = [];
        let uMsg: string | null = null;
        let sPrompt: string | null = null;

        if (Array.isArray(clientReq.messages)) {
          for (const m of clientReq.messages) {
            const content =
              typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2);
            msgs.push({ role: m.role || "user", content });
            if (m.role === "user") uMsg = content;
            if (m.role === "system") sPrompt = content;
          }
        } else if (typeof clientReq.prompt === "string") {
          uMsg = clientReq.prompt;
          msgs.push({ role: "user", content: clientReq.prompt });
        }

        // Extract assistant output
        let asstMsg: string | null = null;
        if (data.partialAssistantText) {
          asstMsg = data.partialAssistantText;
        } else if (Array.isArray(clientRes.choices) && clientRes.choices[0]?.message?.content) {
          asstMsg = clientRes.choices[0].message.content;
        } else if (Array.isArray(providerRes.choices) && providerRes.choices[0]?.message?.content) {
          asstMsg = providerRes.choices[0].message.content;
        }

        const detailsPatch: Partial<AiModelLogItem> = {
          userMessage: uMsg,
          systemPrompt: sPrompt,
          messages: msgs.length > 0 ? msgs : undefined,
          baseUrl: providerReq.url || providerReq.endpoint || clientReq.url || null,
          requestHeaders: providerReq.headers || clientReq.headers || {},
          responseHeaders: providerRes.headers || clientRes.headers || {},
          parameters: {
            temperature: clientReq.temperature ?? providerReq.temperature,
            max_tokens: clientReq.max_tokens ?? providerReq.max_tokens,
            stream: clientReq.stream ?? providerReq.stream,
          },
          rawRequestBody: providerReq.body || clientReq,
          rawResponseBody: providerRes.body || providerRes || clientRes,
          assistantResponse: asstMsg,
          error: data.error || selectedLog.error,
          errorType: data.errorType || selectedLog.errorType,
          detailsLoaded: true,
        };

        setDetailedCache((prev) => ({
          ...prev,
          [selectedLog.id]: detailsPatch,
        }));
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLog, detailedCache]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatJson = (val: any) => {
    if (!val) return "No payload available";
    if (typeof val === "string") {
      try {
        return JSON.stringify(JSON.parse(val), null, 2);
      } catch {
        return val;
      }
    }
    return JSON.stringify(val, null, 2);
  };

  const maskKey = (keyStr?: string) => {
    if (!keyStr) return "";
    if (revealApiKey) return keyStr;
    if (keyStr.length <= 10) return "sk-••••••••";
    return keyStr.slice(0, 7) + "••••••••" + keyStr.slice(-4);
  };

  // Helper for error badge classes
  const getStatusColor = (status: number, error?: string | null) => {
    if (error || status >= 500 || status === 0) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (status === 429) return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (status >= 400) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (status >= 200 && status < 300) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-white/10 text-white/70 border-white/20";
  };

  const errorCount = useMemo(() => {
    return allLogs.filter((l) => l.status >= 400 || l.error || l.status === 0).length;
  }, [allLogs]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#0A0A0A]">
      {/* ── Sub-header: Filters, Search, and Auto-Refresh Controls ── */}
      <div className="flex flex-col gap-2.5 border-b border-white/10 bg-[#121212] p-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-white/40">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by model, provider, prompt message, error..."
              className="w-full rounded-lg border border-white/10 bg-black/50 pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:border-primary/50 focus:outline-none"
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

          {/* Action buttons: Auto-refresh & Manual Refresh */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                autoRefresh
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white"
              }`}
              title={autoRefresh ? "Auto-refresh active (3.5s)" : "Auto-refresh paused"}
            >
              <span
                className={`inline-block size-2 rounded-full ${
                  autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-white/40"
                }`}
              />
              {autoRefresh ? "Live (3s)" : "Paused"}
            </button>

            <button
              type="button"
              onClick={() => handleManualRefresh()}
              disabled={loadingServerLogs}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
              title="Refresh logs now"
            >
              <span className={`material-symbols-outlined text-[15px] ${loadingServerLogs ? "animate-spin" : ""}`}>
                refresh
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs pb-0.5">
          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: `All Models (${allLogs.length})` },
              { id: "errors", label: `Errors / Issues (${errorCount})` },
              { id: "success", label: "Success (2xx)" },
              { id: "streaming", label: "Streaming" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Provider selector pill */}
          {availableProviders.length > 0 && (
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="rounded-md border border-white/10 bg-black/60 px-2 py-1 text-xs text-white/80 focus:outline-none"
            >
              <option value="all">All Providers ({availableProviders.length})</option>
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Main Split View: Left list of AI calls, Right inspection details ── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        {/* Left Column: List of AI Model calls */}
        <div className="flex flex-col md:w-5/12 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto custom-scrollbar bg-[#0D0D0D]">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-white/40">
              <span className="material-symbols-outlined text-4xl mb-2 text-white/20">psychology</span>
              <p className="font-medium text-white/60">No AI model logs found</p>
              <p className="text-[11px] text-white/40 mt-1">
                Trigger a model request from Playground, API, or run tests to watch live requests.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                const isError = log.status >= 400 || Boolean(log.error);

                return (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedId(log.id);
                      if (isError) setDetailTab("diagnostics");
                    }}
                    className={`flex flex-col gap-1.5 p-3 text-xs transition-colors cursor-pointer border-l-2 ${
                      isSelected
                        ? "bg-white/10 border-primary"
                        : isError
                        ? "border-red-500/40 hover:bg-red-500/5"
                        : "border-transparent hover:bg-white/5"
                    }`}
                  >
                    {/* Top Row: Provider & Status Badge */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                          <span className="material-symbols-outlined text-[11px] text-primary">hub</span>
                          {log.providerDisplay || log.provider}
                        </span>
                        {log.comboName && (
                          <span className="inline-flex items-center rounded bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.2 text-[9px] font-medium text-amber-300">
                            Combo: {log.comboName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${getStatusColor(
                            log.status,
                            log.error
                          )}`}
                        >
                          {log.error ? "ERR" : log.status || "..."}
                        </span>
                        <span className="font-mono text-[10px] text-white/40">{log.timeDisplay}</span>
                      </div>
                    </div>

                    {/* Middle Row: Model Name */}
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-white/50">smart_toy</span>
                      <p className="font-mono text-[11px] font-semibold text-white truncate" title={log.model}>
                        {log.model}
                      </p>
                      {log.requestedModel && log.requestedModel !== log.model && (
                        <span
                          className="text-[10px] text-white/40 truncate font-mono"
                          title={`Requested as ${log.requestedModel}`}
                        >
                          (req: {log.requestedModel})
                        </span>
                      )}
                    </div>

                    {/* Excerpt Row: User message prompt or error snippet */}
                    {log.error ? (
                      <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 rounded px-1.5 py-0.5 truncate">
                        <span className="material-symbols-outlined text-[12px] shrink-0">warning</span>
                        <span className="truncate">{log.error}</span>
                      </div>
                    ) : log.userMessage ? (
                      <p className="text-[10px] text-white/60 truncate font-mono bg-black/40 rounded px-1.5 py-0.5">
                        &quot;{log.userMessage}&quot;
                      </p>
                    ) : null}

                    {/* Footer Row: Latency & Tokens */}
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-0.5">
                      <div className="flex items-center gap-2">
                        {log.durationMs !== undefined && (
                          <span className="inline-flex items-center gap-0.5 font-mono">
                            <span className="material-symbols-outlined text-[11px]">timer</span>
                            {log.durationMs}ms
                          </span>
                        )}
                        {log.tokensTotal !== undefined && log.tokensTotal > 0 && (
                          <span className="inline-flex items-center gap-0.5 font-mono">
                            <span className="material-symbols-outlined text-[11px]">token</span>
                            {log.tokensIn} in / {log.tokensOut} out
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] uppercase tracking-wide opacity-50">
                        {log.source === "client-runtime" ? "Client Event" : "Server Log"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Detailed AI Model Inspection */}
        <div className="flex flex-col md:w-7/12 overflow-y-auto custom-scrollbar bg-[#080808] text-xs">
          {selectedLog ? (
            <div className="flex flex-col h-full">
              {/* Top Overview Banner */}
              <div className="border-b border-white/10 bg-[#141414] p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-primary/20 border border-primary/30 px-2 py-0.5 text-xs font-bold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">hub</span>
                        {selectedLog.providerDisplay || selectedLog.provider}
                      </span>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-mono font-bold text-white flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                        {selectedLog.model}
                      </span>
                      {selectedLog.requestedModel && selectedLog.requestedModel !== selectedLog.model && (
                        <span className="rounded bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[10px] font-mono text-amber-300">
                          Route Fallback: {selectedLog.requestedModel} → {selectedLog.model}
                        </span>
                      )}
                    </div>
                    {selectedLog.baseUrl && (
                      <p className="font-mono text-[11px] text-white/50 truncate mt-0.5" title={selectedLog.baseUrl}>
                        Target URL: {selectedLog.baseUrl}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded px-2.5 py-1 font-mono text-xs font-bold border ${getStatusColor(
                        selectedLog.status,
                        selectedLog.error
                      )}`}
                    >
                      {selectedLog.error
                        ? "FAILED"
                        : `${selectedLog.status} ${selectedLog.statusText || ""}`}
                    </span>
                  </div>
                </div>

                {/* Metrics Pill Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/5 text-[11px]">
                  <div className="rounded bg-black/40 border border-white/5 p-2">
                    <span className="text-white/40 block text-[10px]">Latency</span>
                    <span className="font-mono font-semibold text-white">
                      {selectedLog.durationMs !== undefined ? `${selectedLog.durationMs}ms` : "N/A"}
                    </span>
                  </div>
                  <div className="rounded bg-black/40 border border-white/5 p-2">
                    <span className="text-white/40 block text-[10px]">Prompt Tokens</span>
                    <span className="font-mono font-semibold text-white">
                      {selectedLog.tokensIn ?? 0}
                    </span>
                  </div>
                  <div className="rounded bg-black/40 border border-white/5 p-2">
                    <span className="text-white/40 block text-[10px]">Output Tokens</span>
                    <span className="font-mono font-semibold text-white">
                      {selectedLog.tokensOut ?? 0}
                    </span>
                  </div>
                  <div className="rounded bg-black/40 border border-white/5 p-2">
                    <span className="text-white/40 block text-[10px]">Timestamp</span>
                    <span className="font-mono font-semibold text-white truncate block">
                      {selectedLog.timeDisplay}
                    </span>
                  </div>
                </div>

                {/* Sub-tab Navigation for Selected AI Call */}
                <div className="flex items-center gap-1 border-t border-white/10 pt-2 overflow-x-auto">
                  {[
                    { id: "chat", label: "Conversation", icon: "chat" },
                    { id: "request", label: "Request & Headers", icon: "arrow_upward" },
                    { id: "response", label: "Response Payload", icon: "arrow_downward" },
                    {
                      id: "diagnostics",
                      label: selectedLog.error ? "Issue & Diagnostics ⚠️" : "Diagnostics",
                      icon: "build_circle",
                      alert: Boolean(selectedLog.error),
                    },
                    { id: "raw", label: "Raw Telemetry", icon: "data_object" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDetailTab(tab.id as any)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        detailTab === tab.id
                          ? tab.alert
                            ? "bg-red-500 text-white font-semibold"
                            : "bg-white text-black font-semibold"
                          : tab.alert
                          ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                          : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab Content Area */}
              <div className="p-4 flex-1 flex flex-col gap-4">
                {/* ── 1. CONVERSATION VIEW ── */}
                {detailTab === "chat" && (
                  <div className="flex flex-col gap-4">
                    {/* User Message Card */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-semibold text-sky-400">
                          <span className="material-symbols-outlined text-sm">person</span>
                          User Input Message / Prompt:
                        </span>
                        {selectedLog.userMessage && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedLog.userMessage || "", "user_msg")}
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "user_msg" ? "Copied" : "Copy Prompt"}
                          </button>
                        )}
                      </div>
                      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-white/90 font-mono text-xs whitespace-pre-wrap select-all">
                        {selectedLog.userMessage ||
                          (selectedLog.rawRequestBody?.messages ? (
                            <pre className="text-[11px]">
                              {JSON.stringify(selectedLog.rawRequestBody.messages, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-white/40 italic">
                              No user prompt message was extracted or request was not a completion call.
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* System Prompt Card if present */}
                    {selectedLog.systemPrompt && (
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                          <span className="material-symbols-outlined text-sm">shield</span>
                          System Instructions:
                        </span>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-white/80 font-mono text-xs whitespace-pre-wrap select-all">
                          {selectedLog.systemPrompt}
                        </div>
                      </div>
                    )}

                    {/* AI Assistant Response Card */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                          <span className="material-symbols-outlined text-sm">smart_toy</span>
                          AI Model Response ({selectedLog.model}):
                        </span>
                        {selectedLog.assistantResponse && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedLog.assistantResponse || "", "asst_msg")}
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "asst_msg" ? "Copied" : "Copy Response"}
                          </button>
                        )}
                      </div>

                      {selectedLog.error ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-red-300 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-red-400">
                            <span className="material-symbols-outlined text-base">error</span>
                            <span>Model Request Failed (HTTP {selectedLog.status}):</span>
                          </div>
                          <p className="font-mono text-xs whitespace-pre-wrap select-all">
                            {selectedLog.error}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDetailTab("diagnostics")}
                            className="self-start text-[11px] underline text-red-300 hover:text-white mt-1"
                          >
                            View Root Cause Analysis & Diagnostics →
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-white/90 font-mono text-xs whitespace-pre-wrap select-all">
                          {selectedLog.assistantResponse || (
                            <span className="text-white/40 italic">
                              {selectedLog.status === 200
                                ? "Response received (inspect Raw Response tab for full JSON payload)"
                                : "Waiting for response or no response content."}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── 2. REQUEST & HEADERS VIEW ── */}
                {detailTab === "request" && (
                  <div className="flex flex-col gap-4">
                    {/* Target Endpoint & Base URL */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white/80">Target Base URL / Endpoint</span>
                        {selectedLog.baseUrl && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedLog.baseUrl || "", "base_url")}
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "base_url" ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-xs text-white/90 break-all select-all">
                        {selectedLog.baseUrl || "Default CheapRoute router dispatch"}
                      </div>
                    </div>

                    {/* Headers & Auth Table */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white/80">Request Headers & Auth</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRevealApiKey((prev) => !prev)}
                            className="text-[11px] text-primary hover:underline"
                          >
                            {revealApiKey ? "Mask Keys" : "Reveal API Keys"}
                          </button>
                          {selectedLog.requestHeaders && (
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
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] overflow-x-auto max-h-48 divide-y divide-white/5">
                        {!selectedLog.requestHeaders || Object.keys(selectedLog.requestHeaders).length === 0 ? (
                          <span className="text-white/40 italic">No headers captured</span>
                        ) : (
                          Object.entries(selectedLog.requestHeaders).map(([k, v]) => {
                            const isAuth =
                              k.toLowerCase().includes("auth") ||
                              k.toLowerCase().includes("key") ||
                              k.toLowerCase().includes("token");
                            const displayVal = isAuth ? maskKey(v) : v;

                            return (
                              <div key={k} className="flex gap-2 py-1">
                                <span className="text-white/40 select-all shrink-0">{k}:</span>
                                <span className={`select-all break-all ${isAuth ? "text-amber-300" : "text-white/90"}`}>
                                  {displayVal}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Parameters Table */}
                    {selectedLog.parameters && Object.keys(selectedLog.parameters).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-white/80">Model Inference Parameters</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(selectedLog.parameters).map(([k, v]) => (
                            <div key={k} className="rounded bg-black/40 border border-white/5 p-2 font-mono">
                              <span className="text-[10px] text-white/40 block">{k}</span>
                              <span className="text-xs text-white font-semibold">
                                {v === undefined || v === null ? "default" : String(v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Raw Request JSON Payload */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white/80">Raw Request Payload</span>
                        {selectedLog.rawRequestBody && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(formatJson(selectedLog.rawRequestBody), "raw_req")
                            }
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "raw_req" ? "Copied" : "Copy JSON"}
                          </button>
                        )}
                      </div>
                      <textarea
                        readOnly
                        rows={7}
                        value={formatJson(selectedLog.rawRequestBody)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* ── 3. RESPONSE PAYLOAD VIEW ── */}
                {detailTab === "response" && (
                  <div className="flex flex-col gap-4">
                    {/* Status row */}
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/60">HTTP Status:</span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono font-bold border ${getStatusColor(
                            selectedLog.status,
                            selectedLog.error
                          )}`}
                        >
                          {selectedLog.status} {selectedLog.statusText || ""}
                        </span>
                      </div>
                      <span className="font-mono text-white/40 text-[11px]">
                        {selectedLog.durationMs !== undefined ? `${selectedLog.durationMs}ms latency` : ""}
                      </span>
                    </div>

                    {/* Response Headers */}
                    {selectedLog.responseHeaders && Object.keys(selectedLog.responseHeaders).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-white/80">Response Headers</span>
                        <div className="rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] overflow-x-auto max-h-36">
                          {Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-white/40 select-all shrink-0">{k}:</span>
                              <span className="text-white/90 select-all break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Response Body */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white/80">Response Payload</span>
                        {selectedLog.rawResponseBody && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(formatJson(selectedLog.rawResponseBody), "raw_res")
                            }
                            className="text-[11px] text-white/40 hover:text-white"
                          >
                            {copiedKey === "raw_res" ? "Copied" : "Copy JSON"}
                          </button>
                        )}
                      </div>
                      <textarea
                        readOnly
                        rows={10}
                        value={formatJson(selectedLog.rawResponseBody)}
                        className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* ── 4. DIAGNOSTICS & ISSUE RESOLVER ── */}
                {detailTab === "diagnostics" && (
                  <div className="flex flex-col gap-4">
                    {selectedLog.error || selectedLog.status >= 400 || selectedLog.status === 0 ? (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-300 flex flex-col gap-2">
                          <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
                            <span className="material-symbols-outlined">warning</span>
                            <span>Incident Diagnosis & Root Cause</span>
                          </div>
                          <p className="font-mono text-xs font-semibold select-all">
                            {selectedLog.error || `HTTP ${selectedLog.status} Error`}
                          </p>
                        </div>

                        {/* Breakdown Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                            <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">
                              Failing Provider Node
                            </span>
                            <span className="font-mono font-bold text-white text-xs">
                              {selectedLog.providerDisplay || selectedLog.provider}
                            </span>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                            <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">
                              Failing Model
                            </span>
                            <span className="font-mono font-bold text-white text-xs">
                              {selectedLog.model}
                            </span>
                          </div>
                        </div>

                        {/* Recommended Fixes based on status code */}
                        <div className="rounded-xl border border-white/10 bg-[#121212] p-4 flex flex-col gap-2">
                          <h4 className="font-semibold text-white flex items-center gap-1.5 text-xs">
                            <span className="material-symbols-outlined text-primary text-sm">tips_and_updates</span>
                            Suggested Remediation Actions:
                          </h4>
                          <ul className="text-xs text-white/70 space-y-1.5 list-disc pl-4 font-sans">
                            {selectedLog.status === 404 ? (
                              <>
                                <li>The upstream provider rejected model <strong>{selectedLog.model}</strong> as not found.</li>
                                <li>Verify that your upstream Base URL supports <code>/v1/chat/completions</code> or <code>/v1/models</code>.</li>
                                <li>In the provider&apos;s detail page, click <strong>&quot;Fetch All Models&quot;</strong> to inspect the exact upstream supported IDs.</li>
                              </>
                            ) : selectedLog.status === 429 ? (
                              <>
                                <li>Upstream rate limit or quota exceeded on <strong>{selectedLog.provider}</strong>.</li>
                                <li>If this provider has multiple API keys, configure dual-auth or enable Combo routing with auto-fallback.</li>
                                <li>The provider connection cooldown tracker has automatically set a backoff cooldown.</li>
                              </>
                            ) : selectedLog.status === 401 || selectedLog.status === 403 ? (
                              <>
                                <li>Authentication failed or permissions denied on <strong>{selectedLog.provider}</strong>.</li>
                                <li>Verify the API key or bearer token configured in Provider Settings.</li>
                                <li>If using Cloudflare or corporate proxy, check if IP blocking or custom headers are required.</li>
                              </>
                            ) : selectedLog.status >= 500 ? (
                              <>
                                <li>Upstream provider server error or gateway timeout.</li>
                                <li>CheapRoute&apos;s Circuit Breaker will automatically route future requests to alternative fallback targets.</li>
                              </>
                            ) : (
                              <>
                                <li>Inspect the Raw Response tab for additional upstream error traces.</li>
                                <li>Check network connectivity to the upstream Base URL: <code>{selectedLog.baseUrl}</code>.</li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 flex items-center gap-3">
                        <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
                        <div>
                          <h4 className="font-bold text-white text-xs">Healthy Request Execution</h4>
                          <p className="text-[11px] text-emerald-400/90 mt-0.5">
                            Model <strong>{selectedLog.model}</strong> executed successfully on provider{" "}
                            <strong>{selectedLog.providerDisplay || selectedLog.provider}</strong> with 0 errors.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── 5. RAW TELEMETRY JSON ── */}
                {detailTab === "raw" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white/80">Complete Telemetry Object</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), "raw_telemetry")}
                        className="text-[11px] text-white/40 hover:text-white"
                      >
                        {copiedKey === "raw_telemetry" ? "Copied" : "Copy All JSON"}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      rows={14}
                      value={JSON.stringify(selectedLog, null, 2)}
                      className="w-full rounded-lg border border-white/10 bg-black/60 p-2.5 font-mono text-[11px] text-white/90 resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-xs text-white/40">
              Select an AI model call from the left to inspect conversation, headers, and responses
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
