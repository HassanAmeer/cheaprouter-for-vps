"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Zap,
  Terminal,
  Layers,
  ArrowRight,
  Shield,
  Cpu,
  Code2,
  Wrench,
  Bot,
  MessageSquare,
  Globe,
  FileCode,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface IntroductionViewProps {
  baseUrl?: string;
  onSelectView?: (view: string) => void;
}

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";

export default function IntroductionView({
  baseUrl = "http://localhost:3000",
  onSelectView,
}: IntroductionViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [copiedModels, setCopiedModels] = useState(false);
  const [copiedCompletions, setCopiedCompletions] = useState(false);

  const copyText = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const cleanBase = baseUrl.replace(/\/$/, "");
  const openAiUrl = `${cleanBase}/v1`;

  const BENTO_CONNECTORS = [
    {
      id: "claude-code",
      title: "Claude Code",
      category: "Coding Agent",
      desc: "Anthropic's terminal CLI agent with full bash tool execution and multi-turn refactoring.",
      icon: Terminal,
      color: "red",
      badgeClass: isDark
        ? "bg-red-950/40 border-red-500/30 text-red-400"
        : "bg-red-100 border-red-200 text-red-700",
      iconClass: isDark
        ? "bg-red-950/30 border-red-500/20 text-red-400"
        : "bg-red-50 border-red-200 text-red-600",
    },
    {
      id: "opencode",
      title: "Codex CLI & OpenCode",
      category: "CLI Agent",
      desc: "High-speed terminal coding agents with auto-apply diffs and bash tool execution.",
      icon: Code2,
      color: "blue",
      badgeClass: isDark
        ? "bg-blue-950/40 border-blue-500/30 text-blue-400"
        : "bg-blue-100 border-blue-200 text-blue-700",
      iconClass: isDark
        ? "bg-blue-950/30 border-blue-500/20 text-blue-400"
        : "bg-blue-50 border-blue-200 text-blue-600",
    },
    {
      id: "cline",
      title: "Cline & Cursor IDE",
      category: "In-Editor Agent",
      desc: "Autonomous coding assistant for VS Code and native AI-first code editors.",
      icon: Layers,
      color: "purple",
      badgeClass: isDark
        ? "bg-purple-950/40 border-purple-500/30 text-purple-400"
        : "bg-purple-100 border-purple-200 text-purple-700",
      iconClass: isDark
        ? "bg-purple-950/30 border-purple-500/20 text-purple-400"
        : "bg-purple-50 border-purple-200 text-purple-600",
    },
    {
      id: "zed",
      title: "Zed IDE & Continue",
      category: "High-Perf IDE",
      desc: "Ultra-fast Rust-based editor assistant and open-source copilot integration.",
      icon: Zap,
      color: "emerald",
      badgeClass: isDark
        ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
        : "bg-emerald-100 border-emerald-200 text-emerald-700",
      iconClass: isDark
        ? "bg-emerald-950/30 border-emerald-500/20 text-emerald-400"
        : "bg-emerald-50 border-emerald-200 text-emerald-600",
    },
    {
      id: "roo-code",
      title: "Roo Code & Aider",
      category: "Terminal & Modes",
      desc: "Multi-mode VS Code agent with custom prompts and git-integrated pair programming.",
      icon: Bot,
      color: "amber",
      badgeClass: isDark
        ? "bg-amber-950/40 border-amber-500/30 text-amber-400"
        : "bg-amber-100 border-amber-200 text-amber-700",
      iconClass: isDark
        ? "bg-amber-950/30 border-amber-500/20 text-amber-400"
        : "bg-amber-50 border-amber-200 text-amber-600",
    },
    {
      id: "sillytavern",
      title: "SillyTavern & Janitor.AI",
      category: "Chat & Roleplay",
      desc: "Rich character conversation, roleplay frontends, and custom reverse proxy setups.",
      icon: MessageSquare,
      color: "rose",
      badgeClass: isDark
        ? "bg-rose-950/40 border-rose-500/30 text-rose-400"
        : "bg-rose-100 border-rose-200 text-rose-700",
      iconClass: isDark
        ? "bg-rose-950/30 border-rose-500/20 text-rose-400"
        : "bg-rose-50 border-rose-200 text-rose-600",
    },
    {
      id: "open-webui",
      title: "Open WebUI & LibreChat",
      category: "Web Interfaces",
      desc: "Self-hosted enterprise AI interfaces with document RAG, artifact preview, and chat.",
      icon: Globe,
      color: "cyan",
      badgeClass: isDark
        ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-400"
        : "bg-cyan-100 border-cyan-200 text-cyan-700",
      iconClass: isDark
        ? "bg-cyan-950/30 border-cyan-500/20 text-cyan-400"
        : "bg-cyan-50 border-cyan-200 text-cyan-600",
    },
    {
      id: "cc-switch",
      title: "CC Switch & Test Harness",
      category: "Developer Tools",
      desc: "Instant proxy switcher for Claude Code and automated endpoint latency test suite.",
      icon: Wrench,
      color: "yellow",
      badgeClass: isDark
        ? "bg-yellow-950/40 border-yellow-500/30 text-yellow-400"
        : "bg-yellow-100 border-yellow-200 text-yellow-700",
      iconClass: isDark
        ? "bg-yellow-950/30 border-yellow-500/20 text-yellow-400"
        : "bg-yellow-50 border-yellow-200 text-yellow-600",
    },
    {
      id: "custom-api",
      title: "Python, Node.js & cURL",
      category: "Custom API / SDK",
      desc: "Drop-in compatibility with official OpenAI SDKs, LangChain, LlamaIndex, and cURL.",
      icon: FileCode,
      color: "indigo",
      badgeClass: isDark
        ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-400"
        : "bg-indigo-100 border-indigo-200 text-indigo-700",
      iconClass: isDark
        ? "bg-indigo-950/30 border-indigo-500/20 text-indigo-400"
        : "bg-indigo-50 border-indigo-200 text-indigo-600",
    },
  ];

  const cardBg = isDark ? "#0a0b0e" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const subBoxBg = isDark ? "#050608" : "#f8fafc";
  const subBoxBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#ffffff" : "#0f172a";
  const textMuted = isDark ? "#9ca3af" : "#64748b";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        paddingBottom: "80px",
      }}
    >
      {/* ── Top Header Section ── */}
      <div id="overview" style={{ marginBottom: "36px" }}>
        {/* Badge: Red pill + API v1 */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "4px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.28)",
              color: "#ef4444",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <Zap size={12} fill="#ef4444" color="#ef4444" />
            <span>UNIFIED GATEWAY</span>
          </span>
          <span
            style={{
              color: textMuted,
              fontSize: "13px",
              fontFamily: SERIF_FONT,
            }}
          >
            • API v1
          </span>
        </div>

        {/* Main Heading - Editorial Serif */}
        <h1
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "40px",
            fontWeight: 500,
            lineHeight: "1.15",
            letterSpacing: "-0.015em",
            color: textColor,
            margin: "0 0 16px 0",
          }}
        >
          One API Key, All AI Models
        </h1>

        {/* Subtitle Description */}
        <p
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "16px",
            lineHeight: "1.65",
            color: textMuted,
            margin: 0,
            maxWidth: "840px",
          }}
        >
          Welcome to CheapRouter. Connect your terminal coding agents (Claude Code, Codex, Cline), SDKs (Python, Node.js), and chat applications to 200+ state-of-the-art AI models with a single API key, high-speed streaming, and unbeatable wholesale pricing.
        </p>
      </div>

      {/* ── Universal Gateway Endpoints Card ── */}
      <section
        id="quick-config"
        style={{
          marginBottom: "48px",
          backgroundColor: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: "14px",
          padding: "22px 24px",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        {/* Card Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
            paddingBottom: "14px",
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={14} fill="#ef4444" color="#ef4444" />
            <span
              style={{
                fontFamily: SERIF_FONT,
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: textColor,
              }}
            >
              Universal Gateway Endpoints
            </span>
          </div>
          <span
            style={{
              fontFamily: SERIF_FONT,
              fontSize: "12.5px",
              color: textMuted,
            }}
          >
            100% OpenAI &amp; Anthropic Protocol Compatible
          </span>
        </div>

        {/* Endpoint Boxes Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "14px",
          }}
        >
          {/* Base URL Box */}
          <div
            style={{
              backgroundColor: subBoxBg,
              border: `1px solid ${subBoxBorder}`,
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: "11px",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    color: textMuted,
                    textTransform: "uppercase",
                  }}
                >
                  Base URL
                </span>
                <button
                  type="button"
                  onClick={() => copyText(openAiUrl, setCopiedBaseUrl)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "5px",
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    color: copiedBaseUrl ? "#10b981" : isDark ? "#d1d5db" : "#334155",
                    fontSize: "11.5px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {copiedBaseUrl ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedBaseUrl ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ef4444",
                  letterSpacing: "0.01em",
                  wordBreak: "break-all",
                }}
              >
                {openAiUrl}
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                fontSize: "11.5px",
                color: textMuted,
                fontFamily: SERIF_FONT,
              }}
            >
              Universal root endpoint for all SDKs, CLI agents &amp; integrations.
            </div>
          </div>

          {/* Direct Endpoints Box */}
          <div
            style={{
              backgroundColor: subBoxBg,
              border: `1px solid ${subBoxBorder}`,
              borderRadius: "10px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: textMuted,
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Endpoints
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Row 1: GET /v1/models */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    GET
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: isDark ? "#ffffff" : "#0f172a",
                      whiteSpace: "nowrap",
                    }}
                  >
                    /v1/models
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => copyText(`${cleanBase}/v1/models`, setCopiedModels)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    color: copiedModels ? "#10b981" : isDark ? "#d1d5db" : "#334155",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  {copiedModels ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedModels ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Row 2: POST /v1/chat/completions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      color: "#ef4444",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      flexShrink: 0,
                    }}
                  >
                    POST
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: isDark ? "#ffffff" : "#0f172a",
                      whiteSpace: "nowrap",
                    }}
                  >
                    /v1/chat/completions
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => copyText(`${cleanBase}/v1/chat/completions`, setCopiedCompletions)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    color: copiedCompletions ? "#10b981" : isDark ? "#d1d5db" : "#334155",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                >
                  {copiedCompletions ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedCompletions ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Test in Playground Banner */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 6px #10b981",
              }}
            />
            <span style={{ fontSize: "12.5px", color: textMuted }}>
              Want to test live models or verify an API key right now?
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSelectView?.("playground")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.22)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.12)";
            }}
          >
            <Zap size={12} fill="#ef4444" />
            <span>Open Test API Playground →</span>
          </button>
        </div>
      </section>

      {/* ── Connectors & Integrations Section ── */}
      <section id="connectors" style={{ marginBottom: "52px" }}>
        <h2
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "28px",
            fontWeight: 500,
            color: textColor,
            margin: "0 0 6px 0",
          }}
        >
          Connectors &amp; Integrations
        </h2>
        <p
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "15px",
            color: textMuted,
            margin: "0 0 24px 0",
          }}
        >
          Choose your coding agent, SDK, or tool to view dedicated setup steps:
        </p>

        {/* 3-Column Bento Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: "16px",
          }}
        >
          {BENTO_CONNECTORS.map((c) => {
            const IconComponent = c.icon;
            return (
              <div
                key={c.id}
                onClick={() => onSelectView?.(c.id)}
                className="group"
                style={{
                  backgroundColor: cardBg,
                  border: `1px solid ${cardBorder}`,
                  borderRadius: "14px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                  e.currentTarget.style.backgroundColor = isDark ? "#0e1015" : "#f8fafc";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorder;
                  e.currentTarget.style.backgroundColor = cardBg;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div>
                  {/* Top row: Icon box + Category badge */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      className={c.iconClass}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconComponent size={18} />
                    </div>

                    <span
                      className={c.badgeClass}
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        borderWidth: "1px",
                        borderStyle: "solid",
                      }}
                    >
                      {c.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontFamily: SERIF_FONT,
                      fontSize: "18px",
                      fontWeight: 600,
                      color: textColor,
                      margin: "0 0 8px 0",
                    }}
                  >
                    {c.title}
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: "13px",
                      color: textMuted,
                      lineHeight: "1.55",
                      margin: 0,
                    }}
                  >
                    {c.desc}
                  </p>
                </div>

                {/* Bottom link row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "16px",
                    paddingTop: "12px",
                    borderTop: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.06)",
                    fontSize: "12px",
                    color: "#ef4444",
                    fontWeight: 500,
                  }}
                >
                  <span>Setup Guide</span>
                  <ArrowRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Universal Architecture Section ── */}
      <section id="architecture">
        <h2
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "26px",
            fontWeight: 500,
            color: textColor,
            margin: "0 0 20px 0",
          }}
        >
          Universal Architecture
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "14px",
              padding: "20px",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                marginBottom: "14px",
              }}
            >
              <Zap size={18} fill="#ef4444" color="#ef4444" />
            </div>
            <h3
              style={{
                fontFamily: SERIF_FONT,
                fontSize: "16px",
                fontWeight: 600,
                color: textColor,
                margin: "0 0 6px 0",
              }}
            >
              Sub-10ms Overhead
            </h3>
            <p
              style={{
                fontSize: "12.5px",
                color: textMuted,
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              Ultra-fast proxy runtime with HTTP/2 and HTTP/3 multiplexing for instant first-token delivery.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "14px",
              padding: "20px",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.12)",
                border: isDark ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid rgba(59, 130, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#60a5fa" : "#2563eb",
                marginBottom: "14px",
              }}
            >
              <Cpu size={18} />
            </div>
            <h3
              style={{
                fontFamily: SERIF_FONT,
                fontSize: "16px",
                fontWeight: 600,
                color: textColor,
                margin: "0 0 6px 0",
              }}
            >
              Automatic Failover
            </h3>
            <p
              style={{
                fontSize: "12.5px",
                color: textMuted,
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              Adaptive routing shifts traffic to backup regions if an upstream provider encounters rate limits or errors.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: "14px",
              padding: "20px",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.12)",
                border: isDark ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDark ? "#34d399" : "#059669",
                marginBottom: "14px",
              }}
            >
              <Shield size={18} />
            </div>
            <h3
              style={{
                fontFamily: SERIF_FONT,
                fontSize: "16px",
                fontWeight: 600,
                color: textColor,
                margin: "0 0 6px 0",
              }}
            >
              Zero Data Logging
            </h3>
            <p
              style={{
                fontSize: "12.5px",
                color: textMuted,
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              CheapRouter acts as a pure transit pipe. Prompts and completions are never retained or trained upon.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
