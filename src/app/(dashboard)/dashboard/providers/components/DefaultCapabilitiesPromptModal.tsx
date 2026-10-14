"use client";

import { useState } from "react";

export interface CapabilityPreset {
  id: string;
  label: string;
  category: string;
  icon: string;
  prompt: string;
  imageUrl?: string;
  description: string;
}

export const CAPABILITY_PRESETS: CapabilityPreset[] = [
  {
    id: "text-hi",
    label: "Text / Hi",
    category: "Chat",
    icon: "chat",
    description: "Lightweight greeting & identity verification",
    prompt:
      "Hi! Explain your core architecture and reasoning capabilities in two concise sentences.",
  },
  {
    id: "code-html",
    label: "Code / HTML",
    category: "Coding",
    icon: "code",
    description: "Interactive modern UI button generation",
    prompt:
      "Generate a modern, responsive CSS button component with HTML, hover animations, and SVG icon.",
  },
  {
    id: "reasoning-math",
    label: "Reasoning",
    category: "Logic",
    icon: "psychology",
    description: "Chain-of-thought mathematical riddle",
    prompt:
      "A farmer has 17 sheep and all but 9 die. How many are left? Provide your detailed step-by-step reasoning.",
  },
  {
    id: "vision-cat",
    label: "Vision",
    category: "Multimodal",
    icon: "visibility",
    imageUrl:
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80",
    description: "Visual analysis of cat subject & lighting",
    prompt:
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600 Describe the subject, colors, fur texture, and expression in this image in vivid detail.",
  },
  {
    id: "ocr-receipt",
    label: "OCR",
    category: "Vision",
    icon: "document_scanner",
    imageUrl:
      "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
    description: "Tabular text & numerical extraction",
    prompt:
      "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600 Extract all legible text, numerical values, headers, and dates from this document.",
  },
  {
    id: "text-to-image",
    label: "Text to Image",
    category: "Diffusion",
    icon: "palette",
    imageUrl:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    description: "Photorealistic cyberpunk cityscape prompt",
    prompt:
      "A hyper-realistic cyberpunk metropolis at twilight, holographic neon signs, reflections on rain-slicked asphalt, octane render 8k cinematic lighting.",
  },
  {
    id: "image-to-image",
    label: "Image to Image",
    category: "Diffusion",
    icon: "brush",
    imageUrl:
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
    description: "Stylistic artistic re-interpretation",
    prompt:
      "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600 Re-imagine this painting in the style of Japanese ukiyo-e woodblock print with vibrant vermilion and indigo.",
  },
  {
    id: "video-multimodal",
    label: "Video Analysis",
    category: "Video",
    icon: "videocam",
    imageUrl:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80",
    description: "Temporal scene & camera motion breakdown",
    prompt:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4 Break down the scene transitions, camera pacing, and key dynamic events across timestamps.",
  },
  {
    id: "audio-stt",
    label: "Audio / STT",
    category: "Audio",
    icon: "record_voice_over",
    imageUrl:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80",
    description: "Speech transcription & ambient acoustic analysis",
    prompt:
      "https://actions.google.com/sounds/v1/ambiences/outdoor_market.ogg Transcribe all spoken phrases and identify the background acoustic ambient sounds in this recording.",
  },
];

