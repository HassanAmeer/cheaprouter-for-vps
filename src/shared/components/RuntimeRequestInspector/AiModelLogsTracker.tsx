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

  // Stream details
  isStreaming?: boolean;
  streamChunks?: { provider?: string[]; openai?: string[]; client?: string[] } | null;

  // Status
  detailsLoaded?: boolean;
}

interface AiModelLogsTrackerProps {
  clientLogs: CapturedRequestLog[];
}

type DetailTab = "response" | "request" | "headers" | "raw";

function parseServerCallLogs(data: any[]): AiModelLogItem[] {
  return data.map((row: any) => {
    const time = row.timestamp ? new Date(row.timestamp) : new Date();
    const timeDisplay = !isNaN(time.getTime())
      ? time.toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) +
        "." +
        String(time.getMilliseconds()).padStart(3, "0")
      : String(row.timestamp || "");

    const tokensIn = row.tokens?.in ?? row.tokensIn ?? 0;
    const tokensOut = row.tokens?.out ?? row.tokensOut ?? 0;
    const status = Number(row.status || 0);

    const isStreaming = Boolean(
      row.isStreaming ||
      (row.requestBody && typeof row.requestBody === "object" && row.requestBody.stream) ||
      (row.streamChunks && (row.streamChunks.provider?.length || row.streamChunks.client?.length))
    );

    return {
      id: String(row.id || Math.random()),
      timestamp: String(row.timestamp || new Date().toISOString()),
      timeDisplay,
      status,
      statusText: row.statusText || (status === 200 ? "OK" : status ? `HTTP ${status}` : "Pending"),
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
      baseUrl: row.path || row.endpoint || null,
      rawRequestBody: row.requestBody ?? null,
      rawResponseBody: row.responseBody ?? null,
      isStreaming,
      streamChunks: row.streamChunks ?? null,
    };
  });
}

