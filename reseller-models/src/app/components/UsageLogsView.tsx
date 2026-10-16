"use client";

import { useState } from "react";

interface LogEntry {
  id: string;
  time: string;
  user: string;
  tokenName: string;
  model: string;
  client: string;
  stream: boolean;
  tokens: { prompt: number; completion: number; total: number };
  cost: string;
  timing: string;
  pricing: string;
}

interface UsageLogsViewProps {
  userEmail?: string;
  tokensUsed?: number;
}

export default function UsageLogsView({ userEmail, tokensUsed = 0 }: UsageLogsViewProps) {
  const [activeTab, setActiveTab] = useState<"common" | "drawing" | "task">("common");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [modelSearch, setModelSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [dateRange] = useState("Oct 16, 2026 00:00 - Oct 16, 2026 23:59");
  const [logs] = useState<LogEntry[]>([]); // Default empty matching screenshot

  const resetFilters = () => {
    setTypeFilter("All Types");
    setModelSearch("");
    setGroupSearch("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. Top Header Row (Screenshot) */}
      <div className="uno-keys-header-row">
        <div className="uno-keys-title-group">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "#10b981",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block",
              }}
            />
            USAGE LOGS
          </div>
          <h1>Usage Logs</h1>
          <p>View your API request history, token usage, and spending details.</p>
        </div>
      </div>

      {/* 2. Sub-Tabs: Common Logs | Drawing Logs | Task Logs */}
      <div className="uno-logs-tabs">
        <button
          type="button"
          className={`uno-logs-tab ${activeTab === "common" ? "active" : ""}`}
          onClick={() => setActiveTab("common")}
        >
          Common Logs
        </button>
        <button
          type="button"
          className={`uno-logs-tab ${activeTab === "drawing" ? "active" : ""}`}
          onClick={() => setActiveTab("drawing")}
        >
          Drawing Logs
        </button>
        <button
          type="button"
          className={`uno-logs-tab ${activeTab === "task" ? "active" : ""}`}
          onClick={() => setActiveTab("task")}
        >
          Task Logs
        </button>
      </div>

      {/* 3. Summary Stats Strip (Screenshot: | Usage $0.0000 | RPM 0 | TPM 0) */}
      <div className="uno-logs-summary-strip">
        <div className="uno-logs-summary-item">
          <span className="uno-logs-summary-bar" />
          <span className="uno-logs-summary-label">Usage</span>
          <span className="uno-logs-summary-val">
            ${((tokensUsed / 1_000_000) * 0.15).toFixed(4)}
          </span>
        </div>

        <div className="uno-logs-summary-item">
          <span className="uno-logs-summary-bar" />
          <span className="uno-logs-summary-label">RPM</span>
          <span className="uno-logs-summary-val">0</span>
        </div>

        <div className="uno-logs-summary-item">
          <span className="uno-logs-summary-bar" />
          <span className="uno-logs-summary-label">TPM</span>
          <span className="uno-logs-summary-val">0</span>
        </div>
      </div>

      {/* 4. Filter Toolbar */}
      <div className="uno-logs-filter-bar">
        {/* Date Range Badge */}
        <div className="uno-logs-date-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{dateRange}</span>
        </div>

        {/* Type Dropdown */}
        <div className="uno-logs-select-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="uno-logs-select"
          >
            <option value="All Types">All Types</option>
            <option value="Chat Completions">Chat Completions</option>
            <option value="Embeddings">Embeddings</option>
            <option value="Images">Images</option>
          </select>
          <svg className="uno-logs-select-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Reset Filter Button */}
        <button
          type="button"
          className="uno-logs-btn-icon-text"
          onClick={resetFilters}
          title="Reset filters"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 2v6h6M21.5 22v-6h-6" />
            <path d="M22 11.5A10 10 0 0 0 3.2 7.2L2.5 8M2 12.5a10 10 0 0 0 18.8 4.2l.7-0.7" />
          </svg>
          <span>Reset</span>
        </button>

        {/* Search Model Name */}
        <div className="uno-logs-input-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Model name ..."
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
          />
        </div>

        {/* Search Group */}
        <div className="uno-logs-input-wrap" style={{ maxWidth: 140 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Group"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
          />
        </div>

        {/* Filters Toggle Button */}
        <button type="button" className="uno-logs-btn-icon-text">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filters</span>
        </button>

        {/* Visibility Icon Button */}
        <button type="button" className="uno-logs-icon-btn" title="Toggle visibility">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </button>

        {/* View Controls Button */}
        <div style={{ marginLeft: "auto" }}>
          <button type="button" className="uno-btn-view-toggle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>View</span>
          </button>
        </div>
      </div>

      {/* 5. Logs Table (Exact Screenshot Columns) */}
      <div className="uno-logs-table-wrap">
        <table className="uno-logs-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>USER</th>
              <th>TOKEN</th>
              <th>MODEL</th>
              <th>CLIENT</th>
              <th>STREAM</th>
              <th>TOKENS</th>
              <th>COST</th>
              <th>TIMING</th>
              <th>PRICING</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{log.time}</td>
                  <td style={{ color: "var(--uno-text-secondary)" }}>{log.user}</td>
                  <td>{log.tokenName}</td>
                  <td style={{ fontWeight: 600, color: "#ffffff" }}>{log.model}</td>
                  <td style={{ color: "var(--uno-text-muted)" }}>{log.client}</td>
                  <td>
                    {log.stream ? (
                      <span style={{ color: "#10b981" }}>true</span>
                    ) : (
                      <span style={{ color: "var(--uno-text-muted)" }}>false</span>
                    )}
                  </td>
                  <td className="mono">{log.tokens.total.toLocaleString()}</td>
                  <td className="mono" style={{ color: "#eab308" }}>{log.cost}</td>
                  <td className="mono">{log.timing}</td>
                  <td style={{ color: "var(--uno-text-muted)", fontSize: 11 }}>{log.pricing}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="uno-logs-empty-cell">
                  <div className="uno-logs-empty-state">
                    <svg
                      width="42"
                      height="42"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth="1.5"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <p>No logs found for the selected period.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
