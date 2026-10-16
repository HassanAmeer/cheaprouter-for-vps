"use client";

import React, { useState } from "react";
import { GuideIcon } from "./GuideIcon";
import { useTheme } from "@/components/theme-provider";

/* ---- Types ---- */
export interface SetupStepItem {
  stepNumber: number;
  title: string;
  description: string;
  osCode?: {
    windows: { lang: string; code: string };
    macos: { lang: string; code: string };
    linux: { lang: string; code: string };
  };
  codeSnippet?: { lang: string; code: string };
  note?: string;
}

export type CompatibilityType =
  | string
  | { name: string; supported?: boolean; note?: string };

export interface GuideTemplateProps {
  slug?: string;
  title: string;
  subtitle: string;
  iconKey?: string;
  categoryName?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  quickConfigNotice?: string;
  osCommands?: any;
  baseUrl?: string;
  apiPath?: string;
  compatibility?: CompatibilityType[];
  steps?: SetupStepItem[];
  quickConfigCode?: string;
  recommendedModels?: (string | { id: string; provider: string; price: string })[];
  gotchas?: string[];
  extraContent?: React.ReactNode;
}

/* ---- Shared colour tokens ---- */
const DARK_C = {
  bg: "#050505",
  bg2: "#0a0a0a",
  bg3: "#0d0d0d",
  bg4: "#080808",
  border: "rgba(255,255,255,0.08)",
  border2: "rgba(255,255,255,0.05)",
  text: "#f9fafb",
  textSub: "#9ca3af",
  textMuted: "#6b7280",
  textCode: "#d1d5db",
  badgeColor: "#d1d5db",
  bubbleBg: "#1c1c1e",
  bubbleText: "#e5e7eb",
  codeDotBg: "rgba(255,255,255,0.12)",
  mono: "'Menlo','Fira Code','Cascadia Code',monospace",
  serif: "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif",
};

const LIGHT_C = {
  bg: "#f8fafc",
  bg2: "#ffffff",
  bg3: "#f1f5f9",
  bg4: "#f8fafc",
  border: "rgba(0,0,0,0.08)",
  border2: "rgba(0,0,0,0.05)",
  text: "#0f172a",
  textSub: "#475569",
  textMuted: "#64748b",
  textCode: "#1e293b",
  badgeColor: "#334155",
  bubbleBg: "#e2e8f0",
  bubbleText: "#0f172a",
  codeDotBg: "rgba(0,0,0,0.15)",
  mono: "'Menlo','Fira Code','Cascadia Code',monospace",
  serif: "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif",
};

/* ---- Copy button with state ---- */
function CopyBtn({ text }: { text: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Copy code"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        borderRadius: "4px",
        cursor: "pointer",
        background: hovered ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") : "none",
        border: "none",
        color: copied ? "#10b981" : hovered ? (isDark ? "#d1d5db" : "#334155") : (isDark ? "#6b7280" : "#94a3b8"),
        transition: "color 0.1s, background 0.1s",
        fontFamily: "inherit",
      }}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}

/* ---- OS Tab icons ---- */
const WinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4h-13.051M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.799" />
  </svg>
);
const MacIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8.92-2.85-.9.04-2 .6-2.65 1.36-.56.65-1.06 1.71-.92 2.72.99.08 2.02-.48 2.65-1.23z" />
  </svg>
);
const LinuxIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.001 2c-3.1 0-5.6 2.5-5.6 5.6 0 .5.1.9.2 1.4-1.8.8-3.1 2.6-3.1 4.7 0 2.9 2.4 5.3 5.3 5.3h6.4c2.9 0 5.3-2.4 5.3-5.3 0-2.1-1.3-3.9-3.1-4.7.1-.5.2-.9.2-1.4 0-3.1-2.5-5.6-5.6-5.6z" />
  </svg>
);

