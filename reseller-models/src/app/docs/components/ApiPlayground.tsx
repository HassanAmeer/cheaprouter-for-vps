"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Loader2,
  Key,
  Send,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Clock,
  Zap,
  AlertCircle,
  Eye,
  EyeOff,
  Code2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { copyToClipboard } from "@/lib/utils";

export interface EndpointOption {
  id: string;
  name: string;
  method: "GET" | "POST";
  path: string;
  requiresAuth: boolean;
  hasModel: boolean;
  defaultPayload?: (model: string) => string;
}

const DEFAULT_ENDPOINTS: EndpointOption[] = [
  {
    id: "chat-completions",
    name: "Chat Completions",
    method: "POST",
    path: "/v1/chat/completions",
    requiresAuth: true,
    hasModel: true,
    defaultPayload: (model) =>
      JSON.stringify(
        {
          model: model || "claude-3-5-sonnet",
          messages: [
            { role: "system", content: "You are an expert AI assistant." },
            { role: "user", content: "Hello! Confirm that CheapRouter API is working with high-speed response." },
          ],
          temperature: 0.7,
          stream: false,
        },
        null,
        2
      ),
  },
  {
    id: "anthropic-messages",
    name: "Anthropic Messages (Claude Code)",
    method: "POST",
    path: "/v1/messages",
    requiresAuth: true,
    hasModel: true,
    defaultPayload: (model) =>
      JSON.stringify(
        {
          model: model.includes("claude") ? model : "claude-3-5-sonnet",
          max_tokens: 1024,
          messages: [
            { role: "user", content: "Hello from Anthropic SDK compatible endpoint!" },
          ],
        },
        null,
        2
      ),
  },
  {
    id: "models",
    name: "Get All Models List",
    method: "GET",
    path: "/api/models",
    requiresAuth: false,
    hasModel: false,
  },
  {
    id: "account-status",
    name: "Account Balance & Status",
    method: "GET",
    path: "/v1/account",
    requiresAuth: true,
    hasModel: false,
  },
];

