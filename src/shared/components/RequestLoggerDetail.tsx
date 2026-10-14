"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { JsonView } from "@/shared/components/jsonView";
import {
  PROVIDER_COLORS,
  getHttpStatusStyle as getStatusStyle,
  getProtocolColor,
} from "@/shared/constants/colors";
import { formatDuration, formatApiKeyLabel, maskAccount } from "@/shared/utils/formatting";
import { formatErrorForDisplay, formatReasoningStat } from "@/shared/utils/formatting";
import { useTheme } from "@/shared/hooks/useTheme";
import {
  useTimestampTitles,
  timestampMarkerCustomizeNode,
} from "@/shared/hooks/useTimestampTitles";
import { JsonTreeExpandControls } from "@/shared/components/JsonTreeExpandControls";
import { CallContentProvenanceBadges } from "@/shared/components/CallContentProvenanceBadges";
import { useJsonTreeExpandLevel } from "@/store/jsonTreeExpandStore";
import {
  PayloadSection,
  ConversationContextSection,
  buildPipelinePayloadSections,
  isBodySizeLimitOmission,
} from "@/shared/components/RequestLoggerDetail.sections";
import { getResilienceBadges } from "@/shared/components/requestLoggerResilience";

// ─── Copy-all composition ────────────────────────────────────────────────────
// Compose every visible payload section + stream chunk into a single block so
// users can copy the whole request/response transcript with one click instead
// of copying each section individually. Pure function, exported for tests.
type CopyAllSection = { title: string; json: string };
type CopyAllInput = {
  sections: CopyAllSection[];
  streamChunks?: Record<string, string | string[]>;
  legacyResponse?: string | null;
  legacyRequest?: string | null;
  legacyResponseTitle?: string;
  legacyRequestTitle?: string;
};

export function buildCopyAllText({
  sections,
  streamChunks,
  legacyResponse,
  legacyRequest,
  legacyResponseTitle = "Response",
  legacyRequestTitle = "Request",
}: CopyAllInput): string {
  const parts: string[] = [];
  const streamNames: Array<[string, string | string[] | undefined]> = [
    ["provider", streamChunks?.provider],
    ["client", streamChunks?.client],
    ["openai", streamChunks?.openai],
  ];

  for (const [name, value] of streamNames) {
    if (value == null) continue;
    const body = Array.isArray(value) ? value.join("") : String(value);
    if (!body) continue;
    parts.push(`### ${name.toUpperCase()} STREAM\n${body}`);
  }

  for (const section of sections) {
    parts.push(`### ${section.title}\n${section.json}`);
  }

  if (sections.length === 0 && legacyResponse) {
    parts.push(`### ${legacyResponseTitle}\n${legacyResponse}`);
  }
  if (sections.length === 0 && legacyRequest) {
    parts.push(`### ${legacyRequestTitle}\n${legacyRequest}`);
  }

  return parts.join("\n\n---\n\n");
}

// ─── Stream section + Detail Modal ───────────────────────────────────────────────────────────

// Raw stream chunks are captured at the network level (see streamChunks
// capture) with a `[HH:MM:SS.mmm] ` prefix inserted per chunk boundary, which
// can land mid-token inside an SSE event's JSON payload once chunks are
// joined. Strip those markers first so a `data:` line isn't interrupted.
const STREAM_TIMESTAMP_PREFIX = /\[\d{2}:\d{2}:\d{2}\.\d{3}\] /g;

type StreamSegment =
  { type: "text"; value: string } | { type: "json"; value: unknown; raw: string };

