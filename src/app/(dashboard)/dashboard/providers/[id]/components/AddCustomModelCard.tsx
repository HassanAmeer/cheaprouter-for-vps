"use client";

import { useState } from "react";
import { useNotificationStore } from "@/store/notificationStore";

export const CAPABILITY_OPTIONS = [
  {
    id: "Text",
    label: "Text",
    icon: "chat",
    tooltip: "Text — Standard chat completion & text generation",
  },
  {
    id: "Vision",
    label: "Vision",
    icon: "visibility",
    tooltip: "Vision — Supports image input & visual analysis",
  },
  {
    id: "Code",
    label: "Code",
    icon: "code",
    tooltip: "Code — Optimized for programming & code generation",
  },
  {
    id: "Reasoning",
    label: "Reasoning",
    icon: "psychology",
    tooltip: "Reasoning — Advanced multi-step chain-of-thought logic",
  },
  {
    id: "Tools",
    label: "Tools",
    icon: "build",
    tooltip: "Tools — Supports function calling & agent tool execution",
  },
  {
    id: "Audio",
    label: "Audio",
    icon: "volume_up",
    tooltip: "Audio — Audio processing & audio generation",
  },
  {
    id: "Video",
    label: "Video",
    icon: "videocam",
    tooltip: "Video — Video processing & multimodal video analysis",
  },
  {
    id: "STT / TTS",
    label: "STT / TTS",
    icon: "record_voice_over",
    tooltip: "Speech — Speech-to-text transcription & speech synthesis",
  },
] as const;

export function parseManualContextWindow(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = /^(\d+(?:\.\d+)?)\s*([kKmM])?$/.exec(trimmed);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const suffix = (match[2] ?? "").toUpperCase();
  const scaled = suffix === "M" ? value * 1_000_000 : suffix === "K" ? value * 1000 : value;
  return Math.floor(scaled);
}

export interface AddCustomModelCardProps {
  providerId: string;
  onModelAdded: () => Promise<void> | void;
}

export default function AddCustomModelCard({
  providerId,
  onModelAdded,
}: AddCustomModelCardProps) {
  const notify = useNotificationStore();
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [contextLimit, setContextLimit] = useState("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(["Text"]);
  const [isFree, setIsFree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleCapability = (capId: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(capId) ? prev.filter((c) => c !== capId) : [...prev, capId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = modelId.trim();
    if (!trimmedId) {
      notify.error("Model ID is required");
      return;
    }

    setSubmitting(true);
    try {
      const contextTokens = parseManualContextWindow(contextLimit);
      const endpoints: string[] = ["chat"];
      if (selectedCapabilities.includes("Vision")) endpoints.push("images");
      if (selectedCapabilities.includes("Audio") || selectedCapabilities.includes("STT / TTS")) {
        endpoints.push("audio-speech", "audio-transcriptions");
      }
      if (selectedCapabilities.includes("Video")) endpoints.push("videos");

      const payload = {
        provider: providerId,
        modelId: trimmedId,
        modelName: modelName.trim() || undefined,
        apiFormat: "chat-completions",
        supportedEndpoints: endpoints,
        supportsVision: selectedCapabilities.includes("Vision"),
        reasoning: selectedCapabilities.includes("Reasoning"),
        ...(contextTokens != null ? { max_input_tokens: contextTokens } : {}),
        capabilities: selectedCapabilities,
        isFree,
      };

      const res = await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || data?.error || `Failed to add model (${res.status})`);
      }

      notify.success(`Custom model "${trimmedId}" added successfully`);
      setModelId("");
      setModelName("");
      setContextLimit("");
      setSelectedCapabilities(["Text"]);
      setIsFree(false);
      await onModelAdded();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to add model");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#121212] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#262626]/60 bg-[#161616]">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-[#C0C0C0]">add_box</span>
          <h3 className="text-sm font-semibold text-white">Add Custom Model</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="text-xs text-[#737373] hover:text-[#C0C0C0] transition-colors flex items-center gap-1"
        >
          <span>{isExpanded ? "Collapse" : "Expand"}</span>
          <span className="material-symbols-outlined text-[16px]">
            {isExpanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Model ID */}
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-xs font-medium text-[#C0C0C0]">
                Model ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="e.g. deepseek-ai/DeepSeek-V3"
                className="w-full px-3 py-2 text-sm bg-[#171717] text-white border border-[#333] rounded-lg focus:outline-none focus:border-[#C0C0C0] font-mono"
              />
            </div>

            {/* Model Name */}
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-xs font-medium text-[#C0C0C0]">
                Model Name <span className="text-[#737373] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. DeepSeek V3 (Production)"
                className="w-full px-3 py-2 text-sm bg-[#171717] text-white border border-[#333] rounded-lg focus:outline-none focus:border-[#C0C0C0]"
              />
            </div>

            {/* Context Limit */}
            <div className="flex flex-col gap-1.5 md:col-span-1">
              <label className="text-xs font-medium text-[#C0C0C0]">
                Context Limit <span className="text-[#737373] font-normal">(e.g. 128K, 1M)</span>
              </label>
              <input
                type="text"
                value={contextLimit}
                onChange={(e) => setContextLimit(e.target.value)}
                placeholder="e.g. 128K, 1M, 200K"
                className="w-full px-3 py-2 text-sm bg-[#171717] text-white border border-[#333] rounded-lg focus:outline-none focus:border-[#C0C0C0] font-mono"
              />
            </div>
          </div>

          {/* Capabilities Selector with Tooltips */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-[#C0C0C0]">
              Capabilities Selector <span className="text-[#737373] font-normal">(Hover for description)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {CAPABILITY_OPTIONS.map((cap) => {
                const isSelected = selectedCapabilities.includes(cap.id);
                return (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => toggleCapability(cap.id)}
                    title={cap.tooltip}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-black border-white shadow-xs font-semibold"
                        : "bg-[#181818] text-[#A3A3A3] border-[#333] hover:border-[#555] hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">
                      {cap.icon}
                    </span>
                    <span>{cap.label}</span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[13px] leading-none ml-0.5">
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FREE / PAID Toggle & Submit Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262626]/80">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-[#C0C0C0]">Billing Tier:</span>
              <button
                type="button"
                onClick={() => setIsFree((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isFree
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                }`}
                title={isFree ? "Marked as Free Tier model" : "Marked as Paid / Commercial model"}
              >
                <span className="size-2 rounded-full bg-current" />
                <span>{isFree ? "FREE Model" : "PAID Model"}</span>
                <span className="text-[10px] opacity-70 underline ml-1">Toggle</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#E5E5E5] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>Saving Model...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Add Model</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