const POPULAR_MODELS = [
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", provider: "Anthropic" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "o1", name: "o1 Reasoning", provider: "OpenAI" },
  { id: "o3-mini", name: "o3-mini", provider: "OpenAI" },
  { id: "deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", provider: "Qwen" },
  { id: "nemotron-3_5-lightning_free", name: "Nemotron 3.5 Lightning (Free)", provider: "OpenRouter" },
  { id: "laguna-s-2.1-free", name: "Laguna S 2.1 (Free)", provider: "OpenCode" },
  { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash (Free)", provider: "OpenCode" },
  { id: "mimo-v2.5-free", name: "MiMo-V2.5 (Free)", provider: "OpenCode" },
];

export interface ApiPlaygroundProps {
  baseUrl?: string;
  endpoint?: string;
  method?: string;
  requiresAuth?: boolean;
  defaultPayload?: string;
  buttonText?: string;
}

export default function ApiPlayground({
  baseUrl,
  endpoint,
  method,
  requiresAuth,
  defaultPayload,
  buttonText,
}: ApiPlaygroundProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const initialEndpoint = endpoint
    ? DEFAULT_ENDPOINTS.find((ep) => ep.path === endpoint || endpoint.endsWith(ep.path)) || {
        id: "custom-endpoint",
        name: "Custom Endpoint",
        method: (method as "GET" | "POST") || "POST",
        path: endpoint,
        requiresAuth: requiresAuth ?? true,
        hasModel: true,
      }
    : DEFAULT_ENDPOINTS[0];
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointOption>(initialEndpoint);
  const [modelsList, setModelsList] = useState(POPULAR_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>("claude-3-5-sonnet");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [payloadText, setPayloadText] = useState(() =>
    defaultPayload
      ? defaultPayload
      : DEFAULT_ENDPOINTS[0].defaultPayload
      ? DEFAULT_ENDPOINTS[0].defaultPayload("claude-3-5-sonnet")
      : ""
  );

  const [responseOutput, setResponseOutput] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  // Fetch available models from backend
  const fetchLiveModels = async (outputToTerminal = false) => {
    setIsRefreshingModels(true);
    const startTime = performance.now();
    try {
      const res = await fetch("/api/models");
      const elapsed = Math.round(performance.now() - startTime);
      if (res.ok) {
        const data = await res.json();
        if (data?.models && Array.isArray(data.models)) {
          const liveModels = data.models
            .filter((m: any) => m && (m.id || m.name || typeof m === "string"))
            .map((m: any) => ({
              id: typeof m === "string" ? m : m.id || m.name,
              name: typeof m === "string" ? m : m.name || m.id,
              provider: (typeof m !== "string" && m.provider) || "CheapRouter",
            }));

          if (liveModels.length > 0) {
            setModelsList(liveModels);
            if (!liveModels.some((lm: any) => lm.id === selectedModel)) {
              handleModelChange(liveModels[0].id);
            }
          }
        }

        if (outputToTerminal) {
          setStatusCode(res.status);
          setStatusText(res.statusText || "OK");
          setLatencyMs(elapsed);
          setResponseOutput(JSON.stringify(data, null, 2));
        }
      } else if (outputToTerminal) {
        setStatusCode(res.status);
        setStatusText("Error");
        setLatencyMs(elapsed);
        setResponseOutput(JSON.stringify({ error: "Failed to fetch models" }, null, 2));
      }
    } catch (e: any) {
      console.warn("Failed to fetch models", e);
      if (outputToTerminal) {
        setStatusCode(500);
        setStatusText("Network Error");
        setResponseOutput(JSON.stringify({ error: e.message || "Failed to fetch models" }, null, 2));
      }
    } finally {
      setIsRefreshingModels(false);
    }
  };

  // Load saved API key from localStorage and fetch available models on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("cheaprouter_test_api_key");
      if (savedKey) setApiKey(savedKey);
      fetchLiveModels(false);
    }
  }, []);

  // Update apiKey in localStorage
  const handleKeyChange = (val: string) => {
    setApiKey(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("cheaprouter_test_api_key", val);
    }
  };

  // When endpoint changes, update method & default payload
  const handleEndpointSelect = (ep: EndpointOption) => {
    setSelectedEndpoint(ep);
    setStatusCode(null);
    setStatusText(null);
    setLatencyMs(null);
    setResponseOutput(null);

    if (ep.method === "POST" && ep.defaultPayload) {
      setPayloadText(ep.defaultPayload(selectedModel));
    } else {
      setPayloadText("");
    }

    // Automatically load models list when Get All Models List is selected
    if (ep.id === "models") {
      fetchLiveModels(true);
    }
  };

  // When model changes, update the model field inside the JSON payload automatically
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (selectedEndpoint.method === "POST" && payloadText) {
      try {
        const parsed = JSON.parse(payloadText);
        parsed.model = modelId;
        setPayloadText(JSON.stringify(parsed, null, 2));
      } catch {
        // If malformed, use regex replace or fallback to default
        if (payloadText.includes('"model"')) {
          const updated = payloadText.replace(/"model":\s*"[^"]*"/, `"model": "${modelId}"`);
          setPayloadText(updated);
        } else if (selectedEndpoint.defaultPayload) {
          setPayloadText(selectedEndpoint.defaultPayload(modelId));
        }
      }
    }
  };

  // Quick Preset Handlers
  const handleQuickPreset = (type: "ping" | "json" | "stream") => {
    if (selectedEndpoint.id !== "chat-completions") {
      handleEndpointSelect(DEFAULT_ENDPOINTS[0]);
    }
    if (type === "ping") {
      setPayloadText(
        JSON.stringify(
          {
            model: selectedModel,
            messages: [{ role: "user", content: "Reply with 'CheapRouter API is online and healthy!' in one sentence." }],
            temperature: 0.2,
            stream: false,
          },
          null,
          2
        )
      );
    } else if (type === "json") {
      setPayloadText(
        JSON.stringify(
          {
            model: selectedModel,
            messages: [
              {
                role: "system",
                content: "Output valid JSON only. Respond with a JSON list of 3 popular programming languages and their release years.",
              },
              { role: "user", content: "Give me the list now." },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
            stream: false,
          },
          null,
          2
        )
      );
    } else if (type === "stream") {
      setPayloadText(
        JSON.stringify(
          {
            model: selectedModel,
            messages: [{ role: "user", content: "Count from 1 to 5 with short explanations." }],
            temperature: 0.7,
            stream: true,
          },
          null,
          2
        )
      );
    }
  };

  // Execute Request
  const handleExecute = async () => {
    if (selectedEndpoint.requiresAuth && !apiKey.trim()) {
      setStatusCode(401);
      setStatusText("Unauthorized");
      setResponseOutput(
        JSON.stringify(
          {
            error: {
              message: "Please enter your CheapRouter API Key (sk-...) above before executing authenticated requests.",
              type: "authentication_error",
            },
          },
          null,
          2
        )
      );
      return;
    }

    setLoading(true);
    setResponseOutput(null);
    setStatusCode(null);
    setStatusText(null);
    setLatencyMs(null);

    const startTime = performance.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (apiKey.trim()) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
        headers["x-api-key"] = apiKey.trim();
      }

      // Check stream flag
      let isStream = false;
      if (selectedEndpoint.method === "POST" && payloadText) {
        try {
          const parsed = JSON.parse(payloadText);
          isStream = !!parsed.stream;
        } catch {}
      }

      const res = await fetch(selectedEndpoint.path, {
        method: selectedEndpoint.method,
        headers,
        body: selectedEndpoint.method === "POST" ? payloadText : undefined,
        signal: controller.signal,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);
      setStatusCode(res.status);
      setStatusText(res.statusText || (res.ok ? "OK" : "Error"));

      if (isStream && res.body && res.ok) {
        setLoading(false);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let streamedData = "=== SSE Streaming Response ===\n\n";
        setResponseOutput(streamedData);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedData += chunk;
          setResponseOutput(streamedData);
        }
        return;
      }

      const raw = await res.text();
      try {
        const json = JSON.parse(raw);
        setResponseOutput(JSON.stringify(json, null, 2));
      } catch {
        setResponseOutput(raw);
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);
      if (err.name === "AbortError") {
        setStatusCode(0);
        setStatusText("Aborted");
        setResponseOutput("Request was cancelled by user.");
      } else {
        setStatusCode(500);
        setStatusText("Network Error");
        setResponseOutput(
          JSON.stringify(
            {
              error: {
                message: err.message || "Failed to fetch from endpoint. Ensure backend server is running.",
              },
            },
            null,
            2
          )
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopyResponse = async () => {
    if (!responseOutput) return;
    const success = await copyToClipboard(responseOutput);
    if (success) {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to execute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!loading) {
          handleExecute();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, selectedEndpoint, payloadText, apiKey]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        width: "100%",
        maxWidth: "1020px",
        margin: "0 auto",
      }}
    >
      {/* ── Control Bar: Endpoint Dropdown + Model Dropdown + Auth ── */}
      <div
        style={{
          backgroundColor: isDark ? "#0a0b0e" : "#ffffff",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
          borderRadius: "14px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Row 1: Endpoint Selector & Model Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {/* Endpoint Dropdown */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: isDark ? "#9ca3af" : "#64748b",
                marginBottom: "8px",
              }}
            >
              API Endpoint
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedEndpoint.id}
                onChange={(e) => {
                  const ep = DEFAULT_ENDPOINTS.find((item) => item.id === e.target.value);
                  if (ep) handleEndpointSelect(ep);
                }}
                style={{
                  width: "100%",
                  padding: "10px 36px 10px 12px",
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#050608" : "#f8fafc",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: isDark ? "#ffffff" : "#0f172a",
                  fontSize: "13px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  cursor: "pointer",
                  appearance: "none",
                  outline: "none",
                }}
              >
                {DEFAULT_ENDPOINTS.map((ep) => (
                  <option key={ep.id} value={ep.id} style={{ backgroundColor: isDark ? "#0e1015" : "#ffffff", color: isDark ? "#fff" : "#0f172a" }}>
                    {ep.method} {ep.path} ({ep.name})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: isDark ? "#9ca3af" : "#64748b",
                }}
              />
            </div>
          </div>

          {/* Model Selector (enabled when endpoint hasModel is true) */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: selectedEndpoint.hasModel ? (isDark ? "#9ca3af" : "#64748b") : (isDark ? "#4b5563" : "#94a3b8"),
                  }}
                >
                  Select AI Model
                </label>
                <button
                  type="button"
                  onClick={() => fetchLiveModels(false)}
                  title="Reload available models"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    padding: 0,
                    borderRadius: "4px",
                    border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    color: isRefreshingModels ? "#ef4444" : isDark ? "#9ca3af" : "#64748b",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RefreshCw size={11} className={isRefreshingModels ? "animate-spin text-red-500" : ""} />
                </button>
              </div>
              {selectedEndpoint.hasModel && (
                <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                  Syncs with JSON payload
                </span>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <select
                disabled={!selectedEndpoint.hasModel}
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 36px 10px 12px",
                  borderRadius: "8px",
                  backgroundColor: selectedEndpoint.hasModel
                    ? (isDark ? "#050608" : "#f8fafc")
                    : (isDark ? "#0d0e12" : "#f1f5f9"),
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: selectedEndpoint.hasModel
                    ? (isDark ? "#ffffff" : "#0f172a")
                    : "#94a3b8",
                  fontSize: "13px",
                  cursor: selectedEndpoint.hasModel ? "pointer" : "not-allowed",
                  appearance: "none",
                  outline: "none",
                }}
              >
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id} style={{ backgroundColor: isDark ? "#0e1015" : "#ffffff", color: isDark ? "#fff" : "#0f172a" }}>
                    {m.name} [{m.provider}]
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: selectedEndpoint.hasModel ? (isDark ? "#9ca3af" : "#64748b") : "#94a3b8",
                }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Quick Test Prompts (LEFT) & API Key Input (RIGHT) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "14px",
            alignItems: "end",
          }}
        >
          {/* Quick Presets Buttons (LEFT) */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: isDark ? "#9ca3af" : "#64748b",
                marginBottom: "8px",
              }}
            >
              Quick Test Prompts
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuickPreset("ping")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: isDark ? "#d1d5db" : "#334155",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)")}
              >
                👋 Ping Prompt
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("json")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: isDark ? "#d1d5db" : "#334155",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)")}
              >
                📄 JSON Schema
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("stream")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)")}
              >
                ⚡ SSE Stream
              </button>
            </div>
          </div>

          {/* API Key Input (RIGHT) */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isDark ? "#9ca3af" : "#64748b",
                }}
              >
                <Key size={12} className="text-red-500" />
                <span>CheapRouter API Key</span>
              </label>
              <span style={{ fontSize: "11px", color: isDark ? "#6b7280" : "#94a3b8" }}>
                {selectedEndpoint.requiresAuth ? "(Required for /v1)" : "(Optional for public)"}
              </span>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="sk-..."
                style={{
                  width: "100%",
                  padding: "10px 42px 10px 12px",
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#050608" : "#f8fafc",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: isDark ? "#ffffff" : "#0f172a",
                  fontSize: "13px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: isDark ? "#9ca3af" : "#64748b",
                  cursor: "pointer",
                  padding: "4px",
                }}
                title={showKey ? "Hide API Key" : "Show API Key"}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Playground Interface ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "18px",
          alignItems: "stretch",
        }}
      >
        {/* Left Column: Request & Payload Editor */}
        <div
          style={{
            backgroundColor: isDark ? "#0a0b0e" : "#ffffff",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minHeight: "480px",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 800,
                  backgroundColor:
                    selectedEndpoint.method === "POST" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                  color: selectedEndpoint.method === "POST" ? "#ef4444" : "#10b981",
                  border: `1px solid ${
                    selectedEndpoint.method === "POST" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"
                  }`,
                }}
              >
                {selectedEndpoint.method}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  color: "#ffffff",
                  fontWeight: 600,
                }}
              >
                {selectedEndpoint.path}
              </span>
            </div>

            {/* Execute Request Button */}
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                borderRadius: "8px",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(239,68,68,0.35)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#dc2626";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#ef4444";
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{loading ? "Sending..." : "Execute API"}</span>
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.7,
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "3px",
                  padding: "1px 4px",
                  marginLeft: "4px",
                }}
              >
                ⌘↵
              </span>
            </button>
          </div>

          {/* Body Editor or GET info */}
          {selectedEndpoint.method === "POST" ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#9ca3af",
                  }}
                >
                  JSON Payload Body
                </span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      setPayloadText(JSON.stringify(JSON.parse(payloadText), null, 2));
                    } catch {}
                  }}
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Prettify JSON
                </button>
              </div>

              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                style={{
                  flex: 1,
                  minHeight: "340px",
                  width: "100%",
                  padding: "14px",
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#050608" : "#f8fafc",
                  border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
                  color: isDark ? "#f3f4f6" : "#0f172a",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "12.5px",
                  lineHeight: "1.6",
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "#050608" : "#f8fafc",
                borderRadius: "8px",
                border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
                padding: "32px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                  marginBottom: "16px",
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ color: isDark ? "#ffffff" : "#0f172a", fontSize: "16px", fontWeight: 600, margin: "0 0 8px 0" }}>
                Ready to Execute GET Request
              </h4>
              <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "13px", maxWidth: "340px", lineHeight: "1.5", margin: 0 }}>
                This endpoint does not require a request body. Click <strong>Execute API</strong> above to view live
                data from the server.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Response Output Terminal */}
        <div
          style={{
            backgroundColor: isDark ? "#0a0b0e" : "#ffffff",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minHeight: "480px",
          }}
        >
          {/* Output Terminal Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
              paddingBottom: "12px",
              borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isDark ? "#9ca3af" : "#64748b",
                }}
              >
                API Response Output
              </span>

              {/* Status Code badge */}
              {statusCode !== null && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor:
                      statusCode >= 200 && statusCode < 300
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(239,68,68,0.15)",
                    color: statusCode >= 200 && statusCode < 300 ? "#10b981" : "#ef4444",
                    border: `1px solid ${
                      statusCode >= 200 && statusCode < 300
                        ? "rgba(16,185,129,0.3)"
                        : "rgba(239,68,68,0.3)"
                    }`,
                  }}
                >
                  {statusCode} {statusText}
                </span>
              )}

              {/* Latency badge */}
              {latencyMs !== null && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: isDark ? "#9ca3af" : "#64748b",
                  }}
                >
                  <Clock size={12} />
                  <span>{latencyMs}ms</span>
                </span>
              )}
            </div>

            {/* Copy button */}
            {responseOutput && (
              <button
                type="button"
                onClick={handleCopyResponse}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 10px",
                  borderRadius: "5px",
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                  color: copiedResponse ? "#34d399" : (isDark ? "#d1d5db" : "#334155"),
                  fontSize: "11.5px",
                  cursor: "pointer",
                }}
              >
                {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedResponse ? "Copied" : "Copy"}</span>
              </button>
            )}
          </div>

          {/* Terminal Content Box */}
          <div
            style={{
              flex: 1,
              backgroundColor: isDark ? "#050608" : "#0d1117",
              borderRadius: "8px",
              border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.12)",
              padding: "16px",
              overflowY: "auto",
              maxHeight: "520px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {loading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "#9ca3af",
                }}
              >
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span style={{ fontSize: "13px", fontFamily: "ui-monospace, monospace" }}>
                  Streaming response from CheapRouter gateway...
                </span>
              </div>
            ) : responseOutput ? (
              <pre
                style={{
                  margin: 0,
                  fontSize: "12.5px",
                  color: statusCode && statusCode >= 400 ? "#f87171" : "#e5e7eb",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                <code>{responseOutput}</code>
              </pre>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  color: "#6b7280",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                <Code2 size={32} style={{ opacity: 0.4 }} />
                <span style={{ fontSize: "13px", fontFamily: "ui-monospace, monospace" }}>
                  Awaiting execution... Select an endpoint and click Execute API.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