export interface DefaultCapabilitiesPromptModalProps {
  testPrompt: string;
  onPromptChange: (newPrompt: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function DefaultCapabilitiesPromptModal({
  testPrompt,
  onPromptChange,
  isOpen,
  onToggle,
}: DefaultCapabilitiesPromptModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("text-hi");

  const handleSelectPreset = (preset: CapabilityPreset) => {
    setSelectedPresetId(preset.id);
    onPromptChange(preset.prompt);
  };

  return (
    <div className="relative">
      {/* ── Top-Right Header Trigger Button ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-sm ${
          isOpen
            ? "bg-white text-black border-white ring-2 ring-white/20"
            : "bg-[#141414] text-[#C0C0C0] hover:text-white hover:bg-[#1C1C1C] border-[#2A2A2A] hover:border-[#404040]"
        }`}
        title="Configure the global capabilities prompt sent during model verification"
      >
        <span className="material-symbols-outlined text-[17px] text-[#A3A3A3]">psychology_alt</span>
        <span className="font-semibold">Default Capabilities Prompt</span>
        <span className="material-symbols-outlined text-[15px] opacity-60">info</span>
        <span className="material-symbols-outlined text-[16px] transition-transform">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {/* ── Expandable Drawer / Modal ── */}
      {isOpen && (
        <div className="mt-3 p-5 rounded-xl border border-[#2A2A2A] bg-[#101010] shadow-2xl flex flex-col gap-4 text-white animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-[#222] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-[#C0C0C0]">tune</span>
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Default Capabilities Test Suite
                </h4>
                <p className="text-[11px] text-[#737373] mt-0.5">
                  Select a multimodal capability preset or customize your prompt below. When
                  clicking &ldquo;Test&rdquo; on any model, this payload is sent.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggle}
              className="p-1 rounded-md text-[#737373] hover:text-white hover:bg-[#1F1F1F] transition-colors"
              title="Close panel"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* ── Preset Cards Grid (9 comprehensive modalities with images) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {CAPABILITY_PRESETS.map((preset) => {
              const isSelected = testPrompt === preset.prompt || selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "bg-white/10 border-white/40 text-white shadow-md ring-1 ring-white/20"
                      : "bg-[#161616] border-[#262626] text-[#A3A3A3] hover:bg-[#1D1D1D] hover:text-white hover:border-[#383838]"
                  }`}
                >
                  {/* Optional Image Thumbnail Preview */}
                  {preset.imageUrl ? (
                    <div className="relative size-12 rounded-md overflow-hidden flex-shrink-0 border border-white/10 bg-[#0A0A0A]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preset.imageUrl}
                        alt={preset.label}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <span className="absolute bottom-0 right-0 p-0.5 bg-black/70 rounded-tl text-[10px]">
                        <span className="material-symbols-outlined text-[11px] leading-none text-white">
                          {preset.icon}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="size-10 rounded-md bg-[#222] border border-white/10 flex items-center justify-center flex-shrink-0 text-[#C0C0C0]">
                      <span className="material-symbols-outlined text-[18px]">{preset.icon}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate text-white">
                        {preset.label}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-[#737373]">
                        {preset.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#737373] mt-0.5 line-clamp-2 leading-tight">
                      {preset.description}
                    </p>
                  </div>

                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Active Prompt Editor Textarea ── */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-[#222]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#C0C0C0] flex items-center gap-1.5">
                <span>Active Test Prompt</span>
                <span className="text-[10px] font-mono text-[#737373]">
                  ({testPrompt.length} chars)
                </span>
              </label>

              <button
                type="button"
                onClick={() => onPromptChange("Hi")}
                className="text-[10px] font-mono text-[#737373] hover:text-white underline underline-offset-2"
              >
                Reset to &ldquo;Hi&rdquo;
              </button>
            </div>

            <textarea
              value={testPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={3}
              placeholder="Enter custom prompt to verify model capabilities..."
              className="w-full p-3 text-xs bg-[#141414] text-white border border-[#2E2E2E] rounded-lg font-mono focus:outline-none focus:border-[#C0C0C0] transition-colors resize-y placeholder-[#555]"
            />

            <div className="text-[11px] text-[#737373] flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-emerald-400">
                  check_circle
                </span>
                <span>
                  Dispatched upstream when clicking &ldquo;Test&rdquo; on any model row in the table
                  below.
                </span>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="px-3 py-1 rounded bg-white text-black font-semibold text-xs hover:bg-[#E5E5E5] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function getPromptForCapability(capabilityKey: string, customPrompt?: string): string {
  const cap = capabilityKey.toLowerCase();
  if (cap === "vision" || cap === "image") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "vision-cat")?.prompt ||
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600 Describe the subject, colors, fur texture, and expression in this image in vivid detail."
    );
  }
  if (cap === "code" || cap === "coding") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "code-html")?.prompt ||
      "Generate a modern, responsive CSS button component with HTML, hover animations, and SVG icon."
    );
  }
  if (cap === "reasoning" || cap === "thinking") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "reasoning-math")?.prompt ||
      "A farmer has 17 sheep and all but 9 die. How many are left? Provide your detailed step-by-step reasoning."
    );
  }
  if (cap === "search") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "search-web")?.prompt ||
      "What are the latest major AI breakthroughs and news announced this week?"
    );
  }
  if (cap === "audio" || cap === "stt" || cap === "tts") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "audio-stt")?.prompt ||
      "https://actions.google.com/sounds/v1/ambiences/outdoor_market.ogg Transcribe all spoken phrases and identify the background acoustic ambient sounds in this recording."
    );
  }
  if (cap === "ocr") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "ocr-receipt")?.prompt ||
      "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600 Extract all legible text, numerical values, headers, and dates from this document."
    );
  }
  // Default: text / chat
  return (
    customPrompt ||
    CAPABILITY_PRESETS.find((p) => p.id === "text-hi")?.prompt ||
    "Hi! Explain your core architecture and reasoning capabilities in two concise sentences."
  );
}
