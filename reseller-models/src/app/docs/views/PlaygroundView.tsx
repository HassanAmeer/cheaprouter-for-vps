"use client";

import React from "react";
import ApiPlayground from "../components/ApiPlayground";
import { Terminal } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";

export default function PlaygroundView({ baseUrl = "http://localhost:3000" }: { baseUrl?: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        width: "100%",
        maxWidth: "100%",
        paddingBottom: "80px",
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
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
            <Terminal size={12} />
            <span>Test Sandbox</span>
          </span>
          <span style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "13px", fontFamily: SERIF_FONT }}>
            • Live Request Testing
          </span>
        </div>

        <h1
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "38px",
            fontWeight: 500,
            lineHeight: "1.15",
            letterSpacing: "-0.015em",
            color: isDark ? "#ffffff" : "#0f172a",
            margin: "0 0 14px 0",
          }}
        >
          Test Playground
        </h1>

        <p
          style={{
            fontFamily: SERIF_FONT,
            fontSize: "16px",
            lineHeight: "1.65",
            color: isDark ? "#9ca3af" : "#475569",
            margin: 0,
            maxWidth: "840px",
          }}
        >
          Test any endpoint and model in real-time right in your browser. Choose an endpoint from the dropdown, pick an AI model to automatically sync the JSON payload, enter your API key, and execute live queries to inspect response status and latency.
        </p>
      </div>

      {/* Main Test Playground */}
      <div style={{ marginTop: "8px" }}>
        <ApiPlayground baseUrl={baseUrl} />
      </div>
    </div>
  );
}
