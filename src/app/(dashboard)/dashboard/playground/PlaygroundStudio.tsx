"use client";

/**
 * PlaygroundStudio — Multimodal Playground Studio (80/20 Layout).
 *
 * Left Section (80%):
 *  - Rich conversational testbench with streaming/live execution.
 *  - Message history (User vs Assistant), latency benchmarks, token count.
 *  - Bottom input bar with text prompt + image upload/attachment support.
 *
 * Right Section (20%):
 *  - Models & Combos dropdown (strictly active curated models and created combos).
 *  - Target details (provider, limits/quota, capabilities chips).
 *  - Multimodal Capability Palette (9 presets: Text, Code, Reasoning, Vision, OCR, Search, Audio, etc.)
 *    that auto-load the prompt and preview data into the chat input.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAPABILITY_PRESETS,
  type CapabilityPreset,
} from "../providers/components/DefaultCapabilitiesPromptModal";

export interface CapabilityBadge {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
}

export function getCapabilityBadges(caps: string[]): CapabilityBadge[] {
  const map: Record<string, { icon: string; colorClass: string }> = {
    Vision: {
      icon: "visibility",
      colorClass: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    },
    Reasoning: {
      icon: "psychology",
      colorClass: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    },
    Tools: {
      icon: "build",
      colorClass: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    },
    Code: {
      icon: "code",
      colorClass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    },
    Chat: {
      icon: "chat",
      colorClass: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    },
    Combo: {
      icon: "layers",
      colorClass: "text-pink-400 bg-pink-400/10 border-pink-400/30",
    },
    Audio: {
      icon: "volume_up",
      colorClass: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    },
  };

  return caps.map((c) => ({
    id: c,
    label: c,
    icon: map[c]?.icon || "check_circle",
    colorClass: map[c]?.colorClass || "text-zinc-300 bg-white/10 border-white/15",
  }));
}

export interface TargetOption {
  id: string; // The identifier sent as `model` in API calls
  name: string; // Display label
  type: "model" | "combo";
  provider: string;
  capabilities: string[];
  limits: string;
  contextWindow?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl?: string;
  latencyMs?: number;
  modelServed?: string;
  timestamp: string;
  isError?: boolean;
}

export function PlaygroundStudio() {
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [loadingTargets, setLoadingTargets] = useState<boolean>(true);

  // Authentication API Key state for testing
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Load API Key on mount (from localStorage or default config endpoint)
  useEffect(() => {
    const savedKey =
      typeof window !== "undefined" ? localStorage.getItem("cheaproute_playground_api_key") : null;
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      fetch("/api/v1/playground/config")
        .then((r) => r.json())
        .then((cfg) => {
          if (cfg?.success && cfg.apiKey) {
            setApiKey(cfg.apiKey);
            try {
              localStorage.setItem("cheaproute_playground_api_key", cfg.apiKey);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    try {
      if (newKey) {
        localStorage.setItem("cheaproute_playground_api_key", newKey);
      } else {
        localStorage.removeItem("cheaproute_playground_api_key");
      }
    } catch {}
  };

  // Load active piped models and combos strictly from /v1/models
  useEffect(() => {
    let cancelled = false;

    async function loadAvailableTargets() {
      setLoadingTargets(true);
      try {
        const res = await fetch("/v1/models").catch(() => null);
        const targetList: TargetOption[] = [];

        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          const modelsList: Array<{
            id: string;
            name?: string;
            owned_by?: string;
            context_window?: number | null;
            context_length?: number | null;
            capabilities?: {
              vision?: boolean;
              tool_calling?: boolean;
              reasoning?: boolean;
            };
            input_modalities?: string[];
            pricing_tier?: string;
          }> = Array.isArray(data?.data) ? data.data : [];

          for (const m of modelsList) {
            const isCombo = m.owned_by === "combo";
            const modelId = String(m.id || "").trim();
            if (!modelId) continue;

            const displayName = String(m.name || m.id || "").trim();
            const providerName = isCombo
              ? "CheapRouter Combo"
              : String(m.owned_by || "Provider");

            const hasVision =
              m.capabilities?.vision === true ||
              (Array.isArray(m.input_modalities) && m.input_modalities.includes("image")) ||
              /vision|vl|omni|image|gpt-4o|gemini-1.5/i.test(`${modelId} ${displayName}`);

            const hasReasoning =
              m.capabilities?.reasoning === true ||
              /reason|o1|o3|r1|deepseek-r1|thinking|instruct/i.test(`${modelId} ${displayName}`);

            const hasTools =
              m.capabilities?.tool_calling === true || /tool|function/i.test(modelId);

            const hasCode = /code|coder/i.test(`${modelId} ${displayName}`);

            const hasAudio =
              (Array.isArray(m.input_modalities) && m.input_modalities.includes("audio")) ||
              /audio|whisper|speech/i.test(`${modelId} ${displayName}`);

            const caps: string[] = [];
            if (isCombo) caps.push("Combo");
            caps.push("Chat");
            if (hasVision) caps.push("Vision");
            if (hasReasoning) caps.push("Reasoning");
            if (hasTools) caps.push("Tools");
            if (hasCode) caps.push("Code");
            if (hasAudio) caps.push("Audio");

            const contextWindow = m.context_window
              ? `${Math.round(m.context_window / 1000)}K`
              : m.context_length
              ? `${Math.round(m.context_length / 1000)}K`
              : undefined;

            targetList.push({
              id: modelId,
              name: displayName,
              type: isCombo ? "combo" : "model",
              provider: providerName,
              capabilities: caps,
              limits: isCombo ? "Multi-Target Failover" : "Piped / Quota Pool",
              contextWindow,
            });
          }
        }

        if (!cancelled) {
          setTargets(targetList);
          if (targetList.length > 0) {
            setSelectedTargetId((prev) =>
              prev && targetList.some((t) => t.id === prev) ? prev : targetList[0].id
            );
          }
        }
      } catch (err) {
        console.error("Failed to load targets for playground:", err);
      } finally {
        if (!cancelled) setLoadingTargets(false);
      }
    }

    void loadAvailableTargets();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTarget = useMemo(() => {
    return targets.find((t) => t.id === selectedTargetId) || targets[0] || null;
  }, [targets, selectedTargetId]);

  // Load a capability preset into the prompt and attachment
  const handleSelectPreset = useCallback((preset: CapabilityPreset) => {
    setActivePresetId(preset.id);
    setInputPrompt(preset.prompt);
    if (preset.imageUrl) {
      setAttachedImage(preset.imageUrl);
    } else {
      setAttachedImage(null);
    }
  }, []);

  // Handle local image attachment
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setAttachedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Send message
  const handleSendMessage = async () => {
    const text = inputPrompt.trim();
    if ((!text && !attachedImage) || !selectedTarget || isSending) return;

    const userMessageId = `msg-${Date.now()}`;
    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text,
      imageUrl: attachedImage || undefined,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputPrompt("");
    setAttachedImage(null);
    setActivePresetId(null);
    setIsSending(true);

    const startTime = Date.now();

    try {
      // Build OpenAI-compliant chat messages array
      const apiMessages = [...messages, newUserMessage].map((m) => {
        if (m.imageUrl) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "Analyze the image." },
              { type: "image_url", image_url: { url: m.imageUrl } },
            ],
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey.trim()) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      }

      const res = await fetch("/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: selectedTarget.id,
          messages: apiMessages,
          stream: false,
        }),
      });

      const latencyMs = Date.now() - startTime;
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message || data?.error || `HTTP ${res.status}: Failed to get response`;
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: errorMsg,
            latencyMs,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ]);
        return;
      }

      const responseText =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        JSON.stringify(data, null, 2);

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: typeof responseText === "string" ? responseText : JSON.stringify(responseText),
          latencyMs,
          modelServed: data?.model || selectedTarget.id,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: err instanceof Error ? err.message : "Network error occurred",
          latencyMs: Date.now() - startTime,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setInputPrompt("");
    setAttachedImage(null);
    setActivePresetId(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4.5rem)] w-full gap-3 p-3 overflow-hidden bg-background">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEFT PORTION (80%): CHAT INTERFACE                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[80%] flex flex-col h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Top Header of Chat */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-white/[0.02] gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">science</span>
            <span className="font-semibold text-sm text-text-main truncate hidden sm:inline">
              Playground Live Testbench
            </span>
            {selectedTarget && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20 truncate">
                <span className="material-symbols-outlined text-[14px]">
                  {selectedTarget.type === "combo" ? "layers" : "smart_toy"}
                </span>
                <span className="truncate max-w-[140px] font-semibold">{selectedTarget.name}</span>
                <span className="flex items-center gap-0.5 ml-1 pl-1 border-l border-primary/20 shrink-0">
                  {getCapabilityBadges(selectedTarget.capabilities).map((b) => (
                    <span
                      key={b.id}
                      className="material-symbols-outlined text-[13px] text-zinc-300"
                      title={b.label}
                    >
                      {b.icon}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </div>

          {/* Center-Right: API Key Field & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 hover:border-white/20 focus-within:border-primary/60 rounded-xl px-2.5 py-1 transition-all max-w-[280px] sm:max-w-[340px]">
              <span className="material-symbols-outlined text-zinc-400 text-[16px] shrink-0">key</span>
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="API Key (sk-...)"
                className="bg-transparent text-xs text-text-main placeholder:text-text-muted/50 outline-none w-28 sm:w-40 font-mono truncate"
                title="CheapRoute API Key for Playground authentication"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title={showApiKey ? "Hide Key" : "Reveal Key"}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {showApiKey ? "visibility_off" : "visibility"}
                </span>
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={() => handleApiKeyChange("")}
                  className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                  title="Clear Key"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            {/* Auth status pill */}
            <span
              className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                apiKey
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-white/5 text-zinc-400 border-white/10"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${apiKey ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`}
              />
              {apiKey ? "Key Active" : "Public Mode"}
            </span>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                title="Clear conversation"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Stream Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-muted">
              <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-primary shadow-inner">
                <span className="material-symbols-outlined text-3xl">smart_toy</span>
              </div>
              <h3 className="font-semibold text-base text-text-main mb-1">
                {selectedTarget
                  ? `Ready to test ${selectedTarget.name}`
                  : "Select a Model or Combo"}
              </h3>
              <p className="text-xs max-w-md text-text-muted/80 leading-relaxed">
                Send a message below or pick a preset from the right palette to benchmark reasoning,
                code, OCR, vision, or text failover live.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-full`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-text-muted font-mono">
                    <span>
                      {isUser ? "You" : msg.modelServed || selectedTarget?.name || "Assistant"}
                    </span>
                    <span>·</span>
                    <span>{msg.timestamp}</span>
                    {msg.latencyMs != null && (
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-emerald-400 font-semibold">
                        {msg.latencyMs}ms
                      </span>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[85%] break-words whitespace-pre-wrap ${
                      isUser
                        ? "bg-primary text-white shadow-md rounded-tr-xs"
                        : msg.isError
                          ? "bg-red-500/15 border border-red-500/30 text-red-200 rounded-tl-xs"
                          : "bg-white/[0.06] border border-white/10 text-text-main rounded-tl-xs"
                    }`}
                  >
                    {msg.imageUrl && (
                      <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-white/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.imageUrl}
                          alt="Attached input"
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1 text-[11px] text-text-muted font-mono">
                <span>{selectedTarget?.name || "Assistant"}</span>
                <span>·</span>
                <span className="text-primary animate-pulse">Running live request…</span>
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white/[0.04] border border-white/10 rounded-tl-xs flex items-center gap-2 text-xs text-text-muted">
                <span className="material-symbols-outlined text-sm animate-spin text-primary">
                  progress_activity
                </span>
                <span>Generating response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attached image preview banner */}
        {attachedImage && (
          <div className="px-4 py-2 bg-white/[0.03] border-t border-white/10 flex items-center gap-2">
            <div className="relative size-12 rounded-lg overflow-hidden border border-white/20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachedImage} alt="Attachment" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-text-main block truncate">
                Image Attached ({activePresetId ? "Preset sample" : "Custom upload"})
              </span>
              <span className="text-[10px] text-text-muted block truncate">
                Ready for multimodal Vision / OCR analysis
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="size-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-text-muted hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {/* Bottom Chat Input Form */}
        <div className="p-3 border-t border-white/10 bg-white/[0.01]">
          <div className="flex items-end gap-2 bg-black/40 border border-white/15 focus-within:border-primary/60 rounded-xl p-2 transition-all shadow-inner">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="size-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Attach image for Vision / OCR"
            >
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            </button>

            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask anything or pick a test preset from the right..."
              className="flex-1 bg-transparent text-xs text-text-main placeholder:text-text-muted/60 resize-none outline-none leading-relaxed py-1"
            />

            <button
              type="button"
              onClick={() => void handleSendMessage()}
              disabled={isSending || (!inputPrompt.trim() && !attachedImage)}
              className="size-9 rounded-lg bg-[image:var(--grad-brand)] hover:brightness-105 active:scale-95 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-md"
              title="Send (Enter)"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSending ? "progress_activity" : "send"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RIGHT PORTION (20%): TARGETS & CAPABILITIES PALETTE         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[20%] flex flex-col gap-3 h-full overflow-y-auto pr-0.5">
        {/* Card 1: Target Dropdown & Info Card */}
        <div className="p-3.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl flex flex-col gap-3 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-main">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <span>Target Selection</span>
          </div>

          <label className="flex flex-col gap-1.5 text-[11px] text-text-muted">
            Active Model or Combo:
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              disabled={loadingTargets}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-text-main outline-none focus:border-primary cursor-pointer truncate"
            >
              {loadingTargets ? (
                <option value="">Loading active targets…</option>
              ) : targets.length === 0 ? (
                <option value="">No active models found</option>
              ) : (
                <>
                  <optgroup label="🌟 Combos">
                    {targets
                      .filter((t) => t.type === "combo")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🤖 Curated Models">
                    {targets
                      .filter((t) => t.type === "model")
                      .map((t) => {
                        const nonChatCaps = t.capabilities.filter((c) => c !== "Chat").join(", ");
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.provider}) {nonChatCaps ? `• ${nonChatCaps}` : ""}
                          </option>
                        );
                      })}
                  </optgroup>
                </>
              )}
            </select>
          </label>

          {/* Quick Capability Badges bar below select */}
          {selectedTarget && (
            <div className="flex flex-wrap items-center gap-1">
              {getCapabilityBadges(selectedTarget.capabilities).map((b) => (
                <span
                  key={b.id}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${b.colorClass}`}
                  title={`Supports ${b.label}`}
                >
                  <span className="material-symbols-outlined text-[12px]">{b.icon}</span>
                  <span>{b.label}</span>
                </span>
              ))}
            </div>
          )}

          {/* Selected Target Metadata */}
          {selectedTarget && (
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Provider:</span>
                <span className="font-semibold text-text-main truncate">
                  {selectedTarget.provider}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Limits:</span>
                <span className="font-mono text-emerald-400 text-[10px] truncate">
                  {selectedTarget.limits}
                </span>
              </div>
              {selectedTarget.contextWindow && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Context:</span>
                  <span className="font-mono text-cyan-300 text-[10px]">
                    {selectedTarget.contextWindow}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                {getCapabilityBadges(selectedTarget.capabilities).map((badge) => (
                  <span
                    key={badge.id}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${badge.colorClass}`}
                    title={`Supports ${badge.label}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{badge.icon}</span>
                    <span>{badge.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Multimodal Capabilities Palette */}
        <div className="p-3.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl flex flex-col gap-2.5 shadow-lg flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-main">
              <span className="material-symbols-outlined text-primary text-[18px]">
                auto_awesome
              </span>
              <span>Capabilities Palette</span>
            </div>
            <span className="text-[10px] text-text-muted">9 Presets</span>
          </div>

          <p className="text-[10px] text-text-muted leading-tight">
            Click any capability to auto-load its default multimodal prompt & sample into the chat.
          </p>

          <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto">
            {CAPABILITY_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary/20 border-primary text-white shadow-sm ring-1 ring-primary/30"
                      : "bg-white/[0.03] border-white/10 text-text-muted hover:text-text-main hover:bg-white/[0.08]"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] shrink-0 ${
                      isSelected ? "text-primary" : "text-zinc-400"
                    }`}
                  >
                    {preset.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-text-main truncate">
                        {preset.label}
                      </span>
                      <span className="text-[9px] font-mono opacity-60">{preset.category}</span>
                    </div>
                    <span className="text-[10px] text-text-muted/80 block truncate">
                      {preset.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
export default PlaygroundStudio;
