"use client";

import React, { useRef } from "react";
import { GuideIcon } from "./GuideIcon";
import { useTheme } from "@/components/theme-provider";

export interface NavItem {
  id: string;
  title: string;
  iconKey: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface DocsSidebarProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
  mobileOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const DOCS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform & Core API",
    items: [
      { id: "overview", title: "Overview", iconKey: "overview" },
      { id: "models", title: "All Models", iconKey: "models" },
      { id: "custom-api", title: "Custom API / SDK", iconKey: "custom-api" },
    ],
  },
  {
    label: "Documentation",
    items: [
      { id: "ai-apps", title: "AI Applications", iconKey: "ai-apps" },
    ],
  },
  {
    label: "Coding agents",
    items: [
      { id: "opencode", title: "OpenCode Setup Guide", iconKey: "opencode" },
      { id: "kilo-code", title: "Kilo Code Setup Guide", iconKey: "kilo-code" },
      { id: "zed", title: "Zed IDE Setup Guide", iconKey: "zed" },
      { id: "cline", title: "Cline Setup Guide", iconKey: "cline" },
      { id: "roo-code", title: "Roo Code Setup Guide", iconKey: "roo-code" },
      { id: "continue-dev", title: "Continue.dev Setup Guide", iconKey: "continue-dev" },
      { id: "claude-code", title: "Claude Code Setup Guide", iconKey: "claude-code" },
      { id: "codex", title: "Codex CLI Setup Guide", iconKey: "codex" },
      { id: "cursor", title: "Cursor IDE Setup Guide", iconKey: "cursor" },
      { id: "aider", title: "Aider Setup Guide", iconKey: "aider" },
      { id: "cc-switch", title: "CC Switch Tool", iconKey: "cc-switch" },
      { id: "harness", title: "Agent Test Harness", iconKey: "harness" },
    ],
  },
  {
    label: "Character & fiction clients",
    items: [
      { id: "sillytavern", title: "SillyTavern Integration Guide", iconKey: "sillytavern" },
      { id: "janitor-ai", title: "Janitor.AI Integration Guide", iconKey: "janitor-ai" },
      { id: "risuai", title: "RisuAI Integration Guide", iconKey: "risuai" },
      { id: "chub", title: "Chub / Venus Integration Guide", iconKey: "chub" },
      { id: "nevika", title: "Nevika Integration Guide", iconKey: "nevika" },
    ],
  },
  {
    label: "Chat & desktop clients",
    items: [
      { id: "open-webui", title: "Open WebUI Setup Guide", iconKey: "open-webui" },
      { id: "librechat", title: "LibreChat Integration Guide", iconKey: "librechat" },
      { id: "chatbox", title: "Chatbox Setup Guide", iconKey: "chatbox" },
      { id: "typingmind", title: "TypingMind Integration Guide", iconKey: "typingmind" },
      { id: "anythingllm", title: "AnythingLLM Setup Guide", iconKey: "anythingllm" },
    ],
  },
];

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";

