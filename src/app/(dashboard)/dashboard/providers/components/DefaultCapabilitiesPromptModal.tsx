"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

const emptySubscribe = () => () => {};

export default function DefaultCapabilitiesPromptModal({
  testPrompt,
  onPromptChange,
  isOpen,
  onToggle,
}: DefaultCapabilitiesPromptModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("text-hi");
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Lock body scroll when the right-side sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Handle ESC key to dismiss sheet
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  const handleSelectPreset = (preset: CapabilityPreset) => {
    setSelectedPresetId(preset.id);
    onPromptChange(preset.prompt);
  };

  const sheetContent = (
    <div
      className={`fixed inset-0 z-[10000] transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-modal="true"
      role="dialog"
    >
      {/* ── Cupertino Frosted Backdrop Overlay ── */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onToggle}
        aria-hidden="true"
      />

      {/* ── Cupertino iOS Right-Side Sheet ── */}
      <div
        className={`fixed inset-y-0 right-0 z-[10001] w-[90vw] sm:w-[500px] md:w-[540px] max-w-[90vw] sm:max-w-[540px] flex flex-col bg-[#161618]/95 dark:bg-[#121214]/95 text-white backdrop-blur-2xl border-l border-white/10 shadow-[-16px_0px_48px_rgba(0,0,0,0.7)] rounded-l-[28px] sm:rounded-l-[32px] overflow-hidden transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* iOS Pull / Grabber Bar */}
        <div className="w-10 h-1.2 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* ── Cupertino Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm shadow-cyan-500/10">
              <span className="material-symbols-outlined text-[20px]">psychology_alt</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-white truncate">
                Capabilities Test Suite
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Cupertino model capability verification studio
              </p>
            </div>
          </div>

          {/* Top-Right Secondary Close Icon Button */}
          <button
            type="button"
            onClick={onToggle}
            className="size-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Close"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* ── Scrollable Presets & Config Area ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-24">
          {/* Information Banner */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8 backdrop-blur-md flex items-start gap-3">
            <span className="material-symbols-outlined text-cyan-400 text-[18px] shrink-0 mt-0.5">
              info
            </span>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Select a capability preset below or edit the prompt. When clicking{" "}
              <strong className="text-white font-medium">Test</strong> on any model row, this
              payload is sent upstream to verify capabilities.
            </p>
          </div>

          {/* Preset Cards Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 tracking-wider uppercase text-[10px]">
                Modality Presets ({CAPABILITY_PRESETS.length})
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">Tap to apply</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {CAPABILITY_PRESETS.map((preset) => {
                const isSelected =
                  testPrompt === preset.prompt || selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group active:scale-[0.99] ${
                      isSelected
                        ? "bg-white/[0.12] border-cyan-400/50 text-white shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/30"
                        : "bg-white/[0.03] border-white/8 text-zinc-300 hover:bg-white/[0.07] hover:border-white/15 hover:text-white"
                    }`}
                  >
                    {/* Optional Image Thumbnail Preview */}
                    {preset.imageUrl ? (
                      <div className="relative size-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-[#0A0A0A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.imageUrl}
                          alt={preset.label}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0 right-0 p-0.5 bg-black/75 rounded-tl-md text-[10px]">
                          <span className="material-symbols-outlined text-[11px] leading-none text-white">
                            {preset.icon}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-zinc-300">
                        <span className="material-symbols-outlined text-[20px]">{preset.icon}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold truncate text-white">
                          {preset.label}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-zinc-400">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <span className="material-symbols-outlined text-cyan-400 text-[18px]">
                          check_circle
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Prompt Textarea */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <span>Active Test Prompt</span>
                <span className="text-[10px] font-mono text-zinc-400">
                  ({testPrompt.length} chars)
                </span>
              </label>

              <button
                type="button"
                onClick={() => onPromptChange("Hi")}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                Reset to &ldquo;Hi&rdquo;
              </button>
            </div>

            <textarea
              value={testPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={3}
              placeholder="Enter custom prompt to verify model capabilities..."
              className="w-full p-3.5 text-xs bg-black/40 text-white border border-white/10 rounded-xl font-mono focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition-all resize-y placeholder-zinc-500 shadow-inner"
            />

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="material-symbols-outlined text-[14px] text-emerald-400">
                check_circle
              </span>
              <span>Automatically applied when running tests on models table.</span>
            </div>
          </div>
        </div>

        {/* ── Cupertino Bottom Bar with Right-Bottom Close Button ── */}
        <div className="p-4 border-t border-white/10 bg-[#161618]/90 backdrop-blur-xl shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={onToggle}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold text-white transition-all cursor-pointer"
          >
            Done
          </button>

          {/* User-requested: Right bottom side par close ka icon button in Cupertino iOS style */}
          <button
            type="button"
            onClick={onToggle}
            className="group size-11 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 border border-white/25 backdrop-blur-xl shadow-lg shadow-black/50 flex items-center justify-center text-white transition-all duration-200 cursor-pointer"
            title="Close Capabilities Sheet"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px] group-hover:rotate-90 transition-transform duration-200">
              close
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Top-Right Header Trigger Button ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-sm ${
          isOpen
            ? "bg-white text-black border-white ring-2 ring-white/20"
            : "bg-[#141414] text-[#C0C0C0] hover:text-white hover:bg-[#1C1C1C] border-[#2A2A2A] hover:border-[#404040]"
        }`}
        title="Configure the global capabilities prompt sent during model verification"
      >
        <span className="material-symbols-outlined text-[17px] text-cyan-400">psychology_alt</span>
        <span className="font-semibold">Default Capabilities Prompt</span>
        <span className="material-symbols-outlined text-[15px] opacity-60">info</span>
        <span className="material-symbols-outlined text-[16px] transition-transform">
          {isOpen ? "close" : "tune"}
        </span>
      </button>

      {/* ── Render Cupertino Right-Side Sheet into Portal ── */}
      {isMounted && typeof document !== "undefined" && createPortal(sheetContent, document.body)}
    </>
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
