"use client";

import React, { useState } from "react";
import { GuideIcon } from "../components/GuideIcon";
import { useTheme } from "@/components/theme-provider";

interface AiAppsViewProps {
  onSelectGuide: (slug: string) => void;
}

const DARK_C = {
  bg2: "#0a0a0a",
  bgHover: "#121316",
  iconBg: "#050505",
  border: "rgba(255,255,255,0.08)",
  borderHover: "rgba(255,255,255,0.18)",
  text: "#f9fafb",
  textSub: "#9ca3af",
  textMuted: "#6b7280",
};

const LIGHT_C = {
  bg2: "#ffffff",
  bgHover: "#f1f5f9",
  iconBg: "#f8fafc",
  border: "rgba(0,0,0,0.08)",
  borderHover: "rgba(0,0,0,0.18)",
  text: "#0f172a",
  textSub: "#475569",
  textMuted: "#64748b",
};

export function AiAppsView({ onSelectGuide }: AiAppsViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const C = isDark ? DARK_C : LIGHT_C;
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);

  const CODING_GUIDES = [
    { id: "opencode", name: "OpenCode", desc: "Terminal coding agent with auto-apply diffs" },
    { id: "kilo-code", name: "Kilo Code", desc: "Low-overhead terminal pair-programming CLI" },
    { id: "zed", name: "Zed IDE", desc: "High-performance code editor with native LLM assistant" },
    { id: "cline", name: "Cline", desc: "Autonomous coding agent for VS Code" },
    { id: "roo-code", name: "Roo Code", desc: "Multi-mode agent for VS Code with custom prompts" },
    { id: "continue-dev", name: "Continue.dev", desc: "Open-source AI autopilot for VS Code & JetBrains" },
    { id: "claude-code", name: "Claude Code", desc: "Anthropic's terminal CLI agent with full bash tool execution" },
    { id: "codex", name: "Codex CLI", desc: "Terminal agent with responses API support" },
    { id: "cursor", name: "Cursor IDE", desc: "AI-first editor with multi-file Composer and inline edits" },
    { id: "aider", name: "Aider", desc: "Terminal pair programming tool with git auto-commit" },
    { id: "cc-switch", name: "CC Switch", desc: "One-click model switching utility for Claude Code" },
    { id: "harness", name: "Agent Test Harness", desc: "E2E testing framework for complex coding agents" },
  ];

  const RP_GUIDES = [
    { id: "sillytavern", name: "SillyTavern", desc: "Advanced frontend for local & cloud AI storytellers" },
    { id: "janitor-ai", name: "Janitor.AI", desc: "Custom reverse proxy endpoint integration" },
    { id: "risuai", name: "RisuAI", desc: "Feature-rich character dialogue client" },
    { id: "chub", name: "Chub / Venus", desc: "Community lorebook & character platform" },
    { id: "nevika", name: "Nevika", desc: "Next-generation dialogue and narrative runner" },
  ];

  const CHAT_GUIDES = [
    { id: "open-webui", name: "Open WebUI", desc: "Feature-packed private chat, voice & document interface" },
    { id: "librechat", name: "LibreChat", desc: "Open-source AI chat platform with artifacts & search" },
    { id: "chatbox", name: "Chatbox", desc: "Cross-platform desktop application for Windows, macOS & Linux" },
    { id: "typingmind", name: "TypingMind", desc: "Advanced web client with plugins, artifacts, and voice chat" },
    { id: "anythingllm", name: "AnythingLLM", desc: "All-in-one desktop AI assistant for full document RAG" },
  ];

  const GuideCard = ({ guide }: { guide: { id: string; name: string; desc: string } }) => {
    const isHovered = hoveredGuide === guide.id;
    return (
      <button
        key={guide.id}
        onClick={() => onSelectGuide(guide.id)}
        onMouseEnter={() => setHoveredGuide(guide.id)}
        onMouseLeave={() => setHoveredGuide(null)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "12px",
          borderRadius: "10px",
          border: `1px solid ${isHovered ? C.borderHover : C.border}`,
          backgroundColor: isHovered ? C.bgHover : C.bg2,
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
          textAlign: "left",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "6px",
            border: `1px solid ${C.border}`,
            backgroundColor: C.iconBg,
            flexShrink: 0,
          }}
        >
          <GuideIcon iconKey={guide.id} size={16} />
        </div>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: C.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {guide.name}
            </span>
            {/* Arrow */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isHovered ? "#9ca3af" : "#4b5563"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginLeft: "6px", transition: "stroke 0.1s" }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: C.textMuted,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {guide.desc}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      style={{
        maxWidth: "720px",
        paddingBottom: "96px",
        color: C.text,
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}
    >
      {/* Header */}
      <div id="overview" style={{ marginBottom: "40px", paddingTop: "2px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            borderRadius: "9999px",
            border: `1px solid ${C.border}`,
            backgroundColor: C.bg2,
            padding: "4px 10px",
            fontSize: "11px",
            color: C.textSub,
            marginBottom: "14px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
          <span>Universal Gateway Integrations</span>
        </div>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: C.text,
            lineHeight: 1.2,
            marginBottom: "12px",
          }}
        >
          AI Applications &amp; Connectors
        </h1>
        <p style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.6, margin: 0 }}>
          Connect your favorite coding agent, character client, or IDE extension to CheapRouter with zero latency, native OpenAI compatibility, and wholesale model prices.
        </p>
      </div>

      {/* Coding Agents */}
      <section id="category-coding" style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: C.text, margin: 0 }}>Coding Agents &amp; IDEs</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {CODING_GUIDES.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </section>

      {/* Character clients */}
      <section id="category-roleplay" style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: C.text, margin: 0 }}>Character &amp; Fiction Clients</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {RP_GUIDES.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </section>

      {/* Chat & Desktop Clients */}
      <section id="category-chat" style={{ marginBottom: "48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: C.text, margin: 0 }}>Chat &amp; Desktop Clients</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {CHAT_GUIDES.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </section>
    </div>
  );
}
