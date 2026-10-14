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

  // Status
  detailsLoaded?: boolean;
}

interface AiModelLogsTrackerProps {
  clientLogs: CapturedRequestLog[];
}

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

    return {
      id: String(row.id || Math.random()),
      timestamp: String(row.timestamp || new Date().toISOString()),
      timeDisplay,
      status,
      statusText:
        row.statusText ||
        (status === 200 ? "OK" : status ? `HTTP ${status}` : "Pending"),
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
    };
  });
}

export default function AiModelLogsTracker({ clientLogs }: AiModelLogsTrackerProps) {
  const [serverLogs, setServerLogs] = useState<AiModelLogItem[]>([]);
  const [loadingServerLogs, setLoadingServerLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "details">("details");
  const [revealApiKey, setRevealApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detailedCache, setDetailedCache] = useState<Record<string, Partial<AiModelLogItem>>>({});
  const [showReqHeaders, setShowReqHeaders] = useState(false);
  const [showResHeaders, setShowResHeaders] = useState(false);

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

      results.push({
        id: "client_" + log.id,
        timestamp: log.timestamp,
        timeDisplay: log.timestamp,
        status,
        statusText:
          log.statusText || (status === 200 ? "OK" : status ? `HTTP ${status}` : "Pending"),
        provider,
        providerDisplay: provider,
        model: model || (isModelProbe ? "Model Probe / Test" : "Custom AI Model"),
        durationMs: log.durationMs,
        error: errorMsg,
        errorType:
          parsedRes?.error?.type ||
          (status >= 500 ? "UPSTREAM_ERROR" : status === 429 ? "RATE_LIMITED" : null),
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

  // ── 3. Combined Logs (Recent Calls First) ──────────────────────────────
  const allLogs = useMemo(() => {
    const seen = new Set<string>();
    const merged: AiModelLogItem[] = [];

    // Client logs first (live interactions from currently open browser)
    for (const cl of clientAiLogs) {
      merged.push(cl);
      seen.add(cl.id);
    }

    // Server logs next (from background, external apps, VPS curl, or past sessions)
    for (const sl of serverLogs) {
      if (!seen.has(sl.id)) {
        merged.push(sl);
        seen.add(sl.id);
      }
    }

    return merged;
  }, [clientAiLogs, serverLogs]);

  // Search filter
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return allLogs;
    const q = search.toLowerCase();
    return allLogs.filter((log) => {
      const matchModel = log.model.toLowerCase().includes(q);
      const matchProvider = (log.providerDisplay || log.provider).toLowerCase().includes(q);
      const matchUser = (log.userMessage || "").toLowerCase().includes(q);
      const matchAsst = (log.assistantResponse || "").toLowerCase().includes(q);
      const matchErr = (log.error || "").toLowerCase().includes(q);
      const matchStatus = String(log.status).includes(q);
      const matchUrl = (log.baseUrl || "").toLowerCase().includes(q);
      return (
        matchModel ||
        matchProvider ||
        matchUser ||
        matchAsst ||
        matchErr ||
        matchStatus ||
        matchUrl
      );
    });
  }, [allLogs, search]);

  // Active selected log (default to the very latest/first call if none selected)
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
          responseHeaders:
            providerRes.headers || clientRes.headers || data.responseHeaders || {},
          rawRequestBody: rawReq,
          rawResponseBody: rawRes,
          assistantResponse: asstMsg,
          error: data.error || selectedLog.error,
          errorType: data.errorType || selectedLog.errorType,
          status: data.status || selectedLog.status,
          model: data.model || selectedLog.model,
          provider: data.provider || selectedLog.provider,
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

  const getStatusColor = (status: number, error?: string | null) => {
    if (error || status >= 500 || status === 0)
      return "bg-red-500/20 text-red-400 border-red-500/30";
    if (status === 429) return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    if (status >= 400) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (status >= 200 && status < 300)
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    return "bg-white/10 text-white/70 border-white/20";
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#141416] text-white">
      {/* ── Top Header Controls: Search, Auto-Refresh & Mobile Toggle (Cupertino) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/[0.08] bg-[#1C1C1E]/80 backdrop-blur-xl p-3 sm:px-5 sm:py-3.5 shrink-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-white/40">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recent calls by model, provider, prompt, error, status..."
            className="w-full rounded-xl border border-white/10 bg-[#2C2C2E]/60 pl-9 pr-8 py-2 text-xs text-white placeholder-white/40 focus:border-white/30 focus:bg-[#2C2C2E] focus:outline-none transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 size-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] text-white/70 hover:bg-white/30 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Live Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {/* Mobile View Switcher (Cupertino Segmented Control) */}
          <div className="flex md:hidden items-center rounded-xl border border-white/[0.08] bg-[#2C2C2E] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                mobileView === "list"
                  ? "bg-[#3A3A3C] text-white font-semibold shadow-xs"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Calls ({filteredLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileView("details")}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                mobileView === "details"
                  ? "bg-[#3A3A3C] text-white font-semibold shadow-xs"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Details
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRefresh((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 cursor-pointer ${
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-white/10 bg-[#2C2C2E] text-white/60 hover:text-white"
            }`}
            title={autoRefresh ? "Auto-refresh active (3s)" : "Auto-refresh paused"}
          >
            <span
              className={`inline-block size-2 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-white/40"
              }`}
            />
            <span>{autoRefresh ? "Live 3s" : "Paused"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleManualRefresh()}
            disabled={loadingServerLogs}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E] px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-[#3A3A3C] hover:text-white active:scale-95 disabled:opacity-40 cursor-pointer transition-all"
            title="Refresh logs now"
          >
            <span
              className={`material-symbols-outlined text-[15px] ${
                loadingServerLogs ? "animate-spin" : ""
              }`}
            >
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Main View: Responsive Left Calls List + Right Inspection ── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        {/* Left Column: Recent AI Model Calls */}
        <div
          className={`${
            mobileView === "list" ? "flex" : "hidden"
          } md:flex flex-col md:w-[320px] lg:w-[360px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.08] overflow-y-auto bg-[#18181A] custom-scrollbar`}
        >
          <div className="px-4 py-3 border-b border-white/[0.06] bg-[#1C1C1E]/60 backdrop-blur-md flex items-center justify-between text-xs text-white/60 shrink-0">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-white/50">
              Recent AI Model Calls
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">
              {filteredLogs.length} total
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-xs text-white/40">
              <span className="material-symbols-outlined text-4xl mb-2 text-white/20">
                psychology
              </span>
              <p className="font-medium text-white/60">No AI model calls found</p>
              <p className="text-[11px] text-white/40 mt-1 max-w-[220px]">
                Make an AI request or run model tests to see live requests and responses.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
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
                    className={`flex flex-col gap-2 p-3 rounded-2xl text-xs transition-all cursor-pointer active:scale-[0.99] border ${
                      isSelected
                        ? "bg-[#2C2C2E] border-white/20 shadow-md ring-1 ring-primary/40 text-white"
                        : isError
                        ? "bg-[#1C1C1E]/50 border-red-500/20 hover:bg-red-500/5 hover:border-red-500/30"
                        : "bg-[#1C1C1E]/40 border-white/[0.04] hover:bg-[#242426] hover:border-white/10"
                    }`}
                  >
                    {/* Top Row: Provider & Status Badge */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/90 truncate max-w-[170px]">
                        <span className="material-symbols-outlined text-[11px] text-primary">
                          hub
                        </span>
                        {log.providerDisplay || log.provider}
                      </span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold border ${getStatusColor(
                            log.status,
                            log.error
                          )}`}
                        >
                          {log.error ? "ERR" : log.status || "..."}
                        </span>
                        <span className="font-mono text-[10px] text-white/40">
                          {log.timeDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Model Name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="material-symbols-outlined text-[14px] text-white/50 shrink-0">
                        smart_toy
                      </span>
                      <p
                        className="font-mono text-[11px] font-semibold text-white truncate"
                        title={log.model}
                      >
                        {log.model}
                      </p>
                    </div>

                    {/* Excerpt: Prompt or Error */}
                    {log.error ? (
                      <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1 truncate">
                        <span className="material-symbols-outlined text-[12px] shrink-0">
                          warning
                        </span>
                        <span className="truncate">{log.error}</span>
                      </div>
                    ) : log.userMessage ? (
                      <p className="text-[10px] text-white/60 truncate font-mono bg-black/40 border border-white/[0.04] rounded-xl px-2 py-1">
                        &quot;{log.userMessage}&quot;
                      </p>
                    ) : null}

                    {/* Footer Row: Latency & Source */}
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-0.5">
                      {log.durationMs !== undefined && (
                        <span className="inline-flex items-center gap-0.5 font-mono text-white/60">
                          <span className="material-symbols-outlined text-[11px]">timer</span>
                          {log.durationMs}ms
                        </span>
                      )}
                      <span className="text-[9px] uppercase tracking-wide opacity-50 ml-auto">
                        {log.source === "client-runtime" ? "Client Event" : "Server Log"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Complete Live Request & Actual Response Inspector (Cupertino) */}
        <div
          className={`${
            mobileView === "details" ? "flex" : "hidden"
          } md:flex flex-1 flex-col overflow-y-auto bg-[#141416] p-3.5 sm:p-5 gap-4 custom-scrollbar`}
        >
          {/* Back button for Mobile */}
          <div className="md:hidden flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <button
              type="button"
              onClick={() => setMobileView("list")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-xs font-semibold text-primary transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">arrow_back_ios_new</span>
              <span>Back to Calls ({allLogs.length})</span>
            </button>
            <span className="text-[11px] text-white/40 font-mono">
              {selectedLog?.timeDisplay}
            </span>
          </div>

          {!selectedLog ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-xs text-white/40">
              <span className="material-symbols-outlined text-5xl mb-2 text-white/20">
                receipt_long
              </span>
              <p className="font-semibold text-white/60 text-sm">No request selected</p>
              <p className="text-xs text-white/40 mt-1 max-w-sm">
                Select an AI model call from the left list or send a request to inspect what was
                sent and what came back.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* ── 1. Top Call Identity & Status Card (Cupertino) ── */}
              <div className="rounded-3xl border border-white/[0.08] bg-[#1C1C1E]/90 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-primary/20 border border-primary/30 px-3 py-1 text-xs font-bold text-primary flex items-center gap-1.5 shadow-xs">
                        <span className="material-symbols-outlined text-[14px]">hub</span>
                        {selectedLog.providerDisplay || selectedLog.provider}
                      </span>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono font-bold text-white flex items-center gap-1.5 shadow-xs">
                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                        {selectedLog.model}
                      </span>
                    </div>

                    {selectedLog.baseUrl && (
                      <div className="flex items-center gap-1 text-xs text-white/50 font-mono mt-1 break-all">
                        <span className="text-white/30 shrink-0">Endpoint:</span>
                        <span className="text-white/80 select-all">{selectedLog.baseUrl}</span>
                      </div>
                    )}
                  </div>

                  {/* Status badge & Latency */}
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedLog.durationMs !== undefined && (
                      <span className="rounded-full bg-black/50 border border-white/10 px-3 py-1 font-mono text-xs text-white/70">
                        {selectedLog.durationMs}ms
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3.5 py-1 font-mono text-xs font-bold border shadow-xs ${getStatusColor(
                        selectedLog.status,
                        selectedLog.error
                      )}`}
                    >
                      {selectedLog.error
                        ? selectedLog.status
                          ? `HTTP ${selectedLog.status} Failed`
                          : "Request Failed"
                        : `HTTP ${selectedLog.status || 200} ${selectedLog.statusText || "OK"}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── 2. ACTUAL RESPONSE SECTION (Cupertino Card) ── */}
              <div className="rounded-3xl border border-white/[0.08] bg-[#1C1C1E]/90 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-emerald-400">
                      arrow_downward
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Actual Response from Upstream / Model
                    </h3>
                  </div>

                  {selectedLog.rawResponseBody && (
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(formatJson(selectedLog.rawResponseBody), "copy_res_body")
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E] hover:bg-[#3A3A3C] px-3 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {copiedKey === "copy_res_body" ? "check" : "content_copy"}
                      </span>
                      <span>{copiedKey === "copy_res_body" ? "Copied" : "Copy Raw Response"}</span>
                    </button>
                  )}
                </div>

                {/* If there was an error, show it prominently in red */}
                {selectedLog.error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-red-300 flex flex-col gap-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 font-bold text-red-400 text-xs">
                      <span className="material-symbols-outlined text-base">error</span>
                      <span>Error Message ({selectedLog.status ? `HTTP ${selectedLog.status}` : "Failed"}):</span>
                    </div>
                    <p className="font-mono text-xs select-all whitespace-pre-wrap break-all leading-relaxed">
                      {selectedLog.error}
                    </p>
                    {selectedLog.errorType && (
                      <span className="text-[10px] text-red-400/70 font-mono">
                        Error Type: {selectedLog.errorType}
                      </span>
                    )}
                  </div>
                )}

                {/* Assistant Content preview if available */}
                {selectedLog.assistantResponse && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-emerald-400">
                      Generated Assistant Text:
                    </span>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-white/90 font-mono select-all whitespace-pre-wrap break-all max-h-56 overflow-y-auto leading-relaxed custom-scrollbar">
                      {selectedLog.assistantResponse}
                    </div>
                  </div>
                )}

                {/* Complete Raw Response Payload */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-white/60">
                    Complete Raw Response Body:
                  </span>
                  <pre className="rounded-2xl border border-white/[0.06] bg-[#121214] p-3.5 font-mono text-[11px] leading-relaxed text-white/90 overflow-x-auto max-h-72 select-all whitespace-pre break-all custom-scrollbar">
                    {formatJson(selectedLog.rawResponseBody)}
                  </pre>
                </div>

                {/* Response Headers (collapsible) */}
                {selectedLog.responseHeaders &&
                  Object.keys(selectedLog.responseHeaders).length > 0 && (
                    <div className="border-t border-white/[0.06] pt-2.5">
                      <button
                        type="button"
                        onClick={() => setShowResHeaders((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showResHeaders ? "expand_less" : "expand_more"}
                        </span>
                        <span>Response Headers ({Object.keys(selectedLog.responseHeaders).length})</span>
                      </button>

                      {showResHeaders && (
                        <div className="rounded-2xl border border-white/[0.06] bg-[#121214] p-3 font-mono text-[11px] mt-2 max-h-40 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                          {Object.entries(selectedLog.responseHeaders).map(([k, v]) => (
                            <div key={k} className="flex gap-2 py-1">
                              <span className="text-white/40 shrink-0 select-all">{k}:</span>
                              <span className="text-white/90 select-all break-all">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* ── 3. ACTUAL REQUEST SECTION (Cupertino Card) ── */}
              <div className="rounded-3xl border border-white/[0.08] bg-[#1C1C1E]/90 backdrop-blur-xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-sky-400">
                      arrow_upward
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Actual Request Sent to Model / Provider
                    </h3>
                  </div>

                  {selectedLog.rawRequestBody && (
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(formatJson(selectedLog.rawRequestBody), "copy_req_body")
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E] hover:bg-[#3A3A3C] px-3 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {copiedKey === "copy_req_body" ? "check" : "content_copy"}
                      </span>
                      <span>{copiedKey === "copy_req_body" ? "Copied" : "Copy Raw Request"}</span>
                    </button>
                  )}
                </div>

                {/* User Input Prompt */}
                {selectedLog.userMessage && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-sky-400">
                      User Prompt / Input Message:
                    </span>
                    <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs text-white/90 font-mono select-all whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed custom-scrollbar">
                      {selectedLog.userMessage}
                    </div>
                  </div>
                )}

                {/* System Prompt */}
                {selectedLog.systemPrompt && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-amber-400">
                      System Instructions:
                    </span>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-white/80 font-mono select-all whitespace-pre-wrap break-all max-h-36 overflow-y-auto leading-relaxed custom-scrollbar">
                      {selectedLog.systemPrompt}
                    </div>
                  </div>
                )}

                {/* Complete Raw Request Body */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-white/60">
                    Complete Raw Request Body (JSON payload):
                  </span>
                  <pre className="rounded-2xl border border-white/[0.06] bg-[#121214] p-3.5 font-mono text-[11px] leading-relaxed text-white/90 overflow-x-auto max-h-72 select-all whitespace-pre break-all custom-scrollbar">
                    {formatJson(selectedLog.rawRequestBody)}
                  </pre>
                </div>

                {/* Request Headers & Auth */}
                <div className="border-t border-white/[0.06] pt-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowReqHeaders((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showReqHeaders ? "expand_less" : "expand_more"}
                      </span>
                      <span>Request Headers & Auth ({selectedLog.requestHeaders ? Object.keys(selectedLog.requestHeaders).length : 0})</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRevealApiKey((prev) => !prev)}
                        className="text-[11px] text-primary hover:underline cursor-pointer"
                      >
                        {revealApiKey ? "Mask Keys" : "Reveal API Keys"}
                      </button>
                      {selectedLog.requestHeaders && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(selectedLog.requestHeaders, null, 2),
                              "copy_req_headers"
                            )
                          }
                          className="text-[11px] text-white/40 hover:text-white cursor-pointer"
                        >
                          {copiedKey === "copy_req_headers" ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>

                  {showReqHeaders && (
                    <div className="rounded-2xl border border-white/[0.06] bg-[#121214] p-3 font-mono text-[11px] max-h-48 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                      {!selectedLog.requestHeaders ||
                      Object.keys(selectedLog.requestHeaders).length === 0 ? (
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
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