export default function AiModelLogsTracker({ clientLogs }: AiModelLogsTrackerProps) {
  const [serverLogs, setServerLogs] = useState<AiModelLogItem[]>([]);
  const [loadingServerLogs, setLoadingServerLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "errors" | "success">("all");
  const [activeTab, setActiveTab] = useState<DetailTab>("response");
  const [mobileView, setMobileView] = useState<"list" | "details">("details");
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
      const res = await fetch("/api/usage/call-logs?limit=50", {
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
        const res = await fetch("/api/usage/call-logs?limit=50", {
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
    const interval = setInterval(run, 3000);
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
        (typeof parsedReq === "object" &&
          (parsedReq?.modelId || parsedReq?.model || parsedReq?.requestedModel)) ||
        (typeof parsedRes === "object" && parsedRes?.model) ||
        null;
      if (!model && log.pathname.includes("/providers/")) {
        const parts = log.pathname.split("/");
        const provIdx = parts.indexOf("providers");
        if (provIdx !== -1 && parts[provIdx + 1]) {
          model = decodeURIComponent(parts[provIdx + 1]);
        }
      }

      // Extract provider
      let provider = "cheaproute";
      if (typeof parsedReq === "object" && (parsedReq?.providerId || parsedReq?.provider)) {
        provider = String(parsedReq.providerId || parsedReq.provider);
      } else if (log.pathname.includes("/providers/")) {
        const parts = log.pathname.split("/");
        const idx = parts.indexOf("providers");
        if (idx !== -1 && parts[idx + 1]) {
          provider = decodeURIComponent(parts[idx + 1]);
        }
      }

      // Extract messages and prompts
      const messagesList: Array<{ role: string; content: string }> = [];
      let userMsg: string | null = null;
      let sysMsg: string | null = null;

      if (typeof parsedReq?.prompt === "string") {
        userMsg = parsedReq.prompt;
        messagesList.push({ role: "user", content: parsedReq.prompt });
      } else if (Array.isArray(parsedReq?.messages)) {
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
      }

      // Extract assistant response or error
      let assistantMsg: string | null = null;
      let status = Number(log.status || 0);
      let errorMsg: string | null = log.error || null;

      if (typeof parsedRes === "object" && parsedRes !== null) {
        if (parsedRes.status === "ok" && parsedRes.responseText) {
          assistantMsg = parsedRes.responseText;
          if (!status) status = 200;
        } else if (parsedRes.status === "error" || parsedRes.error) {
          errorMsg =
            typeof parsedRes.error === "string"
              ? parsedRes.error
              : parsedRes.error?.message || JSON.stringify(parsedRes.error);
          if (parsedRes.statusCode) status = parsedRes.statusCode;
          else if (!status || status === 200) status = 400;
        } else if (Array.isArray(parsedRes.choices) && parsedRes.choices[0]) {
          const ch = parsedRes.choices[0];
          assistantMsg =
            ch.message?.content || ch.text || (ch.delta?.content ? String(ch.delta.content) : null);
          if (!status) status = 200;
        } else if (typeof parsedRes.text === "string") {
          assistantMsg = parsedRes.text;
        }
      } else if (typeof parsedRes === "string") {
        assistantMsg = parsedRes;
      }

      const isStreaming = Boolean(
        (parsedReq && typeof parsedReq === "object" && parsedReq.stream === true) ||
        (log.responseHeaders && log.responseHeaders["content-type"]?.includes("text/event-stream"))
      );

      results.push({
        id: "client_" + log.id,
        timestamp: log.timestamp,
        timeDisplay: log.timestamp,
        status,
        statusText:
          log.statusText || (status === 200 ? "OK" : status ? `HTTP ${status}` : "Pending"),
        provider,
        providerDisplay: provider,
        model: model || "unknown-model",
        durationMs: log.durationMs,
        error: errorMsg,
        source: "client-runtime",
        userMessage: userMsg,
        systemPrompt: sysMsg,
        messages: messagesList.length > 0 ? messagesList : undefined,
        assistantResponse: assistantMsg,
        baseUrl: log.pathname || log.url,
        requestHeaders: log.requestHeaders,
        responseHeaders: log.responseHeaders,
        rawRequestBody: parsedReq,
        rawResponseBody: parsedRes,
        isStreaming,
      });
    }

    return results;
  }, [clientLogs]);

  // ── 3. Combined Logs (Recent Calls First) ──────────────────────────────
  const allLogs = useMemo(() => {
    const seen = new Set<string>();
    const merged: AiModelLogItem[] = [];

    // Client logs first
    for (const cl of clientAiLogs) {
      merged.push(cl);
      seen.add(cl.id);
    }

    // Server logs next
    for (const sl of serverLogs) {
      if (!seen.has(sl.id)) {
        merged.push(sl);
        seen.add(sl.id);
      }
    }

    return merged;
  }, [clientAiLogs, serverLogs]);

  // Status Counts
  const errorCount = useMemo(
    () => allLogs.filter((l) => l.status >= 400 || Boolean(l.error)).length,
    [allLogs]
  );
  const successCount = useMemo(
    () => allLogs.filter((l) => l.status >= 200 && l.status < 300 && !l.error).length,
    [allLogs]
  );

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let list = allLogs;
    if (statusFilter === "errors") {
      list = list.filter((l) => l.status >= 400 || Boolean(l.error));
    } else if (statusFilter === "success") {
      list = list.filter((l) => l.status >= 200 && l.status < 300 && !l.error);
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((log) => {
      const matchModel = log.model.toLowerCase().includes(q);
      const matchProvider = (log.providerDisplay || log.provider).toLowerCase().includes(q);
      const matchUser = (log.userMessage || "").toLowerCase().includes(q);
      const matchAsst = (log.assistantResponse || "").toLowerCase().includes(q);
      const matchErr = (log.error || "").toLowerCase().includes(q);
      const matchStatus = String(log.status).includes(q);
      const matchUrl = (log.baseUrl || "").toLowerCase().includes(q);
      return (
        matchModel || matchProvider || matchUser || matchAsst || matchErr || matchStatus || matchUrl
      );
    });
  }, [allLogs, search, statusFilter]);

  // Active selected log (default to latest)
  const selectedLog: AiModelLogItem | null = useMemo(() => {
    const raw = selectedId
      ? allLogs.find((l) => l.id === selectedId) || filteredLogs[0] || null
      : filteredLogs[0] || null;
    if (!raw) return null;
    const cached = detailedCache[raw.id];
    if (cached) {
      return { ...raw, ...cached, detailsLoaded: true };
    }
    return raw;
  }, [allLogs, filteredLogs, selectedId, detailedCache]);

  // Auto-fetch full details for server call log if not cached
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

        const rawReq = providerReq.body || clientReq.body || data.requestBody || clientReq;
        const rawRes =
          providerRes.body || providerRes || clientRes.body || clientRes || data.responseBody;

        let uMsg: string | null = null;
        let sPrompt: string | null = null;
        const msgs: Array<{ role: string; content: string }> = [];

        let bodyObj = rawReq;
        if (typeof bodyObj === "string") {
          try {
            bodyObj = JSON.parse(bodyObj);
          } catch {}
        }

        if (typeof bodyObj === "object" && bodyObj !== null) {
          if (typeof bodyObj.prompt === "string") {
            uMsg = bodyObj.prompt;
            msgs.push({ role: "user", content: bodyObj.prompt });
          } else if (Array.isArray(bodyObj.messages)) {
            for (const m of bodyObj.messages) {
              const content =
                typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2);
              msgs.push({ role: m.role || "user", content });
              if (m.role === "user") uMsg = content;
              if (m.role === "system") sPrompt = content;
            }
          }
        }

        let asstMsg: string | null = null;
        if (data.partialAssistantText) {
          asstMsg = data.partialAssistantText;
        } else {
          let resObj = rawRes;
          if (typeof resObj === "string") {
            try {
              resObj = JSON.parse(resObj);
            } catch {}
          }
          if (typeof resObj === "object" && resObj !== null) {
            if (Array.isArray(resObj.choices) && resObj.choices[0]) {
              const ch = resObj.choices[0];
              asstMsg =
                ch.message?.content ||
                ch.text ||
                (ch.delta?.content ? String(ch.delta.content) : null);
            } else if (typeof resObj.responseText === "string") {
              asstMsg = resObj.responseText;
            } else if (typeof resObj.text === "string") {
              asstMsg = resObj.text;
            }
          } else if (typeof resObj === "string") {
            asstMsg = resObj;
          }
        }

        const isStreaming = Boolean(
          data.isStreaming ||
          (bodyObj && typeof bodyObj === "object" && bodyObj.stream === true) ||
          (data.streamChunks &&
            (data.streamChunks.provider?.length || data.streamChunks.client?.length))
        );

        const detailsPatch: Partial<AiModelLogItem> = {
          userMessage: uMsg,
          systemPrompt: sPrompt,
          messages: msgs.length > 0 ? msgs : undefined,
          baseUrl:
            providerReq.url ||
            providerReq.endpoint ||
            clientReq.url ||
            data.path ||
            data.endpoint ||
            null,
          requestHeaders: providerReq.headers || clientReq.headers || data.requestHeaders || {},
          responseHeaders: providerRes.headers || clientRes.headers || data.responseHeaders || {},
          rawRequestBody: rawReq,
          rawResponseBody: rawRes,
          assistantResponse: asstMsg,
          error: data.error || selectedLog.error,
          errorType: data.errorType || selectedLog.errorType,
          status: data.status || selectedLog.status,
          model: data.model || selectedLog.model,
          provider: data.provider || selectedLog.provider,
          isStreaming,
          streamChunks: data.streamChunks ?? null,
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
    if (!val) return "{}";
    if (typeof val === "string") {
      try {
        return JSON.stringify(JSON.parse(val), null, 2);
      } catch {
        return val;
      }
    }
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  const maskKey = (keyStr: string) => {
    if (!keyStr) return "";
    if (revealApiKey) return keyStr;
    if (keyStr.length <= 10) return "sk-••••••••";
    return keyStr.slice(0, 7) + "••••••••" + keyStr.slice(-4);
  };

  const getStatusColor = (status: number, error?: string | null) => {
    if (error || status >= 500 || status === 0)
      return "bg-red-500/20 text-red-400 border-red-500/30";
    if (status === 429) return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (status >= 400) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (status >= 200 && status < 300)
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-white/10 text-white/70 border-white/20";
  };

  // Build complete unified log report for Copy All
  const getFullLogReport = (log: AiModelLogItem) => {
    return JSON.stringify(
      {
        telemetry: {
          id: log.id,
          timestamp: log.timestamp,
          timeDisplay: log.timeDisplay,
          provider: log.providerDisplay || log.provider,
          model: log.model,
          requestedModel: log.requestedModel,
          comboName: log.comboName,
          endpoint: log.baseUrl,
          status: log.status,
          statusText: log.statusText,
          durationMs: log.durationMs,
          isStreaming: Boolean(log.isStreaming),
          tokens: {
            in: log.tokensIn,
            out: log.tokensOut,
            total: log.tokensTotal,
          },
          error: log.error,
          errorType: log.errorType,
          source: log.source,
        },
        request: {
          endpoint: log.baseUrl,
          method: "POST",
          model: log.model,
          stream: Boolean(log.isStreaming),
          userPrompt: log.userMessage,
          systemPrompt: log.systemPrompt,
          messages: log.messages,
          headers: log.requestHeaders || {},
          body: log.rawRequestBody || {},
        },
        response: {
          status: log.status,
          error: log.error,
          assistantText: log.assistantResponse,
          headers: log.responseHeaders || {},
          body: log.rawResponseBody || {},
          streamChunksCount:
            log.streamChunks?.provider?.length || log.streamChunks?.client?.length || 0,
        },
      },
      null,
      2
    );
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#141416] text-white">
      {/* ── Compact Search & Micro-Filters Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/[0.08] bg-[#1C1C1E]/80 backdrop-blur-xl px-2.5 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2 top-1.5 text-[14px] text-white/40">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by model, provider, error..."
              className="w-full h-6 rounded-md border border-white/10 bg-[#2C2C2E]/60 pl-6 pr-5 text-[11px] text-white placeholder-white/40 focus:border-white/30 focus:bg-[#2C2C2E] focus:outline-none transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1 size-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] text-white/70 hover:bg-white/30 hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          {/* Micro Status Filter Pills */}
          <div className="flex items-center rounded-md bg-[#2C2C2E] p-0.5 border border-white/[0.06] text-[10px]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-1.5 py-0.5 rounded transition-all ${
                statusFilter === "all"
                  ? "bg-white/20 text-white font-semibold"
                  : "text-white/50 hover:text-white"
              }`}
            >
              All ({allLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("errors")}
              className={`px-1.5 py-0.5 rounded transition-all ${
                statusFilter === "errors"
                  ? "bg-red-500/30 text-red-300 font-semibold"
                  : "text-red-400/60 hover:text-red-300"
              }`}
            >
              Err ({errorCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("success")}
              className={`px-1.5 py-0.5 rounded transition-all ${
                statusFilter === "success"
                  ? "bg-emerald-500/30 text-emerald-300 font-semibold"
                  : "text-emerald-400/60 hover:text-emerald-300"
              }`}
            >
              200 ({successCount})
            </button>
          </div>
        </div>

        {/* Live & Refresh Micro Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`inline-flex items-center gap-1 h-6 rounded-md border px-2 text-[10px] font-medium transition-all active:scale-95 cursor-pointer ${
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-white/10 bg-[#2C2C2E] text-white/50 hover:text-white"
            }`}
            title={autoRefresh ? "Auto-refreshing every 3s" : "Auto-refresh paused"}
          >
            <span
              className={`inline-block size-1.5 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-white/40"
              }`}
            />
            <span>{autoRefresh ? "Live 3s" : "Paused"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleManualRefresh()}
            disabled={loadingServerLogs}
            className="inline-flex items-center gap-1 h-6 rounded-md border border-white/10 bg-[#2C2C2E] px-2 text-[10px] font-medium text-white/80 hover:bg-[#3A3A3C] hover:text-white active:scale-95 disabled:opacity-40 cursor-pointer transition-all"
            title="Refresh now"
          >
            <span
              className={`material-symbols-outlined text-[12px] ${
                loadingServerLogs ? "animate-spin" : ""
              }`}
            >
              refresh
            </span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Main Workspace: Compact Split View ── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        {/* Left Column: Compact Cupertino List View */}
        <div
          className={`${
            mobileView === "list" ? "flex" : "hidden"
          } md:flex flex-col w-full md:w-[180px] lg:w-[200px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.08] overflow-y-auto bg-[#18181A] custom-scrollbar`}
        >
          <div className="px-2.5 py-1.5 border-b border-white/[0.06] bg-[#1C1C1E]/60 flex items-center justify-between text-[10px] text-white/50 shrink-0">
            <span className="font-semibold uppercase tracking-wider text-[9px] text-white/40">
              Calls List
            </span>
            <span className="font-mono text-white/60">{filteredLogs.length} total</span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-white/40">
              <span className="material-symbols-outlined text-2xl mb-1 text-white/20">inbox</span>
              <p className="text-[11px] font-medium text-white/50">No calls found</p>
            </div>
          ) : (
            <div className="p-1 space-y-0.5">
              {filteredLogs.map((log) => {
                const isSelected = selectedLog?.id === log.id;
                const isError = log.status >= 400 || Boolean(log.error);

                return (
                  <div
                    key={log.id}
                    onClick={() => {
                      setSelectedId(log.id);
                      setMobileView("details");
                    }}
                    className={`group flex flex-col gap-0.5 px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-white/[0.14] border-white/25 text-white shadow-xs ring-1 ring-primary/40"
                        : isError
                          ? "bg-red-500/[0.06] border-red-500/20 hover:bg-red-500/12 text-white/90"
                          : "bg-transparent border-transparent hover:bg-white/[0.05] text-white/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${
                            isError ? "bg-red-400" : "bg-emerald-400"
                          }`}
                        />
                        <span className="font-semibold text-[11px] truncate text-white">
                          {log.providerDisplay || log.provider}
                        </span>
                      </div>
                      <span
                        className={`rounded px-1 py-0.2 font-mono text-[9px] font-bold border shrink-0 ${getStatusColor(
                          log.status,
                          log.error
                        )}`}
                      >
                        {log.error ? (log.status ? `${log.status}` : "ERR") : log.status || "..."}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] text-white/50">
                      <span className="font-mono truncate text-white/70 text-[10px]">
                        {log.model}
                      </span>
                      <span className="font-mono text-[9px] text-white/40 shrink-0">
                        {log.durationMs !== undefined
                          ? `${log.durationMs}ms`
                          : log.timeDisplay.slice(-8)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tabbed Inspector Details */}
        <div
          className={`${
            mobileView === "details" ? "flex" : "hidden"
          } md:flex flex-1 flex-col overflow-hidden bg-[#141416]`}
        >
          {/* Mobile Back Header */}
          <div className="md:hidden flex items-center justify-between p-2 border-b border-white/[0.08] bg-[#1C1C1E]">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2C2C2E] text-[11px] font-semibold text-primary active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">arrow_back</span>
              <span>Calls ({filteredLogs.length})</span>
            </button>
            <span className="text-[10px] text-white/40 font-mono">{selectedLog?.timeDisplay}</span>
          </div>

          {!selectedLog ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-white/40">
              <span className="material-symbols-outlined text-4xl mb-1 text-white/20">
                receipt_long
              </span>
              <p className="font-semibold text-white/60 text-xs">No call selected</p>
              <p className="text-[11px] text-white/40 mt-0.5 max-w-xs">
                Select a call from the left list to inspect telemetry, request, response, and
                headers.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
              {/* ── 1. Top Identity & Metadata Bar (Cupertino Micro Header) ── */}
              <div className="border-b border-white/[0.08] bg-[#1C1C1E]/90 px-3 py-2 flex flex-col gap-2 shrink-0">
                {/* Row 1: Model & Provider Identification + Global Copy Action */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="rounded-md bg-primary/20 border border-primary/30 px-2 py-0.5 text-[11px] font-bold text-primary flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[12px]">hub</span>
                      {selectedLog.providerDisplay || selectedLog.provider}
                    </span>
                    <span
                      className="rounded-md bg-white/10 border border-white/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-white flex items-center gap-1 truncate max-w-[240px]"
                      title={selectedLog.model}
                    >
                      <span className="material-symbols-outlined text-[12px] shrink-0">
                        smart_toy
                      </span>
                      <span className="truncate">{selectedLog.model}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(getFullLogReport(selectedLog), "copy_all_report")
                    }
                    className="inline-flex items-center gap-1 h-6.5 rounded-md border border-white/10 bg-[image:var(--grad-brand)] hover:brightness-105 px-2 text-[11px] font-semibold text-white transition-all active:scale-95 cursor-pointer shadow-xs shrink-0"
                    title="Copy full telemetry, request, response & headers JSON"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedKey === "copy_all_report" ? "check" : "content_copy"}
                    </span>
                    <span>{copiedKey === "copy_all_report" ? "Copied All!" : "Copy All"}</span>
                  </button>
                </div>

                {/* Row 2: Status & Telemetry Metrics + Timestamp */}
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span
                      className={`rounded-md px-2 py-0.5 font-bold border shrink-0 ${getStatusColor(
                        selectedLog.status,
                        selectedLog.error
                      )}`}
                    >
                      {selectedLog.error
                        ? selectedLog.status
                          ? `HTTP ${selectedLog.status} Failed`
                          : "Failed"
                        : `HTTP ${selectedLog.status || 200} ${selectedLog.statusText || "OK"}`}
                    </span>
                    {selectedLog.durationMs !== undefined && (
                      <span className="rounded-md bg-black/40 border border-white/10 px-2 py-0.5 text-white/70 shrink-0">
                        {selectedLog.durationMs}ms
                      </span>
                    )}
                    <span className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-white/60 flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-[11px]">
                        {selectedLog.isStreaming ? "stream" : "sync_alt"}
                      </span>
                      {selectedLog.isStreaming ? "SSE Stream" : "Sync"}
                    </span>
                    {selectedLog.tokensTotal ? (
                      <span className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-white/50 shrink-0">
                        {selectedLog.tokensIn} in / {selectedLog.tokensOut} out
                      </span>
                    ) : null}
                  </div>

                  <span className="text-white/40 shrink-0 select-none">
                    {selectedLog.timeDisplay}
                  </span>
                </div>

                {/* Row 3: Endpoint URL */}
                <div className="flex items-center gap-1 text-[10px] text-white/50 font-mono truncate min-w-0">
                  <span className="text-white/30 shrink-0">Endpoint:</span>
                  <span
                    onClick={() => copyToClipboard(selectedLog.baseUrl || "", "copy_endpoint")}
                    className="text-white/80 hover:text-primary transition-colors cursor-pointer truncate select-all"
                    title="Click to copy endpoint"
                  >
                    {selectedLog.baseUrl || "/v1/chat/completions"}
                  </span>
                  {copiedKey === "copy_endpoint" && (
                    <span className="text-[9px] text-emerald-400 shrink-0">Copied</span>
                  )}
                </div>
              </div>

              {/* ── 2. Cupertino Segmented Tabs Control ── */}
              <div className="px-3 py-1.5 border-b border-white/[0.08] bg-[#18181A] shrink-0">
                <div className="flex p-0.5 bg-[#2C2C2E]/90 rounded-lg border border-white/[0.06] gap-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setActiveTab("response")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "response"
                        ? "bg-[#3A3A3C] text-white shadow-xs border border-white/10"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px] text-emerald-400">
                      arrow_downward
                    </span>
                    <span>Response</span>
                    {selectedLog.error && (
                      <span className="size-1.5 rounded-full bg-red-400 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "request"
                        ? "bg-[#3A3A3C] text-white shadow-xs border border-white/10"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px] text-sky-400">
                      arrow_upward
                    </span>
                    <span>Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("headers")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "headers"
                        ? "bg-[#3A3A3C] text-white shadow-xs border border-white/10"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px] text-amber-400">
                      tune
                    </span>
                    <span>Headers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("raw")}
                    className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                      activeTab === "raw"
                        ? "bg-[#3A3A3C] text-white shadow-xs border border-white/10"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px] text-purple-400">
                      code
                    </span>
                    <span>Full JSON</span>
                  </button>
                </div>
              </div>

              {/* ── 3. Tab Contents Workspace (Scrollable) ── */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2.5">
                {/* ────── TAB 1: RESPONSE ────── */}
                {activeTab === "response" && (
                  <div className="space-y-2.5">
                    {/* Error Banner */}
                    {selectedLog.error && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-red-300 flex flex-col gap-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-red-400 text-xs">
                            <span className="material-symbols-outlined text-[15px]">error</span>
                            <span>
                              Error ({selectedLog.status ? `HTTP ${selectedLog.status}` : "Failed"})
                            </span>
                            {selectedLog.errorType && (
                              <span className="text-[10px] text-red-400/70 font-mono font-normal">
                                [{selectedLog.errorType}]
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(selectedLog.error || "", "copy_err_text")
                            }
                            className="text-[10px] text-red-400/80 hover:text-red-200 underline cursor-pointer"
                          >
                            {copiedKey === "copy_err_text" ? "Copied" : "Copy Error"}
                          </button>
                        </div>
                        <p className="font-mono text-[11px] select-all whitespace-pre-wrap break-all leading-relaxed">
                          {selectedLog.error}
                        </p>
                      </div>
                    )}

                    {/* Assistant Generated Text */}
                    {selectedLog.assistantResponse && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5 flex flex-col gap-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                            Generated Assistant Output
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(selectedLog.assistantResponse || "", "copy_asst_text")
                            }
                            className="text-[10px] text-emerald-400 hover:text-emerald-200 underline cursor-pointer"
                          >
                            {copiedKey === "copy_asst_text" ? "Copied" : "Copy Text"}
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-white/90 select-all whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed custom-scrollbar bg-black/30 p-2 rounded-lg border border-white/[0.04]">
                          {selectedLog.assistantResponse}
                        </div>
                      </div>
                    )}

                    {/* Stream Info (if streamed) */}
                    {selectedLog.isStreaming && (
                      <div className="rounded-lg border border-white/[0.08] bg-[#1C1C1E] px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-white/60 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-primary">
                            stream
                          </span>
                          Streaming Mode: Server-Sent Events (SSE)
                        </span>
                        {selectedLog.streamChunks && (
                          <span className="text-[10px] font-mono text-white/40">
                            {selectedLog.streamChunks.provider?.length ||
                              selectedLog.streamChunks.client?.length ||
                              0}{" "}
                            chunks
                          </span>
                        )}
                      </div>
                    )}

                    {/* Complete Raw Response Body */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/80 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-white/50">
                            data_object
                          </span>
                          Complete Raw Response Body (JSON)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              formatJson(selectedLog.rawResponseBody),
                              "copy_res_body"
                            )
                          }
                          className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[10px] font-medium text-white transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            {copiedKey === "copy_res_body" ? "check" : "content_copy"}
                          </span>
                          <span>{copiedKey === "copy_res_body" ? "Copied" : "Copy Response"}</span>
                        </button>
                      </div>
                      <pre className="rounded-lg border border-white/[0.04] bg-[#101012] p-2.5 font-mono text-[10px] leading-relaxed text-white/90 overflow-x-auto max-h-72 select-all whitespace-pre break-all custom-scrollbar">
                        {formatJson(selectedLog.rawResponseBody)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* ────── TAB 2: REQUEST ────── */}
                {activeTab === "request" && (
                  <div className="space-y-2.5">
                    {/* User Prompt / Messages */}
                    {selectedLog.messages && selectedLog.messages.length > 0 ? (
                      <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-sky-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">chat</span>
                            Messages Array ({selectedLog.messages.length})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                JSON.stringify(selectedLog.messages, null, 2),
                                "copy_messages"
                              )
                            }
                            className="text-[10px] text-sky-400 hover:text-sky-200 underline cursor-pointer"
                          >
                            {copiedKey === "copy_messages" ? "Copied" : "Copy Messages"}
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                          {selectedLog.messages.map((m, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg p-2 text-[11px] font-mono leading-relaxed select-all ${
                                m.role === "user"
                                  ? "bg-sky-500/10 border border-sky-500/20 text-sky-100"
                                  : m.role === "system"
                                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-100"
                                    : "bg-white/5 border border-white/10 text-white/90"
                              }`}
                            >
                              <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 block mb-0.5">
                                {m.role}:
                              </span>
                              <p className="whitespace-pre-wrap break-all">{m.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : selectedLog.userMessage ? (
                      <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-sky-400">
                            User Input Prompt
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(selectedLog.userMessage || "", "copy_user_prompt")
                            }
                            className="text-[10px] text-sky-400 hover:text-sky-200 underline cursor-pointer"
                          >
                            {copiedKey === "copy_user_prompt" ? "Copied" : "Copy Prompt"}
                          </button>
                        </div>
                        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-2 font-mono text-[11px] text-sky-100 select-all whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                          {selectedLog.userMessage}
                        </div>
                      </div>
                    ) : null}

                    {/* System Prompt if available */}
                    {selectedLog.systemPrompt && (
                      <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1 shadow-xs">
                        <span className="text-[11px] font-semibold text-amber-400">
                          System Instructions
                        </span>
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 font-mono text-[11px] text-amber-100 select-all whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                          {selectedLog.systemPrompt}
                        </div>
                      </div>
                    )}

                    {/* Complete Raw Request Body */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white/80 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-white/50">
                            payload
                          </span>
                          Complete Raw Request Body (JSON)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(formatJson(selectedLog.rawRequestBody), "copy_req_body")
                          }
                          className="inline-flex items-center gap-1 h-5.5 px-2 rounded-md bg-[#2C2C2E] hover:bg-[#3A3A3C] text-[10px] font-medium text-white transition-all active:scale-95 cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-[11px]">
                            {copiedKey === "copy_req_body" ? "check" : "content_copy"}
                          </span>
                          <span>{copiedKey === "copy_req_body" ? "Copied" : "Copy Request"}</span>
                        </button>
                      </div>
                      <pre className="rounded-lg border border-white/[0.04] bg-[#101012] p-2.5 font-mono text-[10px] leading-relaxed text-white/90 overflow-x-auto max-h-72 select-all whitespace-pre break-all custom-scrollbar">
                        {formatJson(selectedLog.rawRequestBody)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* ────── TAB 3: HEADERS ────── */}
                {activeTab === "headers" && (
                  <div className="space-y-2.5">
                    {/* Header Controls Bar */}
                    <div className="flex items-center justify-between text-xs pb-0.5">
                      <span className="text-[11px] font-semibold text-white/80">
                        Upstream HTTP Headers
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRevealApiKey((prev) => !prev)}
                          className="h-5.5 px-2 rounded bg-[#2C2C2E] text-[10px] font-medium text-primary hover:bg-[#3A3A3C] cursor-pointer transition-colors"
                        >
                          {revealApiKey ? "Mask Keys" : "Reveal API Keys"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(
                                {
                                  requestHeaders: selectedLog.requestHeaders || {},
                                  responseHeaders: selectedLog.responseHeaders || {},
                                },
                                null,
                                2
                              ),
                              "copy_all_headers"
                            )
                          }
                          className="h-5.5 px-2 rounded bg-[#2C2C2E] text-[10px] font-medium text-white/70 hover:text-white cursor-pointer transition-colors"
                        >
                          {copiedKey === "copy_all_headers" ? "Copied" : "Copy Headers"}
                        </button>
                      </div>
                    </div>

                    {/* Request Headers */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1.5 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        Request Headers Sent (
                        {selectedLog.requestHeaders
                          ? Object.keys(selectedLog.requestHeaders).length
                          : 0}
                        )
                      </span>
                      <div className="rounded-lg border border-white/[0.04] bg-[#101012] p-2 font-mono text-[10px] max-h-48 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {!selectedLog.requestHeaders ||
                        Object.keys(selectedLog.requestHeaders).length === 0 ? (
                          <span className="text-white/40 italic">No request headers captured</span>
                        ) : (
                          Object.entries(selectedLog.requestHeaders).map(([k, v]) => {
                            const isAuth =
                              k.toLowerCase().includes("auth") ||
                              k.toLowerCase().includes("key") ||
                              k.toLowerCase().includes("token");
                            const displayVal = isAuth ? maskKey(v) : v;

                            return (
                              <div key={k} className="flex gap-2 py-0.5">
                                <span className="text-white/40 shrink-0 select-all">{k}:</span>
                                <span
                                  className={`select-all break-all ${
                                    isAuth ? "text-amber-300 font-semibold" : "text-white/90"
                                  }`}
                                >
                                  {displayVal}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Response Headers */}
                    <div className="rounded-xl border border-white/[0.08] bg-[#1C1C1E] p-2.5 flex flex-col gap-1.5 shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Response Headers Received (
                        {selectedLog.responseHeaders
                          ? Object.keys(selectedLog.responseHeaders).length
                          : 0}
                        )
                      </span>
                      <div className="rounded-lg border border-white/[0.04] bg-[#101012] p-2 font-mono text-[10px] max-h-48 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {!selectedLog.responseHeaders ||
                        Object.keys(selectedLog.responseHeaders).length === 0 ? (
                          <span className="text-white/40 italic">No response headers captured</span>
                        ) : (
                          Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2 py-0.5">
                              <span className="text-white/40 shrink-0 select-all">{k}:</span>
                              <span className="text-white/90 select-all break-all">{v}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ────── TAB 4: RAW FULL REPORT ────── */}
                {activeTab === "raw" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/80">
                        Unified Call Report (Sender + Receiver)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(getFullLogReport(selectedLog), "copy_raw_full")
                        }
                        className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md bg-[image:var(--grad-brand)] text-white hover:brightness-105 border border-white/10 text-[10px] font-semibold active:scale-95 cursor-pointer shadow-xs transition-all"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {copiedKey === "copy_raw_full" ? "check" : "content_copy"}
                        </span>
                        <span>
                          {copiedKey === "copy_raw_full"
                            ? "Copied Full Report!"
                            : "Copy Full Report"}
                        </span>
                      </button>
                    </div>
                    <pre className="rounded-xl border border-white/[0.06] bg-[#101012] p-3 font-mono text-[10px] leading-relaxed text-white/90 overflow-x-auto max-h-[420px] select-all whitespace-pre break-all custom-scrollbar">
                      {getFullLogReport(selectedLog)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