// Gemini's own stream-chunk capture concatenates multiple complete JSON
// objects back-to-back with no separator between them ("}{"), unlike the
// SSE blank-line-per-event framing every other provider's capture uses
// here. A `data:` payload can therefore hold several complete top-level
// JSON values, not one -- JSON.parse correctly rejects the whole thing
// ("Unexpected non-whitespace character after JSON") and used to make the
// entire payload fall back to plain text. Recover by scanning bracket/
// string depth to split the payload into individual JSON values instead of
// assuming exactly one JSON.parse per payload; each recovered value renders
// as its own collapsible node.
export function splitConcatenatedJsonValues(payload: string): unknown[] | null {
  const values: unknown[] = [];
  let i = 0;
  const len = payload.length;
  while (i < len) {
    while (i < len && /\s/.test(payload[i])) i++;
    if (i >= len) break;
    const start = i;
    if (payload[i] !== "{" && payload[i] !== "[") return null; // not a bare-value stream
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < len; i++) {
      const ch = payload[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    if (depth !== 0) return null; // unterminated -- a genuinely incomplete capture, not this case
    try {
      values.push(JSON.parse(payload.slice(start, i)));
    } catch {
      return null;
    }
  }
  return values.length > 1 ? values : null;
}

// Splits a raw joined SSE capture into renderable segments: each `data:`
// line that parses as JSON becomes its own segment (rendered as a
// collapsible tree), everything else (comments, keep-alives, [DONE],
// non-JSON payloads) stays as plain text, byte-identical to the raw capture.
export function parseStreamIntoSegments(joined: string): StreamSegment[] {
  const text = joined.replace(STREAM_TIMESTAMP_PREFIX, "");
  const events = text.split(/(?<=\n\n)/); // keep event boundaries, preserve exact text
  const segments: StreamSegment[] = [];
  for (const event of events) {
    if (!event) continue;
    const dataLines = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    const payload = dataLines.join("");
    if (dataLines.length === 0 || !payload || payload === "[DONE]") {
      segments.push({ type: "text", value: event });
      continue;
    }
    try {
      segments.push({ type: "json", value: JSON.parse(payload), raw: event });
    } catch {
      const values = splitConcatenatedJsonValues(payload);
      if (values) {
        for (const value of values) segments.push({ type: "json", value, raw: event });
      } else {
        segments.push({ type: "text", value: event });
      }
    }
  }
  return segments;
}

function StreamSection({ title, sectionId, json, onCopy }) {
  const t = useTranslations("requestLogger.detail");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  const [autoscroll, setAutoscroll] = useState(() => {
    try {
      const v = localStorage.getItem("pref:stream:autoscroll");
      return v == null ? true : v === "1";
    } catch {
      return true;
    }
  });
  // Default to the rendered/parsed view (segments below) -- raw is an
  // explicit opt-in for inspecting exactly what was captured on the wire,
  // timestamp markers and all, when the rendered tree hides something the
  // parser got wrong (e.g. a chunk-boundary split like this PR fixes).
  const [showRaw, setShowRaw] = useState(() => {
    try {
      return localStorage.getItem("pref:stream:raw") === "1";
    } catch {
      return false;
    }
  });
  const ref = useRef(null);
  const { isDark } = useTheme();
  const resolvedSectionId = sectionId || title;
  const expandLevel = useJsonTreeExpandLevel(resolvedSectionId);
  const segments = useMemo(() => parseStreamIntoSegments(json), [json]);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success !== false) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!autoscroll || !open) return;
    const el = ref.current;
    if (!el) return;
    // scroll on next animation frame to avoid layout thrash
    requestAnimationFrame(() => {
      try {
        el.scrollTop = el.scrollHeight;
      } catch {}
    });
  }, [json, autoscroll, open]);

  const toggleAutoscroll = () => {
    const next = !autoscroll;
    setAutoscroll(next);
    try {
      localStorage.setItem("pref:stream:autoscroll", next ? "1" : "0");
    } catch {}
  };

  const toggleRaw = () => {
    const next = !showRaw;
    setShowRaw(next);
    try {
      localStorage.setItem("pref:stream:raw", next ? "1" : "0");
    } catch {}
  };

  useTimestampTitles(ref, open);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">
            {title}
          </h3>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            aria-label={open ? t("collapse", { title }) : t("expand", { title })}
          >
            <span className="material-symbols-outlined text-[15px]">
              {open ? "expand_less" : "expand_more"}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleRaw}
            title={showRaw ? t("rawViewOn") : t("rawViewOff")}
            aria-label={showRaw ? t("rawViewOn") : t("rawViewOff")}
            className={`p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors ${showRaw ? "text-primary" : ""}`}
            aria-pressed={showRaw}
          >
            <span className="material-symbols-outlined text-[16px]">code</span>
          </button>
          <button
            onClick={toggleAutoscroll}
            title={autoscroll ? t("autoscrollOn") : t("autoscrollOff")}
            className={`p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors ${autoscroll ? "text-primary" : ""}`}
            aria-pressed={autoscroll}
          >
            <span className="material-symbols-outlined text-[16px]">vertical_align_bottom</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label={t("copyTitle", { title })}
          >
            <span className="material-symbols-outlined text-[13px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? t("copied") : t("copy")}
          </button>
          {!showRaw && segments.some((s) => s.type === "json") && (
            <JsonTreeExpandControls sectionId={resolvedSectionId} />
          )}
        </div>
      </div>
      {open && (
        <div
          ref={ref}
          className="p-2.5 sm:p-3 rounded-xl bg-black/40 border border-white/[0.08] overflow-x-auto text-xs font-mono text-white/90 max-h-120 overflow-y-auto leading-relaxed"
        >
          {showRaw ? (
            <pre className="whitespace-pre-wrap break-words">{json}</pre>
          ) : (
            segments.map((segment, i) =>
              segment.type === "json" ? (
                <div key={i} className="my-1">
                  <JsonView
                    src={segment.value}
                    dark={isDark}
                    collapsed={expandLevel}
                    customizeNode={timestampMarkerCustomizeNode}
                    displaySize
                  />
                </div>
              ) : (
                <span key={i} className="whitespace-pre-wrap break-words">
                  {segment.value}
                </span>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ───────────────────────────────────────────────────────────

type StreamChunks = Record<string, string | string[]>;

function getCodexAccountRotation(detail) {
  const sources = [detail?.requestBody, detail?.responseBody];

  for (const source of sources) {
    const meta = source?._cheaproute;
    const rotation = meta?.codexAccountRotation;
    if (
      rotation &&
      typeof rotation.initialConnectionId === "string" &&
      typeof rotation.finalConnectionId === "string" &&
      rotation.initialConnectionId !== rotation.finalConnectionId
    ) {
      return rotation;
    }
  }

  return null;
}

function formatConnectionId(value) {
  if (typeof value !== "string" || value.length === 0) return "-";
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}

export default function RequestLoggerDetail({
  log,
  detail,
  loading,
  debugEnabled,
  emailsVisible = false,
  onClose,
  onCopy,
  onPrevious,
  onNext,
  relatedLogs = [],
  onSelectRelated,
}) {
  const t = useTranslations("requestLogger.detail");
  // #13130: the grid's TTFT column label doubles as the detail-tile label
  // (the key already ships in every locale under requestLogger.columns).
  const tColumns = useTranslations("requestLogger.columns");
  const locale = useLocale();
  const modalScrollRef = useRef(null);
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [onClose]);

  // The overlay is full-viewport, but the modal panel itself is centered and
  // narrower than the viewport (max-w-225), leaving backdrop margin on every
  // side. A wheel event there has no scrollable target under the cursor, so
  // scrolling only worked once the pointer happened to be over the panel's
  // own content. Forward wheel scrolling from anywhere in the overlay to the
  // panel instead, so the backdrop margin scrolls it too.
  const handleOverlayWheel = (e) => {
    const panel = modalScrollRef.current;
    // Let native scrolling handle wheel events that already land inside the
    // panel -- only forward the ones from the backdrop margin around it.
    if (!panel || panel.contains(e.target)) return;
    panel.scrollTop += e.deltaY;
    e.preventDefault();
  };

  const statusStyle = getStatusStyle(log.status);
  const protocolKey = log.sourceFormat || log.provider;
  const protocol = getProtocolColor(protocolKey, log.provider);
  const providerColor = PROVIDER_COLORS[log.provider] || {
    bg: "#374151",
    text: "#fff",
    label: (log.provider || "-").toUpperCase(),
  };
  const providerLabel = log.providerDisplay || providerColor.label;

  const [unblocking, setUnblocking] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // #7920 gave this component formatErrorForDisplay for structured error objects, but the
  // #8213 combo/cooldown checks below went straight to the raw field and call
  // .toLowerCase() on it — which throws the moment `error` is an object. Same helper,
  // same normalization, one source of truth.
  const errorText = formatErrorForDisplay(detail?.error || log.error) ?? "";
  const isCombo503 =
    log.status === 503 && errorText.toLowerCase().includes("all targets exhausted");
  const isModelCooldown = !isCombo503 && errorText.toLowerCase().includes("cooling down");

  const [unblockAllBusy, setUnblockAllBusy] = useState(false);

  const handleUnblockModel = async () => {
    if (!log.provider || !log.model) return;
    setUnblocking(true);
    try {
      const res = await fetch("/api/resilience/model-cooldowns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: log.provider, model: log.model }),
      });
      if (res.ok) setCleared(true);
    } catch {
      /* ignore */
    } finally {
      setUnblocking(false);
    }
  };

  const handleUnblockAll = async () => {
    setUnblockAllBusy(true);
    try {
      const res = await fetch("/api/resilience/model-cooldowns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) setCleared(true);
    } catch {
      /* ignore */
    } finally {
      setUnblockAllBusy(false);
    }
  };

  const providerStatus = detail?.pipelinePayloads?.providerResponse?.status;
  const hasStatusDiscrepancy = providerStatus && providerStatus !== log.status;

  const formatDate = (iso) => {
    if (iso == null) return "\u2014";
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "\u2014";
      return d.toLocaleString(locale, {
        dateStyle: "short",
        timeStyle: "medium",
        hour12: false,
      });
    } catch {
      return "\u2014";
    }
  };

  const toPrettyJson = (payload) => {
    if (payload === null || payload === undefined) return null;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const pipelinePayloads = detail?.pipelinePayloads || null;
  const effectivePipelinePayloads = useMemo(() => {
    const payloads: Record<string, unknown> = { ...(pipelinePayloads || {}) };
    if (!payloads.providerResponse && (detail?.responseBody || log?.responseBody)) {
      payloads.providerResponse = detail?.responseBody || log?.responseBody;
    }
    return Object.keys(payloads).length > 0 ? payloads : null;
  }, [pipelinePayloads, detail?.responseBody, log?.responseBody]);

  const payloadSections = effectivePipelinePayloads
    ? buildPipelinePayloadSections(
        [
          ["clientRawRequest", t("payload.clientRawRequest")],
          ["clientRequest", t("payload.clientRequest")],
          ["openaiRequest", t("payload.openaiRequest")],
          ["providerRequest", t("payload.providerRequest")],
          ["providerResponse", t("payload.providerResponse")],
          ["clientResponse", t("payload.clientResponse")],
          ["error", t("payload.pipelineError")],
        ],
        effectivePipelinePayloads
      )
    : [];

  const rawUpstreamError = useMemo(() => {
    if (detail?.errorDetails) return detail.errorDetails;
    if (log?.errorDetails) return log.errorDetails;
    const provResp = detail?.pipelinePayloads?.providerResponse;
    if (provResp && typeof provResp === "object") {
      if ("body" in provResp && (provResp as Record<string, unknown>).body) {
        return (provResp as Record<string, unknown>).body;
      }
      return provResp;
    }
    if (detail?.responseBody && (log.status >= 400 || log.status === 0)) {
      return detail.responseBody;
    }
    return null;
  }, [detail, log]);
  const requestBodyOmitted = isBodySizeLimitOmission(detail?.requestBody);
  const responseBodyOmitted = isBodySizeLimitOmission(detail?.responseBody);
  const requestJson = detail?.requestBody ? toPrettyJson(detail.requestBody) : null;
  const responseJson = detail?.responseBody ? toPrettyJson(detail.responseBody) : null;
  const streamChunks = (() => {
    if (!debugEnabled || !detail?.pipelinePayloads?.streamChunks) return null;
    let chunks: StreamChunks = detail.pipelinePayloads.streamChunks;
    if (typeof chunks === "string") {
      try {
        chunks = JSON.parse(chunks);
      } catch {
        return null;
      }
    }
    if (chunks && typeof chunks === "object") return chunks;
    return null;
  })();

  // Compose every visible payload section + stream chunk into a single block so
  // users can copy the whole request/response transcript with one click instead
  // of copying each section individually.
  const handleCopyAll = async () => {
    const text = buildCopyAllText({
      sections: payloadSections,
      streamChunks: streamChunks || undefined,
      legacyResponse: payloadSections.length === 0 ? responseJson : null,
      legacyRequest: payloadSections.length === 0 ? requestJson : null,
      legacyResponseTitle: t("responsePayloadLegacy"),
      legacyRequestTitle: t("requestPayloadLegacy"),
    });
    if (!text) return;
    const success = await onCopy(text);
    if (success !== false) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };
  const detailIssue =
    detail?.detailState === "missing"
      ? t("payloadMissing")
      : detail?.detailState === "corrupt"
        ? t("payloadCorrupt")
        : null;
  const tokenStats = {
    totalIn: detail?.tokens?.in ?? log.tokens?.in ?? null,
    totalOut: detail?.tokens?.out ?? log.tokens?.out ?? null,
    cacheRead: detail?.tokens?.cacheRead ?? log.tokens?.cacheRead,
    cacheWrite: detail?.tokens?.cacheWrite ?? log.tokens?.cacheWrite,
    reasoning: detail?.tokens?.reasoning ?? log.tokens?.reasoning,
    reasoningChars: detail?.reasoningChars ?? log.reasoningChars,
    compressed: detail?.tokens?.compressed ?? log.tokens?.compressed,
  };

  const formatTokenValue = (value) => (value != null ? value.toLocaleString() : t("notAvailable"));

  const cacheSource = detail?.cacheSource || log.cacheSource || "upstream";
  const cacheSourceLabel = cacheSource === "semantic" ? t("semanticCache") : t("upstreamCache");
  const cacheSourceClassName =
    cacheSource === "semantic"
      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
      : "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30";
  // resilience badges (flag alone decides, whatever the status).
  const resilienceBadges = getResilienceBadges(
    log.resilienceActions || detail?.resilienceActions || null,
    (key, values) => t(key as never, values as never)
  );
  const accountLabel = maskAccount(detail?.account || log.account, emailsVisible);
  const codexAccountRotation = getCodexAccountRotation(detail);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      onWheel={handleOverlayWheel}
      role="dialog"
      aria-modal="true"
      aria-label={t("ariaLabel")}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        ref={modalScrollRef}
        className="relative w-[90%] max-w-[90%] sm:w-full sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-[#1c1c1e] text-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-white/10 bg-[#1c1c1e]/90 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5">
              {log.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <span className="inline-block h-2 w-2 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>Active</span>
                </span>
              ) : log.status === 0 ? (
                <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {t("completed")}
                </span>
              ) : (
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  {log.status}
                </span>
              )}
              {hasStatusDiscrepancy && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70">
                  {t("upstreamStatus", { status: providerStatus })}
                </span>
              )}
              {log.method && <span className="font-bold text-xs sm:text-sm text-white/90">{log.method}</span>}
            </div>
            <span className="text-white/60 font-mono text-xs truncate max-w-[140px] sm:max-w-xs">{log.path}</span>
            {log.id && (
              <span className="text-[9px] text-white/40 font-mono px-1 py-0.5 rounded bg-white/5 border border-white/10 select-all hidden sm:inline-block">
                {log.id}
              </span>
            )}
            {log.correlationId && (
              <span
                className="text-[9px] text-white/40 font-mono px-1 py-0.5 rounded bg-white/5 border border-white/10 select-all hidden sm:inline-block"
                title={t("correlationId")}
              >
                {t("correlationIdValue", { id: log.correlationId })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all text-xs font-medium active:scale-95"
              aria-label={t("copyAll")}
              title={t("copyAll")}
            >
              <span className="material-symbols-outlined text-[14px]">
                {copiedAll ? "check" : "content_copy"}
              </span>
              <span className="hidden sm:inline text-xs">
                {copiedAll ? t("copiedAll") : t("copyAll")}
              </span>
            </button>
            {(onPrevious || onNext) && (
              <>
                <button
                  onClick={onPrevious}
                  disabled={!onPrevious}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                  aria-label={t("previousRequest")}
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <button
                  onClick={onNext}
                  disabled={!onNext}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                  aria-label={t("nextRequest")}
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-95 ml-1"
              aria-label={t("close")}
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-2.5 sm:p-3 flex flex-col gap-2">
          {/* Metadata Grid */}
          {log.active ? (
            <div className="flex flex-wrap gap-2 p-2.5 bg-white/[0.04] rounded-xl border border-white/[0.08]">
              <div className="min-w-[120px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("startedAt")}
                </div>
                <div className="text-xs font-medium text-white/90">{formatDate(log.timestamp)}</div>
              </div>
              <div className="min-w-[80px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("duration")}
                </div>
                <div className="text-xs font-medium text-white/90">{formatDuration(log.duration)}</div>
              </div>
              <div className="min-w-[80px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("addedWait")}
                </div>
                <div className="text-xs font-medium text-white/90">
                  {typeof log.addedWaitMs === "number" && log.addedWaitMs > 0
                    ? `${formatDuration(log.addedWaitMs)}${log.addedWaitCause ? ` (${log.addedWaitCause})` : ""}`
                    : "—"}
                </div>
              </div>
              <div className="min-w-[120px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("model")}
                </div>
                <div className="text-xs font-medium text-primary font-mono truncate">{log.model}</div>
              </div>
              <div className="min-w-[100px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("provider")}
                </div>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                  style={{ backgroundColor: providerColor.bg, color: providerColor.text }}
                >
                  {providerLabel}
                </span>
              </div>
              <div className="min-w-[100px] flex-1">
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("account")}
                </div>
                <div className="text-xs font-medium text-white/90 truncate">{accountLabel}</div>
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2.5 bg-white/[0.04] rounded-xl border border-white/[0.08]"
              data-testid="request-log-metadata-grid"
            >
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("startedAt")}
                </div>
                <div className="text-xs font-medium text-white/90 truncate">
                  {(() => {
                    try {
                      const ts = new Date(log.timestamp).getTime();
                      if (!Number.isFinite(ts)) return "\u2014";
                      return formatDate(new Date(ts - (log.duration || 0)).toISOString());
                    } catch {
                      return "\u2014";
                    }
                  })()}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("endedAt")}
                </div>
                <div className="text-xs font-medium text-white/90 truncate">{formatDate(log.timestamp)}</div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("duration")}
                </div>
                <div className="text-xs font-medium text-white/90">{formatDuration(log.duration)}</div>
              </div>
              {typeof log.ttft === "number" && log.ttft > 0 && (
                <div>
                  <div
                    className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5"
                    title={`${tColumns("ttft")}: time to first forwarded stream token; generation ran for ${formatDuration(Math.max(0, (log.duration || 0) - log.ttft))} (#13130)`}
                  >
                    {tColumns("ttft")}
                  </div>
                  <div className="text-xs font-medium text-white/90">{formatDuration(log.ttft)}</div>
                </div>
              )}
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("input")}
                </div>
                <div
                  className="flex flex-wrap items-center gap-1"
                  data-testid="token-group-input"
                >
                  <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-semibold">
                    {t("totalIn", { value: formatTokenValue(tokenStats.totalIn) })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-semibold">
                    {t("cacheRead", { value: formatTokenValue(tokenStats.cacheRead) })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold">
                    {t("cacheWrite", { value: formatTokenValue(tokenStats.cacheWrite) })}
                  </span>
                  {tokenStats.compressed != null &&
                    tokenStats.compressed > 0 &&
                    (() => {
                      const fromTokens = tokenStats.compressed + Math.max(0, tokenStats.totalIn);
                      const saved = Math.min(tokenStats.compressed, fromTokens);
                      const pct =
                        fromTokens > 0
                          ? Math.max(0, Math.min(100, Math.round((saved / fromTokens) * 100)))
                          : 100;
                      return (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold">
                          {t("compressed", {
                            from: fromTokens.toLocaleString(),
                            to: Math.max(0, tokenStats.totalIn).toLocaleString(),
                            percent: pct,
                          })}
                        </span>
                      );
                    })()}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("output")}
                </div>
                <div
                  className="flex flex-wrap items-center gap-1"
                  data-testid="token-group-output"
                >
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                    {t("totalOut", { value: formatTokenValue(tokenStats.totalOut) })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[10px] font-semibold">
                    {t("reasoning", { value: formatReasoningStat(tokenStats, t) })}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("model")}
                </div>
                <div className="text-xs font-medium text-primary font-mono truncate">{log.model}</div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("requestedModel")}
                </div>
                <div
                  className={`text-xs font-medium font-mono truncate ${
                    (detail?.requestedModel || log.requestedModel) &&
                    (detail?.requestedModel || log.requestedModel) !== log.model
                      ? "text-amber-400"
                      : "text-white/50"
                  }`}
                >
                  {detail?.requestedModel || log.requestedModel || "\u2014"}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("provider")}
                </div>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                  style={{ backgroundColor: providerColor.bg, color: providerColor.text }}
                >
                  {providerLabel}
                </span>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("requestProtocol")}
                </div>
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                  style={{ backgroundColor: protocol.bg, color: protocol.text }}
                >
                  {protocol.label}
                </span>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("cacheSource")}
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cacheSourceClassName}`}
                >
                  {cacheSourceLabel}
                </span>
                {resilienceBadges.map((badge) => (
                  <span key={badge.key} title={badge.title}>
                    {badge.label}
                  </span>
                ))}
              </div>
              <CallContentProvenanceBadges
                hasContent={detail?.hasContent ?? log.hasContent}
                usageProvenance={detail?.usageProvenance ?? log.usageProvenance}
              />
              {(detail?.modelPinned || log.modelPinned) && (
                <div>
                  <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                    {t("modelPinning")}
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/25">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.5 2A1.5 1.5 0 003 3.5v1.9l-1.4 2.8A.5.5 0 002 9h4v4.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V9h4a.5.5 0 00.44-.73L13 5.4V3.5A1.5 1.5 0 0011.5 2h-7z" />
                    </svg>
                    {t("activeModelPinning")}
                  </span>
                </div>
              )}
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("account")}
                </div>
                <div className="text-xs font-medium text-white/90 truncate">{accountLabel}</div>
                {codexAccountRotation && (
                  <div
                    className="mt-0.5 text-[9px] text-amber-400 font-mono"
                    title={`${codexAccountRotation.initialConnectionId} -> ${codexAccountRotation.finalConnectionId}`}
                  >
                    {t("rotated", {
                      initial: formatConnectionId(codexAccountRotation.initialConnectionId),
                      final: formatConnectionId(codexAccountRotation.finalConnectionId),
                    })}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("apiKey")}
                </div>
                <div
                  className="text-xs font-medium text-white/90 truncate"
                  title={
                    detail?.apiKeyName ||
                    detail?.apiKeyId ||
                    log.apiKeyName ||
                    log.apiKeyId ||
                    t("noApiKey")
                  }
                >
                  {formatApiKeyLabel(
                    detail?.apiKeyName || log.apiKeyName,
                    detail?.apiKeyId || log.apiKeyId
                  )}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  {t("combo")}
                </div>
                {detail?.comboName || log.comboName ? (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    {detail?.comboName || log.comboName}
                  </span>
                ) : (
                  <div className="text-xs text-white/40">{"\u2014"}</div>
                )}
              </div>
              <div>
                <div className="text-[9px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">
                  Conversation
                </div>
                {detail?.sessionTag || log.sessionTag ? (
                  <div
                    className="text-xs font-mono text-white/90 truncate select-all"
                    title={detail?.sessionTag || log.sessionTag}
                  >
                    {(detail?.sessionTag || log.sessionTag).slice(0, 20)}
                    {"\u2026"}
                  </div>
                ) : (
                  <div className="text-xs text-white/40">{"\u2014"}</div>
                )}
              </div>
            </div>
          )}


          {/* Error Message & Raw Upstream Response */}
          {(detail?.error || log.error || rawUpstreamError) && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  <span>{t("error")}</span>
                </div>
                {isCombo503 && !cleared && (
                  <button
                    onClick={handleUnblockAll}
                    disabled={unblockAllBusy}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full
                      bg-amber-500/15 border border-amber-500/30 text-amber-400
                      hover:bg-amber-500/25 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="6" width="10" height="8" rx="1" />
                      <path d="M5 6V4a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1" />
                      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    {unblockAllBusy ? "..." : t("unblockAll")}
                  </button>
                )}
                {isCombo503 && cleared && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="4 8 7 11 12 4" />
                    </svg>
                    {t("cleared")}
                  </span>
                )}
                {isModelCooldown && !cleared && (
                  <button
                    onClick={handleUnblockModel}
                    disabled={unblocking}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full
                      bg-amber-500/15 border border-amber-500/30 text-amber-400
                      hover:bg-amber-500/25 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="6" width="10" height="8" rx="1" />
                      <path d="M5 6V4a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1" />
                      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
                    </svg>
                    {unblocking ? "..." : t("unblock")}
                  </button>
                )}
                {isModelCooldown && cleared && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="4 8 7 11 12 4" />
                    </svg>
                    {t("cleared")}
                  </span>
                )}
              </div>
              <div className="text-xs text-red-300 font-mono whitespace-pre-wrap break-words">
                {formatErrorForDisplay(detail?.error || log.error) || "Error occurred"}
              </div>

              {rawUpstreamError && (
                <div className="mt-2 pt-2 border-t border-red-500/20">
                  <div className="text-[10px] text-red-400/80 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">dns</span>
                    <span>Upstream Server Response (Raw)</span>
                    {providerStatus ? (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono">
                        HTTP {providerStatus}
                      </span>
                    ) : null}
                  </div>
                  <pre className="text-xs text-red-200/95 font-mono whitespace-pre-wrap break-words bg-black/40 p-2 rounded-lg max-h-48 overflow-y-auto leading-relaxed border border-red-500/20">
                    {typeof rawUpstreamError === "object"
                      ? JSON.stringify(rawUpstreamError, null, 2)
                      : String(rawUpstreamError)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Related Requests (same correlation ID) */}
          {relatedLogs.length > 1 && (
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <div className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5 font-semibold">
                {t("relatedRequests", { count: relatedLogs.length })}
              </div>
              <div className="flex flex-col gap-1">
                {[...relatedLogs]
                  .sort((a, b) => {
                    const aStart = new Date(a.timestamp).getTime() - (a.duration || 0);
                    const bStart = new Date(b.timestamp).getTime() - (b.duration || 0);
                    return aStart - bStart;
                  })
                  .map((r) => {
                    const rStatusStyle = r.active ? null : getStatusStyle(r.status);
                    const isCurrent = r.id === log.id;
                    const startTime = new Date(new Date(r.timestamp).getTime() - (r.duration || 0));
                    return (
                      <button
                        key={r.id}
                        onClick={() => !isCurrent && onSelectRelated?.(r)}
                        disabled={isCurrent}
                        className={`flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-colors ${
                          isCurrent
                            ? "bg-primary/10 border border-primary/30 cursor-default"
                            : "hover:bg-white/5 cursor-pointer"
                        }`}
                      >
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold min-w-[28px] text-center"
                          style={
                            rStatusStyle
                              ? { backgroundColor: rStatusStyle.bg, color: rStatusStyle.text }
                              : { backgroundColor: "#374151", color: "#fff" }
                          }
                        >
                          {r.status || "..."}
                        </span>
                        <span className="font-mono text-white/40">{r.id}</span>
                        <span className="text-white/70">{r.model}</span>
                        <span className="text-white/40 text-[10px]">
                          {startTime.toLocaleTimeString(locale, { hour12: false })}
                        </span>
                        <span className="text-white/40 ml-auto">
                          {formatDuration(r.duration)}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] text-primary font-bold ml-1">
                            {t("current")}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {detailIssue && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-[9px] text-amber-400 uppercase tracking-wider mb-1 font-bold">
                {t("detailStatus")}
              </div>
              <div className="text-xs text-amber-200">{detailIssue}</div>
            </div>
          )}

          {loading ? (
            <div className="p-6 text-center text-white/40 animate-pulse text-xs">
              {t("loadingDetails")}
            </div>
          ) : (
            <>
              <ConversationContextSection key={log.id} log={log} detail={detail} />

              {streamChunks && streamChunks.provider && (
                <StreamSection
                  title={t("providerEventStream")}
                  sectionId="providerEventStream"
                  json={
                    Array.isArray(streamChunks.provider)
                      ? streamChunks.provider.join("")
                      : String(streamChunks.provider)
                  }
                  onCopy={() =>
                    onCopy(
                      Array.isArray(streamChunks.provider)
                        ? streamChunks.provider.join("")
                        : String(streamChunks.provider)
                    )
                  }
                />
              )}

              {streamChunks && streamChunks.client && (
                <StreamSection
                  title={t("clientEventStream")}
                  sectionId="clientEventStream"
                  json={
                    Array.isArray(streamChunks.client)
                      ? streamChunks.client.join("")
                      : String(streamChunks.client)
                  }
                  onCopy={() =>
                    onCopy(
                      Array.isArray(streamChunks.client)
                        ? streamChunks.client.join("")
                        : String(streamChunks.client)
                    )
                  }
                />
              )}

              {streamChunks &&
                streamChunks.openai &&
                !streamChunks.provider &&
                !streamChunks.client && (
                  <StreamSection
                    title={t("eventStream")}
                    sectionId="eventStream"
                    json={
                      Array.isArray(streamChunks.openai)
                        ? streamChunks.openai.join("")
                        : String(streamChunks.openai)
                    }
                    onCopy={() =>
                      onCopy(
                        Array.isArray(streamChunks.openai)
                          ? streamChunks.openai.join("")
                          : String(streamChunks.openai)
                      )
                    }
                  />
                )}

              {payloadSections.length > 0 &&
                payloadSections.map((section) => (
                  <PayloadSection
                    key={section.key}
                    title={section.title}
                    sectionId={section.key}
                    json={section.json}
                    notice={section.notice}
                    onCopy={() => onCopy(section.json)}
                  />
                ))}

              {/* Ensure Provider Response and Request are always shown even if not in payloadSections */}
              {!payloadSections.some((s) => s.key === "providerResponse" || s.key === "clientResponse") && responseJson && (
                <PayloadSection
                  title={t("payload.providerResponse")}
                  sectionId="providerResponseFallback"
                  json={responseJson}
                  notice={responseBodyOmitted}
                  onCopy={() => onCopy(responseJson)}
                />
              )}

              {!payloadSections.some((s) => s.key === "clientRequest" || s.key === "providerRequest") && requestJson && (
                <PayloadSection
                  title={t("payload.clientRequest")}
                  sectionId="clientRequestFallback"
                  json={requestJson}
                  notice={requestBodyOmitted}
                  onCopy={() => onCopy(requestJson)}
                />
              )}

              {payloadSections.length === 0 && !requestJson && !responseJson && !loading && (
                <div className="p-4 text-center text-white/40">
                  <span className="material-symbols-outlined text-[28px] mb-1 block opacity-40">
                    info
                  </span>
                  <p className="text-xs">{t("noPayload")}</p>
                  <p className="text-[10px] mt-0.5">{t("detailedPayloadInfo")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
