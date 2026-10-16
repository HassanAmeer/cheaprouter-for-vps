"use client";

import React from "react";
import OpenCode from "@lobehub/icons/es/OpenCode/components/Mono";
import KiloCode from "@lobehub/icons/es/KiloCode/components/Mono";
import Cline from "@lobehub/icons/es/Cline/components/Mono";
import RooCode from "@lobehub/icons/es/RooCode/components/Mono";
import ClaudeCodeColor from "@lobehub/icons/es/ClaudeCode/components/Color";
import CodexColor from "@lobehub/icons/es/Codex/components/Color";
import SillyTavernColor from "@lobehub/icons/es/SillyTavern/components/Color";
import OpenWebUI from "@lobehub/icons/es/OpenWebUI/components/Mono";
import { 
  Bot, 
  Terminal, 
  Layers, 
  Sparkles, 
  Cpu, 
  Code2, 
  Coins, 
  ShieldAlert, 
  BookOpen,
  LayoutGrid
} from "lucide-react";

interface GuideIconProps {
  iconKey: string;
  size?: number;
  className?: string;
}

export function GuideIcon({ iconKey, size = 18, className = "" }: GuideIconProps) {
  // LobeHub Icon components
  if (iconKey === "opencode") {
    return <OpenCode size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "kilo-code") {
    return <KiloCode size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "cline") {
    return <Cline size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "roo-code") {
    return <RooCode size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "claude-code") {
    return <ClaudeCodeColor size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "codex") {
    return <CodexColor size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "sillytavern") {
    return <SillyTavernColor size={size} className={`inline-block shrink-0 ${className}`} />;
  }
  if (iconKey === "open-webui") {
    return <OpenWebUI size={size} className={`inline-block shrink-0 ${className}`} />;
  }

  if (iconKey === "cursor") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`}>
        <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" />
      </svg>
    );
  }

  if (iconKey === "zed") {
    return (
      <img
        src="/images/icons/zed.svg?v=2"
        alt="Zed IDE"
        width={size}
        height={size}
        className={`inline-block object-contain shrink-0 rounded-[3px] ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Image files
  const IMAGE_ICONS: Record<string, string> = {
    anythingllm: "/images/icons/anythingllm.svg",
    zed: "/images/icons/zed.svg",
    "continue-dev": "/images/icons/continue-dev.svg",
    "janitor-ai": "/images/icons/janitor-ai.png",
    risuai: "/images/icons/risuai.png",
    chub: "/images/icons/chub-ai.png",
    nevika: "/images/icons/nevika.png",
    "cc-switch": "/images/icons/cc-switch.png",
    aider: "/images/icons/aider.svg",
    librechat: "/images/icons/librechat.svg",
    boltai: "/images/icons/boltai.svg",
    chatbox: "/images/icons/chatbox.png",
    typingmind: "/images/icons/typingmind.png",
  };

  if (IMAGE_ICONS[iconKey]) {
    return (
      <img
        src={IMAGE_ICONS[iconKey]}
        alt={iconKey}
        width={size}
        height={size}
        className={`inline-block object-contain shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Fallbacks for Platform / Core API items
  switch (iconKey) {
    case "ai-apps":
    case "grid":
      return <LayoutGrid size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "overview":
      return <BookOpen size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "models":
      return <Layers size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "chat-completions":
      return <Code2 size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "rate-limits":
      return <ShieldAlert size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "harness":
      return <Cpu size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "custom-api":
      return <Terminal size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    case "playground":
      return <Sparkles size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
    default:
      return <Bot size={size} className={`text-zinc-400 shrink-0 ${className}`} />;
  }
}
