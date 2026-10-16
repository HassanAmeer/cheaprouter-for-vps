"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Copy,
  Check,
  Play,
  RefreshCw,
  Layers,
  X,
  Code2,
  ChevronDown,
  ChevronUp,
  Server,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { copyToClipboard } from "@/lib/utils";

interface ModelsViewProps {
  baseUrl?: string;
}

interface ModelItem {
  id: string;
  name?: string;
  provider?: string;
  context?: string | number;
  input?: string | number;
  output?: string | number;
}

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";
const MONO_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, Consolas, monospace";

// Fallback models in case backend has no providers seeded yet
const DEFAULT_FALLBACK_MODELS: ModelItem[] = [
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "o1", name: "o1", provider: "OpenAI" },
  { id: "o3-mini", name: "o3-mini", provider: "OpenAI" },
  { id: "deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", provider: "Qwen" },
  { id: "nemotron-3_5-lightning_free", name: "Nemotron 3.5 Lightning (free)", provider: "OpenRouter" },
  { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free", provider: "OpenCode" },
  { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", provider: "OpenCode" },
  { id: "mimo-v2.5-free", name: "MiMo-V2.5 Free", provider: "OpenCode" },
  { id: "solar-pro4", name: "Solar Pro 4", provider: "OpenRouter" },
  { id: "big-pickle", name: "Big Pickle", provider: "OpenCode" },
];

export default function ModelsView({ baseUrl = "http://localhost:3000" }: ModelsViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [models, setModels] = useState<ModelItem[]>(DEFAULT_FALLBACK_MODELS);
  const [isLoading, setIsLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedModel, setCopiedModel] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const cleanBase = baseUrl.replace(/\/$/, "");
  const fullEndpointUrl = `${cleanBase}/v1/models`;

  // Function to perform the live GET request and load uploaded models
  const executeGetModels = async () => {
    setIsLoading(true);
    const startTime = performance.now();
    try {
      // First try /api/models (public endpoint returning all uploaded models from admin_providers)
      const res = await fetch("/api/models");
      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));
      setResponseStatus(res.status);

      if (res.ok) {
        const data = await res.json();
        setRawResponse(data);
        if (data && Array.isArray(data.models) && data.models.length > 0) {
          const formatted: ModelItem[] = data.models
            .map((m: any) => {
              if (typeof m === "string") return { id: m, name: m };
              const id = m.id || m.name || m.originalId || "";
              if (!id) return null;
              return {
                id,
                name: m.name || id,
                provider: m.provider,
                context: m.context || m.contextWindow,
                input: m.input || m.inputPrice,
                output: m.output || m.outputPrice,
              };
            })
            .filter((m: any): m is ModelItem => m !== null && m.id.trim().length > 0);

          if (formatted.length > 0) {
            setModels(formatted);
          }
        }
      } else {
        // If not OK, keep previous or fallback
        setResponseStatus(res.status);
      }
    } catch (err) {
      console.warn("Error calling GET /api/models:", err);
      setResponseStatus(500);
    } finally {
      setIsLoading(false);
    }
  };

  // Run GET on initial mount to automatically fetch uploaded models
  useEffect(() => {
    executeGetModels();
  }, []);

  const handleCopyModel = async (name: string) => {
    const success = await copyToClipboard(name);
    if (success) {
      setCopiedModel(name);
      setTimeout(() => {
        setCopiedModel(null);
      }, 1800);
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(fullEndpointUrl);
    if (success) {
      setCopiedUrl(true);
      setTimeout(() => {
        setCopiedUrl(false);
      }, 1800);
    }
  };

  const handleCopyAll = async () => {
    const textToCopy = filteredModels.map((m) => m.id).join("\n");
    const success = await copyToClipboard(textToCopy);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => {
        setCopiedAll(false);
      }, 2000);
    }
  };

  const filteredModels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return models;
    return models.filter((m) => {
      const matchId = m.id.toLowerCase().includes(q);
      const matchName = m.name ? m.name.toLowerCase().includes(q) : false;
      const matchProvider = m.provider ? m.provider.toLowerCase().includes(q) : false;
      return matchId || matchName || matchProvider;
    });
  }, [models, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{ display: "flex", flexDirection: "column", gap: "28px" }}
      id="all-models"
    >
      {/* ── Breadcrumb & Category Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: isDark ? "#9ca3af" : "#64748b",
            fontFamily: SERIF_FONT,
          }}
        >
          <span>Platform & Core API</span>
          <span>/</span>
          <span style={{ color: isDark ? "#ffffff" : "#0f172a", fontWeight: 600 }}>All Models</span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "38px",
            fontWeight: 400,
            fontFamily: SERIF_FONT,
            letterSpacing: "-0.02em",
            color: isDark ? "#ffffff" : "#0f172a",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          All Models
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: isDark ? "#9ca3af" : "#475569",
            lineHeight: 1.6,
            maxWidth: "780px",
            margin: 0,
          }}
        >
          Calling this GET endpoint lists all AI models uploaded and active on CheapRouter. Click the <strong>GET</strong> button to execute the request live and load the model catalog.
        </p>
      </div>

      {/* ── Live GET Endpoint Specification & Interactive Bar ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          padding: "18px 20px",
          borderRadius: "8px",
          backgroundColor: isDark ? "#0d0f14" : "#ffffff",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
          boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.4)" : "0 2px 10px rgba(0, 0, 0, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          {/* Left: Method Badge + URL */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              flex: 1,
            }}
          >
            {/* GET Badge */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 9px",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.06em",
                borderRadius: "4px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontFamily: MONO_FONT,
              }}
            >
              GET
            </span>

            {/* Endpoint URL */}
            <code
              style={{
                fontFamily: MONO_FONT,
                fontSize: "13.5px",
                fontWeight: 600,
                color: isDark ? "#f1f5f9" : "#0f172a",
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                padding: "4px 10px",
                borderRadius: "5px",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
                wordBreak: "break-all",
              }}
            >
              {fullEndpointUrl}
            </code>

            {/* Copy URL Button */}
            <button
              type="button"
              onClick={handleCopyUrl}
              title="Copy endpoint URL"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "none",
                background: "transparent",
                color: copiedUrl ? "#10b981" : isDark ? "#9ca3af" : "#64748b",
                cursor: "pointer",
                transition: "color 0.15s ease",
              }}
            >
              {copiedUrl ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span style={{ fontFamily: SERIF_FONT }}>{copiedUrl ? "Copied" : "Copy URL"}</span>
            </button>
          </div>

          {/* Right: Live GET Execution Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={executeGetModels}
              disabled={isLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: SERIF_FONT,
                borderRadius: "6px",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                boxShadow: "0 2px 10px rgba(239, 68, 68, 0.25)",
                transition: "all 0.15s ease",
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = "#dc2626";
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = "#ef4444";
              }}
            >
              {isLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Play size={13} fill="#ffffff" />
              )}
              <span>{isLoading ? "Fetching..." : "Send GET Request"}</span>
            </button>
          </div>
        </div>

        {/* Status Line / Metadata */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            paddingTop: "10px",
            borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
            fontSize: "12px",
            fontFamily: MONO_FONT,
            color: isDark ? "#9ca3af" : "#64748b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {responseStatus !== null && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  backgroundColor: responseStatus === 200 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: responseStatus === 200 ? "#10b981" : "#ef4444",
                  fontWeight: 700,
                }}
              >
                ● {responseStatus} {responseStatus === 200 ? "OK" : "Error"}
              </span>
            )}

            {latencyMs !== null && <span>Latency: {latencyMs}ms</span>}

            <span>
              Loaded: <strong>{models.length}</strong> {models.length === 1 ? "model" : "models"}
            </span>
          </div>

          {/* Toggle Raw JSON Response */}
          {rawResponse && (
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "transparent",
                border: "none",
                color: isDark ? "#9ca3af" : "#64748b",
                cursor: "pointer",
                fontSize: "11.5px",
                fontFamily: SERIF_FONT,
                padding: "2px 4px",
              }}
            >
              <Code2 size={13} />
              <span>{showRawJson ? "Hide Raw JSON" : "View Raw JSON"}</span>
              {showRawJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>

        {/* Collapsible Raw JSON Response Viewer */}
        <AnimatePresence>
          {showRawJson && rawResponse && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: "14px",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "#050608" : "#f1f5f9",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
                  color: isDark ? "#4ade80" : "#15803d",
                  fontFamily: MONO_FONT,
                  fontSize: "12px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          flexWrap: "wrap",
          padding: "14px 18px",
          borderRadius: "8px",
          backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Search input */}
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: "260px",
            maxWidth: "520px",
          }}
        >
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: isDark ? "#6b7280" : "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search uploaded models by name or id..."
            style={{
              width: "100%",
              padding: "9px 36px 9px 36px",
              fontSize: "13.5px",
              borderRadius: "6px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.15)",
              backgroundColor: isDark ? "#0d0d0d" : "#ffffff",
              color: isDark ? "#ffffff" : "#0f172a",
              outline: "none",
              fontFamily: MONO_FONT,
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#ef4444";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.15)";
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: isDark ? "#9ca3af" : "#64748b",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Counter and Copy All button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "12.5px",
              fontFamily: MONO_FONT,
              color: isDark ? "#9ca3af" : "#64748b",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
              padding: "5px 10px",
              borderRadius: "5px",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            {filteredModels.length} {filteredModels.length === 1 ? "model" : "models"}
          </span>

          <button
            type="button"
            onClick={handleCopyAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12.5px",
              fontFamily: SERIF_FONT,
              color: copiedAll ? "#10b981" : isDark ? "#e5e7eb" : "#334155",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
              border: copiedAll
                ? "1px solid #10b981"
                : isDark
                ? "1px solid rgba(255, 255, 255, 0.1)"
                : "1px solid rgba(0, 0, 0, 0.12)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {copiedAll ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copiedAll ? "Copied All!" : "Copy All"}</span>
          </button>
        </div>
      </div>

      {/* ── Models Grid (Model names returned from GET) ── */}
      {filteredModels.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            borderRadius: "8px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
            border: isDark ? "1px dashed rgba(255, 255, 255, 0.1)" : "1px dashed rgba(0, 0, 0, 0.12)",
          }}
        >
          <p style={{ margin: 0, fontSize: "14px", color: isDark ? "#9ca3af" : "#64748b" }}>
            No models found matching &quot;{searchQuery}&quot;
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            style={{
              marginTop: "12px",
              background: "transparent",
              border: "none",
              color: "#ef4444",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "10px",
          }}
        >
          {filteredModels.map((item) => {
            const isCopied = copiedModel === item.id;

            return (
              <div
                key={item.id}
                onClick={() => handleCopyModel(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCopyModel(item.id);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: "6px",
                  backgroundColor: isDark
                    ? isCopied
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(255, 255, 255, 0.03)"
                    : isCopied
                    ? "rgba(16, 185, 129, 0.08)"
                    : "#ffffff",
                  border: isDark
                    ? isCopied
                      ? "1px solid rgba(16, 185, 129, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.08)"
                    : isCopied
                    ? "1px solid rgba(16, 185, 129, 0.4)"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isCopied) {
                    e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.22)";
                    e.currentTarget.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.06)" : "#f8fafc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCopied) {
                    e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
                    e.currentTarget.style.backgroundColor = isDark ? "rgba(255, 255, 255, 0.03)" : "#ffffff";
                  }
                }}
              >
                {/* Model Name / ID */}
                <span
                  style={{
                    fontFamily: MONO_FONT,
                    fontSize: "13px",
                    fontWeight: 500,
                    color: isCopied
                      ? "#10b981"
                      : isDark
                      ? "#f1f5f9"
                      : "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginRight: "8px",
                  }}
                >
                  {item.id}
                </span>

                {/* Copy Status Icon */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  {isCopied ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#10b981",
                        fontFamily: SERIF_FONT,
                      }}
                    >
                      <Check size={12} strokeWidth={2.5} />
                      <span>Copied</span>
                    </span>
                  ) : (
                    <Copy
                      size={13}
                      style={{
                        color: isDark ? "#6b7280" : "#94a3b8",
                        transition: "color 0.15s ease",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
