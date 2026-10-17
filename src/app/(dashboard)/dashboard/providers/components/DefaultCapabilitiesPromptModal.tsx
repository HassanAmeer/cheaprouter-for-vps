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
  {
    id: "embedding-text",
    label: "Embedding",
    category: "Embeddings",
    icon: "hub",
    description: "Semantic representation vector verification",
    prompt:
      "The quick brown fox jumps over the lazy dog. Vector semantic similarity search verification.",
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

      {/* ── OpenCode Right-Side Sheet ── */}
      <div
        className={`fixed inset-y-0 right-0 z-[10001] w-[90vw] sm:w-[500px] md:w-[540px] max-w-[90vw] sm:max-w-[540px] flex flex-col bg-[#0E0E10] text-white border-l border-border shadow-2xl rounded-l-2xl overflow-hidden transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* iOS Pull / Grabber Bar */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* ── OpenCode Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-[#0E0E10]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 rounded-lg bg-white/5 border border-border flex items-center justify-center text-text-main shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-text-main truncate">
                Capabilities Test Suite
              </h3>
              <p className="text-[11px] text-text-muted truncate">
                Model capability verification & prompt presets studio
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-20">
          {/* Information Banner */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-border flex items-start gap-2.5">
            <span className="material-symbols-outlined text-text-muted text-[17px] shrink-0 mt-0.5">
              info
            </span>
            <p className="text-xs text-text-muted leading-relaxed">
              Select a capability preset below or edit the prompt. When clicking{" "}
              <strong className="text-white font-medium">Test</strong> on any model row, this
              payload is sent upstream to verify capabilities.
            </p>
          </div>

          {/* Preset Cards Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-text-muted tracking-wider uppercase font-mono">
                Modality Presets ({CAPABILITY_PRESETS.length})
              </span>
              <span className="text-[10px] text-text-muted font-mono">Tap to apply</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {CAPABILITY_PRESETS.map((preset) => {
                const isSelected =
                  testPrompt === preset.prompt || selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer relative overflow-hidden group active:scale-[0.99] ${
                      isSelected
                        ? "bg-white/10 border-white/30 text-white shadow-sm ring-1 ring-white/20"
                        : "bg-white/[0.02] border-border text-zinc-300 hover:bg-white/[0.05] hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {/* Optional Image Thumbnail Preview */}
                    {preset.imageUrl ? (
                      <div className="relative size-11 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-[#0A0A0A]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.imageUrl}
                          alt={preset.label}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <span className="absolute bottom-0 right-0 p-0.5 bg-black/80 rounded-tl-md text-[9px]">
                          <span className="material-symbols-outlined text-[10px] leading-none text-white">
                            {preset.icon}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="size-11 rounded-lg bg-white/5 border border-border flex items-center justify-center flex-shrink-0 text-zinc-300">
                        <span className="material-symbols-outlined text-[18px]">{preset.icon}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-semibold truncate text-white">
                          {preset.label}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-white/5 border border-border text-text-muted">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5">
                        <span className="material-symbols-outlined text-emerald-400 text-[16px]">
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
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                <span>Active Test Prompt</span>
                <span className="text-[10px] font-mono text-text-muted">
                  ({testPrompt.length} chars)
                </span>
              </label>

              <button
                type="button"
                onClick={() => onPromptChange("Hi")}
                className="text-[11px] text-text-muted hover:text-text-main font-medium underline underline-offset-2 transition-colors cursor-pointer"
              >
                Reset to &ldquo;Hi&rdquo;
              </button>
            </div>

            <textarea
              value={testPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={3}
              placeholder="Enter custom prompt to verify model capabilities..."
              className="w-full p-3 text-xs bg-black/40 text-text-main border border-border rounded-lg font-mono focus:outline-none focus:border-border-strong transition-all resize-y placeholder:text-zinc-600 shadow-inner"
            />

            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="material-symbols-outlined text-[13px] text-emerald-400">
                check_circle
              </span>
              <span>Automatically applied when running tests on models table.</span>
            </div>
          </div>
        </div>

        {/* ── OpenCode Bottom Bar ── */}
        <div className="p-3.5 border-t border-border bg-[#0E0E10] shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={onToggle}
            className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-medium text-white transition-all cursor-pointer"
          >
            Done
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-90 border border-border flex items-center justify-center text-text-muted hover:text-white transition-all cursor-pointer"
            title="Close Capabilities Sheet"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[17px]">
              close
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Top-Right Header Trigger Button (OpenCode Style) ── */}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-xs active:scale-95 ${
          isOpen
            ? "bg-white/10 text-white border-white/30 ring-1 ring-white/15"
            : "border-border bg-bg-subtle text-text-main hover:bg-bg hover:border-border-strong"
        }`}
        title="Configure the global capabilities prompt sent during model verification"
      >
        <span className="material-symbols-outlined text-[16px] text-text-muted">psychology_alt</span>
        <span>Default Capabilities Prompt</span>
        <span className="material-symbols-outlined text-[14px] text-text-muted">tune</span>
      </button>

      {/* ── Render OpenCode Right-Side Sheet into Portal ── */}
      {isMounted && typeof document !== "undefined" && createPortal(sheetContent, document.body)}
    </>
  );
}

export function getPromptForCapability(capabilityKey: string, customPrompt?: string): string {
  const cap = capabilityKey.toLowerCase();
  if (cap === "vision") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "vision-cat")?.prompt ||
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600 Describe the subject, colors, fur texture, and expression in this image in vivid detail."
    );
  }
  if (cap === "image_gen" || cap === "image" || cap === "diffusion" || cap === "text-to-image" || cap === "palette") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "text-to-image")?.prompt ||
      "A hyper-realistic cyberpunk metropolis at twilight, holographic neon signs, reflections on rain-slicked asphalt, octane render 8k cinematic lighting."
    );
  }
  if (cap === "video") {
    return (
      CAPABILITY_PRESETS.find((p) => p.id === "video-multimodal")?.prompt ||
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4 Break down the scene transitions, camera pacing, and key dynamic events across timestamps."
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
  if (cap === "embedding" || cap === "embeddings" || cap === "vector") {
    return (
      customPrompt ||
      CAPABILITY_PRESETS.find((p) => p.id === "embedding-text")?.prompt ||
      "The quick brown fox jumps over the lazy dog. Vector semantic similarity search verification."
    );
  }
  // Default: text / chat
  return (
    customPrompt ||
    CAPABILITY_PRESETS.find((p) => p.id === "text-hi")?.prompt ||
    "Hi! Explain your core architecture and reasoning capabilities in two concise sentences."
  );
}
