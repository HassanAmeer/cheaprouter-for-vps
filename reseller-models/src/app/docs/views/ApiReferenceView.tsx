"use client";

import React, { useState, useEffect } from "react";
import ChatCompletionsView from "./ChatCompletionsView";
import ModelsView from "./ModelsView";
import CustomApiView from "./CustomApiView";
import PlaygroundView from "./PlaygroundView";
import { MessageSquare, Layers, Code2, Terminal, Sparkles, Zap } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export type ApiTabType = "chat-completions" | "models" | "custom-api" | "playground";

interface ApiReferenceViewProps {
  baseUrl?: string;
  activeTab?: ApiTabType;
  onTabChange?: (tab: ApiTabType) => void;
}

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";

export default function ApiReferenceView({
  baseUrl = "http://localhost:3000",
  activeTab = "models",
  onTabChange,
}: ApiReferenceViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [currentTab, setCurrentTab] = useState<ApiTabType>(activeTab);

  useEffect(() => {
    if (activeTab && activeTab !== currentTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  const handleSwitchTab = (tab: ApiTabType) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const API_TABS: { id: ApiTabType; label: string; badge: string; badgeColor: string; icon: any }[] = [
    {
      id: "models",
      label: "All Models",
      badge: "GET",
      badgeColor: "rgba(16, 185, 129, 0.15)",
      icon: Layers,
    },
    {
      id: "custom-api",
      label: "Custom API / SDK",
      badge: "SDK",
      badgeColor: "rgba(99, 102, 241, 0.15)",
      icon: Code2,
    },
    {
      id: "playground",
      label: "Test Playground",
      badge: "LIVE",
      badgeColor: "rgba(234, 179, 8, 0.15)",
      icon: Terminal,
    },
  ];

  return (
    <div
      style={{
        maxWidth: "1020px",
        margin: "0 auto",
        paddingBottom: "80px",
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* ── Top Tabs Navigation Bar ── */}
      <div
        style={{
          borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
          paddingBottom: "0px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {API_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSwitchTab(tab.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                fontSize: "13.5px",
                fontFamily: SERIF_FONT,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? (isDark ? "#ffffff" : "#0f172a") : (isDark ? "#9ca3af" : "#64748b"),
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid #ef4444" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                marginBottom: "-1px",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = isDark ? "#ffffff" : "#0f172a";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = isDark ? "#9ca3af" : "#64748b";
              }}
            >
              <Icon
                size={15}
                color={isActive ? "#ef4444" : "currentColor"}
                style={{ flexShrink: 0 }}
              />
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  backgroundColor: tab.badgeColor,
                  color:
                    tab.badge === "POST"
                      ? "#ef4444"
                      : tab.badge === "GET"
                      ? "#10b981"
                      : tab.badge === "LIVE"
                      ? "#facc15"
                      : "#818cf8",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active Tab Content Area ── */}
      <div>
        {currentTab === "chat-completions" && <ChatCompletionsView baseUrl={baseUrl} />}
        {currentTab === "models" && <ModelsView baseUrl={baseUrl} />}
        {currentTab === "custom-api" && <CustomApiView baseUrl={baseUrl} />}
        {currentTab === "playground" && <PlaygroundView baseUrl={baseUrl} />}
      </div>
    </div>
  );
}