/* ─── Main Component ─── */
export default function GuideTemplate({
  slug = "guide",
  title,
  subtitle,
  iconKey = "opencode",
  categoryName = "Coding agents",
  badge,
  badgeColor,
  icon,
  quickConfigNotice,
  osCommands,
  baseUrl = "http://localhost:3000",
  compatibility = ["Chat Completions", "Streaming", "Tool calling"],
  steps = [],
  quickConfigCode,
  recommendedModels,
  gotchas = [
    "Ensure your API key starts with cr-live- or sk- when copying into configurations.",
    "For agents using custom tool calling, ensure stream mode is preserved for real-time progress.",
    "If your client errors on unrecognized model prefixes, CheapRouter normalizes vendor namespaces automatically.",
  ],
  extraContent,
}: GuideTemplateProps) {
  const [activeOs, setActiveOs] = useState<"windows" | "macos" | "linux">("windows");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const C = isDark ? DARK_C : LIGHT_C;

  const defaultConfig = `Base URL: ${baseUrl}/v1\nAPI Key: cr-live-your-cheaprouter-api-key`;

  const osTabs = [
    { key: "windows" as const, label: "Windows", Icon: WinIcon },
    { key: "macos" as const, label: "macOS", Icon: MacIcon },
    { key: "linux" as const, label: "Linux", Icon: LinuxIcon },
  ];

  return (
    <div
      style={{
        maxWidth: "720px",
        paddingBottom: "96px",
        color: C.text,
        fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div id="overview" style={{ marginBottom: "32px", paddingTop: "2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          {/* Icon box */}
          <div
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              border: `1px solid ${C.border}`,
              backgroundColor: C.bg2,
              flexShrink: 0,
            }}
          >
            {icon ? icon : <GuideIcon iconKey={iconKey} size={22} />}
          </div>
          <div>
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: badgeColor || C.textMuted,
                marginBottom: "2px",
              }}
            >
              {badge || categoryName}
            </div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 600,
                fontFamily: C.serif,
                letterSpacing: "-0.01em",
                color: C.text,
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {title}
            </h1>
          </div>
        </div>
        <p style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.6, margin: 0 }}>{subtitle}</p>
      </div>

      {/* ── Quick Config ── */}
      <section id="quick-config" style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, fontFamily: C.serif, color: C.text, marginBottom: "12px" }}>
          Quick Config
        </h2>
        <div
          style={{
            backgroundColor: C.bg2,
            border: `1px solid ${C.border}`,
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border2}`,
            }}
          >
            <span style={{ fontSize: "11px", color: C.textMuted }}>CheapRouter Gateway Endpoint</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: C.textMuted }}>Copy config</span>
              <CopyBtn text={quickConfigCode || defaultConfig} />
            </div>
          </div>
          <div style={{ padding: "14px" }}>
            <pre
              style={{
                fontFamily: C.mono,
                fontSize: "12px",
                color: C.textCode,
                lineHeight: 1.7,
                whiteSpace: "pre",
                overflowX: "auto",
                margin: 0,
              }}
            >
              {quickConfigCode || defaultConfig}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Compatibility ── */}
      {compatibility && compatibility.length > 0 && (
        <section id="compatibility" style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, fontFamily: C.serif, color: C.text, marginBottom: "14px" }}>
            Compatibility
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {compatibility.map((cap, i) => {
              const label = typeof cap === "string" ? cap : cap.name;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: `1px solid ${C.border}`,
                    backgroundColor: C.bg2,
                    fontSize: "11.5px",
                    fontWeight: 500,
                    color: C.badgeColor,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Step-by-step ── */}
      <section id="steps" style={{ marginBottom: "48px" }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 600,
            fontFamily: C.serif,
            letterSpacing: "-0.01em",
            color: C.text,
            marginBottom: "28px",
          }}
        >
          Step-by-step setup
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {steps.map((step, idx) => {
            const hasOs = !!step.osCode;
            const currentCode = hasOs ? step.osCode![activeOs].code : step.codeSnippet?.code;
            const currentLang = hasOs
              ? step.osCode![activeOs].lang.toUpperCase()
              : (step.codeSnippet?.lang || "CODE").toUpperCase();

            return (
              <div
                key={step.stepNumber}
                id={`step-${idx + 1}`}
                style={{ display: "flex", gap: "14px", scrollMarginTop: "80px" }}
              >
                {/* Number bubble */}
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    backgroundColor: C.bubbleBg,
                    fontFamily: C.mono,
                    fontSize: "11px",
                    fontWeight: 600,
                    color: C.bubbleText,
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  {step.stepNumber}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: C.text,
                      marginBottom: "4px",
                    }}
                  >
                    {step.title}
                  </div>
                  <p style={{ fontSize: "13px", color: C.textSub, lineHeight: 1.6, margin: 0 }}>
                    {step.description}
                  </p>

                  {/* OS Tabs */}
                  {hasOs && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        borderBottom: `1px solid ${C.border}`,
                        marginTop: "14px",
                      }}
                    >
                      {osTabs.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          onClick={() => setActiveOs(key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "5px 5px 0 0",
                            fontSize: "11.5px",
                            fontWeight: 500,
                            color: activeOs === key ? C.text : C.textMuted,
                            cursor: "pointer",
                            background: activeOs === key ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)") : "none",
                            border: "none",
                            fontFamily: "inherit",
                            transition: "color 0.1s, background 0.1s",
                          }}
                        >
                          <Icon />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Code block */}
                  {currentCode && (
                    <div
                      style={{
                        borderRadius: hasOs ? "0 0 10px 10px" : "10px",
                        border: `1px solid ${C.border}`,
                        borderTop: hasOs ? "none" : `1px solid ${C.border}`,
                        backgroundColor: C.bg4,
                        overflow: "hidden",
                        marginTop: hasOs ? 0 : "14px",
                      }}
                    >
                      {/* Code header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          backgroundColor: C.bg3,
                          borderBottom: `1px solid ${C.border2}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          {[C.codeDotBg, C.codeDotBg, C.codeDotBg].map(
                            (bg, i) => (
                              <span
                                key={i}
                                style={{
                                  display: "inline-block",
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "50%",
                                  backgroundColor: bg,
                                }}
                              />
                            )
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontFamily: C.mono,
                              fontSize: "10px",
                              fontWeight: 600,
                              letterSpacing: "0.08em",
                              color: C.textMuted,
                              textTransform: "uppercase",
                            }}
                          >
                            {currentLang}
                          </span>
                          <CopyBtn text={currentCode} />
                        </div>
                      </div>

                      {/* Code content */}
                      <div style={{ padding: "14px 16px", overflowX: "auto" }}>
                        <pre
                          style={{
                            fontFamily: C.mono,
                            fontSize: "12px",
                            color: C.textCode,
                            lineHeight: 1.7,
                            whiteSpace: "pre",
                            margin: 0,
                          }}
                        >
                          {currentCode}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* API key link */}
                  <a
                    href="/api-keys"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      marginTop: "8px",
                      fontSize: "11.5px",
                      color: C.textMuted,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="7.5" cy="15.5" r="5.5" />
                      <path d="M21 2 10.585 12.415" />
                      <path d="M15 3 21 9" />
                      <path d="M21 9 15 3" />
                    </svg>
                    Sign in to auto-fill your API key
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>



      {/* ── Gotchas ── */}
      {gotchas && gotchas.length > 0 && (
        <section id="gotchas" style={{ marginBottom: "48px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, fontFamily: C.serif, color: C.text, marginBottom: "14px" }}>
            Gotchas &amp; Troubleshooting
          </h2>
          <div
            style={{
              backgroundColor: C.bg2,
              border: `1px solid ${C.border}`,
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {gotchas.map((gotcha, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <svg
                  style={{ width: "14px", height: "14px", color: "#f59e0b", flexShrink: 0, marginTop: "1px" }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: "12.5px", color: C.textSub, lineHeight: 1.6 }}>{gotcha}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {extraContent}
    </div>
  );
}