export function DocsSidebar({
  activeSection,
  onSelectSection,
  mobileOpen = false,
  searchQuery,
  onSearchChange,
}: DocsSidebarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderNavList = () => (
    <>
      {/* Persistent Nav scroll area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "18px 10px 24px 10px",
          scrollbarWidth: "thin",
          scrollbarColor: isDark ? "rgba(255,255,255,0.08) transparent" : "rgba(0,0,0,0.08) transparent",
        }}
        className="docs-sidebar-scroll"
      >
        {DOCS_NAV_GROUPS.map((group, groupIdx) => (
          <div
            key={group.label}
            style={{
              marginTop: groupIdx === 0 ? "0px" : "22px",
              marginBottom: "4px",
            }}
          >
            {/* Group label - Serif, Sentence Case, Muted Warm Gray */}
            <div
              style={{
                padding: "4px 12px 6px 12px",
                fontSize: "13.5px",
                fontWeight: 400,
                fontFamily: SERIF_FONT,
                letterSpacing: "0.01em",
                color: isDark ? "#8e8a84" : "#64748b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "none",
              }}
            >
              {group.label}
            </div>

            {/* Nav items */}
            {group.items.map((item) => {
              const isActive =
                activeSection === item.id ||
                (item.id === "custom-api" &&
                  ["custom-api", "apis", "chat-completions"].includes(activeSection));

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id)}
                  className={`docs-nav-serif-item ${isActive ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "7px 12px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: 400,
                    fontFamily: SERIF_FONT,
                    color: isActive ? (isDark ? "#ffffff" : "#0f172a") : (isDark ? "#e5e7eb" : "#475569"),
                    textAlign: "left",
                    cursor: "pointer",
                    border: "none",
                    background: isActive ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
                    lineHeight: "1.4",
                    marginBottom: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {/* Icon */}
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <GuideIcon iconKey={item.iconKey} size={16} />
                  </span>

                  {/* Title */}
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {item.id === "ai-apps" ? (
                      <span className="docs-nav-shimmer-red">
                        {item.title}
                      </span>
                    ) : item.id === "custom-api" ? (
                      <span>
                        <span className="docs-nav-shimmer-text">Custom API</span>
                        <span style={{ opacity: 0.5, margin: "0 3px" }}>/</span>
                        <span className="docs-nav-sdk-red">SDK</span>
                      </span>
                    ) : (
                      item.title
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Static Footer Tab: Test Playground (Pinned at bottom) */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
          backgroundColor: isDark ? "#050505" : "#ffffff",
          marginTop: "auto",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectSection("playground")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "9px 12px",
            borderRadius: "6px",
            fontSize: "13.5px",
            fontFamily: SERIF_FONT,
            fontWeight: activeSection === "playground" ? 600 : 500,
            color: activeSection === "playground" ? "#ffffff" : isDark ? "#f3f4f6" : "#0f172a",
            backgroundColor:
              activeSection === "playground"
                ? "#ef4444"
                : isDark
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(239, 68, 68, 0.05)",
            border:
              activeSection === "playground"
                ? "1px solid #ef4444"
                : isDark
                ? "1px solid rgba(239, 68, 68, 0.28)"
                : "1px solid rgba(239, 68, 68, 0.22)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            boxShadow:
              activeSection === "playground"
                ? "0 2px 12px rgba(239, 68, 68, 0.4)"
                : "none",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            if (activeSection !== "playground") {
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(239, 68, 68, 0.14)"
                : "rgba(239, 68, 68, 0.12)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.45)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSection !== "playground") {
              e.currentTarget.style.backgroundColor = isDark
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(239, 68, 68, 0.05)";
              e.currentTarget.style.borderColor = isDark
                ? "1px solid rgba(239, 68, 68, 0.28)"
                : "1px solid rgba(239, 68, 68, 0.22)";
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: activeSection === "playground" ? "#ffffff" : "#ef4444",
                boxShadow:
                  activeSection === "playground"
                    ? "0 0 8px #ffffff"
                    : "0 0 8px rgba(239, 68, 68, 0.8)",
                flexShrink: 0,
              }}
            />
            <span>Test Playground</span>
          </div>

          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "2px 6px",
              borderRadius: "4px",
              backgroundColor:
                activeSection === "playground"
                  ? "rgba(255, 255, 255, 0.2)"
                  : "rgba(239, 68, 68, 0.15)",
              color: activeSection === "playground" ? "#ffffff" : "#ef4444",
              border:
                activeSection === "playground"
                  ? "1px solid rgba(255, 255, 255, 0.3)"
                  : "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            LIVE
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{
          position: "sticky",
          top: "54px",
          height: "calc(100vh - 54px)",
          width: "250px",
          minWidth: "250px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: isDark ? "#050505" : "#ffffff",
          borderRight: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
          overflow: "hidden",
          zIndex: 30,
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
        className="hidden md:flex md:flex-col"
      >
        {renderNavList()}
      </aside>

      {/* Mobile sidebar */}
      <aside
        style={{
          position: "fixed",
          top: "54px",
          left: 0,
          bottom: 0,
          width: "250px",
          display: mobileOpen ? "flex" : "none",
          flexDirection: "column",
          backgroundColor: isDark ? "#050505" : "#ffffff",
          borderRight: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
          overflow: "hidden",
          zIndex: 50,
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
        className="md:hidden"
      >
        {renderNavList()}
      </aside>
    </>
  );
}
