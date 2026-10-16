"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicCombo } from "@/lib/cheaproute";
import ApiKeysView from "../components/ApiKeysView";
import UsageLogsView from "../components/UsageLogsView";
import BillingView from "../components/BillingView";
import AffiliateView from "../components/AffiliateView";
import SettingsView from "../components/SettingsView";

interface Subscription {
  plan: {
    name: string;
    token_budget: number | null;
    rpm_limit: number | null;
    hasKey: boolean;
  };
  usage: { tokensUsed: number; tokenBudget: number | null; usedPct: number };
  expiresAt: string | null;
  expiryLabel: string;
}

interface ByokKey {
  id: number;
  provider_id: string;
  masked_key: string;
  is_paused: number;
  created_at: string;
}

interface Analytics {
  rpmLimit: number | null;
  tokensUsed: number;
  tokenBudget: number | null;
  daily: Array<{ day: string; tokens: number }>;
  live: boolean;
}

export default function DashboardClient({
  user,
  initialMenu = "dashboard",
}: {
  user: { id: number; email: string; name: string; role: string };
  initialMenu?: "dashboard" | "keys" | "logs" | "billing" | "affiliate" | "settings";
}) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [keys, setKeys] = useState<ByokKey[]>([]);
  const [combos, setCombos] = useState<PublicCombo[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation & tab states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"dashboard" | "keys" | "logs" | "billing" | "affiliate" | "settings">(initialMenu);
  const [activeSubTab, setActiveSubTab] = useState<"analytics" | "overview" | "flow">("analytics");

  // API Key & BYOK operations
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [newProvider, setNewProvider] = useState("");
  const [newKey, setNewKey] = useState("");
  const [byokMsg, setByokMsg] = useState<string | null>(null);
  const [byokBusy, setByokBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, k, a, c] = await Promise.all([
        fetch("/api/user/subscription").then((r) => r.json()),
        fetch("/api/user/byok").then((r) => r.json()),
        fetch("/api/user/analytics").then((r) => r.json()),
        fetch("/api/catalog").then((r) => r.json()).catch(() => null),
      ]);
      if (s.error) throw new Error(s.error);
      setSub(s);
      setKeys(k.keys ?? []);
      setCombos(c?.combos ?? []);
      setAnalytics(a.error ? null : a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function regenerate() {
    setKeyMsg(null);
    const res = await fetch("/api/user/regenerate-key", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setKeyMsg(data?.error ?? "Regeneration failed");
      return;
    }
    setApiKey(data.key);
    setKeyMsg("New key issued — copy it now. It will not be shown again.");
    void refresh();
  }

  function copyKey() {
    if (!apiKey) return;
    navigator.clipboard?.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function addByok(e: React.FormEvent) {
    e.preventDefault();
    setByokMsg(null);
    if (!newProvider.trim() || !newKey.trim()) {
      setByokMsg("Provider and key are required");
      return;
    }
    setByokBusy(true);
    try {
      const res = await fetch("/api/user/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: newProvider.trim(), key: newKey.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setByokMsg(data?.error ?? "Failed to add key");
        return;
      }
      setNewProvider("");
      setNewKey("");
      setByokMsg(`Key added for ${data.providerId} (${data.maskedKey})`);
      void refresh();
    } finally {
      setByokBusy(false);
    }
  }

  async function togglePause(id: number, paused: boolean) {
    await fetch("/api/user/byok", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paused }),
    });
    void refresh();
  }

  async function deleteKey(id: number) {
    if (!confirm("Delete this BYOK key?")) return;
    await fetch(`/api/user/byok?id=${id}`, { method: "DELETE" });
    void refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Good afternoon";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour >= 18) timeGreeting = "Good evening";
    const displayName = user.name || (user.email ? user.email.split("@")[0] : "Hasan ameer");
    return `${timeGreeting}, ${displayName}`;
  }, [user]);

  // Current Date Display (e.g. OCT 16, 2026)
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();
  }, []);

  const totalTokens = sub?.usage?.tokensUsed ?? 0;
  const statisticalCount = totalTokens > 0 ? Math.round(totalTokens / 850) : 0;
  const statisticalQuota = sub?.usage?.tokenBudget ? `$${((sub.usage.tokenBudget - totalTokens) / 1000000 * 0.5).toFixed(4)}` : "$0.0000";
  const averageRpm = sub?.plan?.rpm_limit ? sub.plan.rpm_limit.toFixed(2) : "0.00";
  const averageTpm = sub?.plan?.rpm_limit ? (sub.plan.rpm_limit * 1200).toLocaleString() : "0";

  return (
    <div className="uno-dash-wrapper">
      {/* ========================================================
          LEFT SIDEBAR (MATCHING SCREENSHOT 3)
         ======================================================== */}
      <aside className={`uno-dash-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand Logo */}
        <Link href="/" className="uno-dash-sidebar-brand">
          <div className="uno-logo-icon" style={{ width: 24, height: 24 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" fill="#0E1219" stroke="#E11D48" strokeWidth="2" />
              <path d="M11 11L7 16L11 21" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 11L11 16L15 21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 21L25 16L21 11" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 21L21 16L17 11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!sidebarCollapsed && <span>UNOROUTER</span>}
        </Link>

        {/* Section 1: Menu */}
        <div className="uno-dash-sidebar-section">
          {!sidebarCollapsed && <div className="uno-dash-section-label">Menu</div>}

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveMenu("dashboard")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "keys" ? "active" : ""}`}
            onClick={() => setActiveMenu("keys")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="M12 11l9-9" />
                <path d="M16 4l2 2" />
                <path d="M18 6l2 2" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>API Keys</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "logs" ? "active" : ""}`}
            onClick={() => setActiveMenu("logs")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Usage Logs</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "billing" ? "active" : ""}`}
            onClick={() => setActiveMenu("billing")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Billing</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "affiliate" ? "active" : ""}`}
            onClick={() => setActiveMenu("affiliate")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Affiliate</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeMenu === "settings" ? "active" : ""}`}
            onClick={() => setActiveMenu("settings")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
        </div>

        {/* Section 2: Navigate */}
        <div className="uno-dash-sidebar-section">
          {!sidebarCollapsed && <div className="uno-dash-section-label">Navigate</div>}

          <Link href="/models" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Models</span>}
          </Link>

          <Link href="/models" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Rankings</span>}
          </Link>

          <button
            type="button"
            className="uno-dash-nav-item"
            onClick={() => setActiveMenu("dashboard")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Inspector</span>}
          </button>

          <Link href="/pricing" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Pricing</span>}
          </Link>

          <Link href="/" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Chat</span>}
          </Link>

          <Link href="/" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Image</span>}
          </Link>

          <Link href="/" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Docs</span>}
          </Link>
        </div>

        {/* Sidebar Footer: Status Indicator */}
        <div className="uno-dash-sidebar-footer">
          <span className="uno-dot-pulse" />
          {!sidebarCollapsed && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--uno-text-secondary)" }}>
              Status
            </span>
          )}
        </div>
      </aside>

      {/* ========================================================
          MAIN DASHBOARD WORKSPACE
         ======================================================== */}
      <div className="uno-dash-main">
        {/* Top Navbar */}
        <header className="uno-dash-topbar">
          <div className="uno-dash-topbar-left">
            <button
              type="button"
              className="uno-dash-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title="Toggle sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <div className="uno-dash-breadcrumb">
              <span className="uno-dot-pulse" />
              <span>
                {activeMenu === "keys"
                  ? "API KEYS"
                  : activeMenu === "billing"
                  ? "BILLING"
                  : activeMenu === "logs"
                  ? "USAGE LOGS"
                  : activeMenu === "settings"
                  ? "SETTINGS"
                  : "DASHBOARD"}
              </span>
            </div>
          </div>

          <div className="uno-dash-topbar-right">
            {/* Live Date Badge */}
            <div className="uno-dash-date-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span>{formattedDate}</span>
            </div>

            {/* Notification Bell */}
            <button type="button" className="uno-icon-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>

            {/* Flag / Locale */}
            <div className="uno-icon-btn" title="US English" style={{ cursor: "default" }}>
              <span>🇺🇸</span>
            </div>

            {/* Moon Theme Toggle */}
            <button type="button" className="uno-icon-btn" title="Dark Theme">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>

            {/* User Profile Avatar */}
            <button
              type="button"
              className="uno-icon-btn"
              onClick={() => setActiveMenu("settings")}
              title={`Logged in as ${user.email}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="uno-dash-content">
          {activeMenu === "keys" && (
            <ApiKeysView userKey={apiKey} onRegenerateKey={regenerate} />
          )}

          {activeMenu === "logs" && (
            <UsageLogsView userEmail={user.email} tokensUsed={sub?.usage.tokensUsed ?? 0} />
          )}

          {activeMenu === "dashboard" && (
            <>
              {/* Main Greeting */}
              <h1 className="uno-dash-greeting">{greeting}</h1>

              {/* Sub-tabs: Model Analytics | Overview | Flow */}
              <div className="uno-dash-subtabs">
                <button
                  type="button"
                  className={`uno-dash-subtab ${activeSubTab === "analytics" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("analytics")}
                >
                  Model Analytics
                </button>
                <button
                  type="button"
                  className={`uno-dash-subtab ${activeSubTab === "overview" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`uno-dash-subtab ${activeSubTab === "flow" ? "active" : ""}`}
                  onClick={() => setActiveSubTab("flow")}
                >
                  Flow
                </button>
              </div>

          {/* 5 KPI Metric Cards (Screenshot 3) */}
          <div className="uno-dash-kpi-grid">
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>#</span>
                <span>STATISTICAL COUNT</span>
              </div>
              <div className="uno-kpi-val">{statisticalCount}</div>
              <div className="uno-kpi-sub">Statistical count</div>
            </div>

            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>$</span>
                <span>STATISTICAL QUOTA</span>
              </div>
              <div className="uno-kpi-val">{statisticalQuota}</div>
              <div className="uno-kpi-sub">Statistical quota</div>
            </div>

            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⁝⁝</span>
                <span>STATISTICAL TOKENS</span>
              </div>
              <div className="uno-kpi-val">{totalTokens.toLocaleString()}</div>
              <div className="uno-kpi-sub">Statistical tokens</div>
            </div>

            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⏱</span>
                <span>AVERAGE RPM</span>
              </div>
              <div className="uno-kpi-val">{averageRpm}</div>
              <div className="uno-kpi-sub">Requests per minute</div>
            </div>

            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⚡</span>
                <span>AVERAGE TPM</span>
              </div>
              <div className="uno-kpi-val">{averageTpm}</div>
              <div className="uno-kpi-sub">Tokens per minute</div>
            </div>
          </div>

          {/* Performance Strip (Screenshot 3) */}
          <div className="uno-perf-strip">
            <div className="uno-perf-top">
              <div className="uno-perf-label">
                <span>💚</span>
                <span>Performance</span>
              </div>

              <div className="uno-perf-metric">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>SUCCESS RATE</span>
                <span className="uno-perf-val-yellow">84.54%</span>
              </div>

              <div className="uno-perf-metric">
                <span>⏱</span>
                <span>AVERAGE LATENCY</span>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>24.12s</span>
              </div>

              <div className="uno-perf-metric">
                <span>⚡</span>
                <span>THROUGHPUT</span>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>71.7 t/s</span>
              </div>
            </div>

            {/* Scrollable Model Health Chips */}
            <div className="uno-perf-chips-row">
              <div className="uno-model-health-chip">
                <span>deepseek-v4.1-flash</span>
                <span className="uno-dot-green" />
                <span style={{ color: "#10b981" }}>99.73%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>glm-5.3</span>
                <span className="uno-dot-green" />
                <span style={{ color: "#10b981" }}>99.78%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>deepseek-v4-pro</span>
                <span className="uno-dot-green" />
                <span style={{ color: "#10b981" }}>99.59%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>nemotron-3-ultra-550b-a…</span>
                <span className="uno-dot-orange" />
                <span style={{ color: "#f97316" }}>83.79%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>agnes-3.0-flash:free</span>
                <span className="uno-dot-yellow" />
                <span style={{ color: "#eab308" }}>92.81%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>claude-haiku-5-5:free</span>
                <span className="uno-dot-yellow" />
                <span style={{ color: "#eab308" }}>91.84%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>gpt-4o</span>
                <span className="uno-dot-green" />
                <span style={{ color: "#10b981" }}>99.9%</span>
              </div>

              <div className="uno-model-health-chip">
                <span>claude-3-5-sonnet</span>
                <span className="uno-dot-green" />
                <span style={{ color: "#10b981" }}>99.95%</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              MODEL DATA ANALYSIS & WORKSPACE TABS
             ======================================================== */}
          <div className="uno-analysis-box">
              {/* Box Header Toolbar */}
              <div className="uno-analysis-header">
                <div className="uno-analysis-title">
                  <span>⊞</span>
                  <span>Model Data Analysis</span>
                </div>

                <div className="uno-analysis-controls">
                  <button type="button" className="uno-analysis-btn">
                    <span>⚙</span>
                    <span>Preferences</span>
                  </button>

                  <button type="button" className="uno-analysis-btn">
                    <span>⏚</span>
                    <span>Filter</span>
                  </button>

                  <div className="uno-analysis-date-badge">
                    <span>📅</span>
                    <span>Oct 15, 2026 16:46 - Oct 16, 2026 16:46</span>
                  </div>

                  <button
                    type="button"
                    className="uno-analysis-btn"
                    onClick={refresh}
                    title="Refresh data"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Box Body */}
              <div className="uno-analysis-body">
                {analytics?.daily && analytics.daily.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--uno-text-secondary)" }}>
                      <span>Past 14 Days Token Volume</span>
                      <span className="mono">
                        Total: {analytics.tokensUsed.toLocaleString()} tokens
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${analytics.daily.length}, 1fr)`, gap: 8, height: 160, alignItems: "flex-end" }}>
                      {analytics.daily.map((d) => {
                        const maxVal = Math.max(1, ...analytics.daily.map((x) => x.tokens));
                        const pct = Math.min(100, Math.max(4, (d.tokens / maxVal) * 100));
                        return (
                          <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div
                              style={{
                                width: "100%",
                                height: `${pct}%`,
                                background: "linear-gradient(180deg, #10b981 0%, #064e3b 100%)",
                                borderRadius: 4,
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                              }}
                              title={`${d.day}: ${d.tokens.toLocaleString()} tokens`}
                            />
                            <span style={{ fontSize: 10, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                              {d.day.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 12 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <p style={{ color: "var(--uno-text-muted)", fontSize: 13, margin: 0 }}>
                      No live requests logged in this period. Make API calls to visualize token distributions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

          {/* ========================================================
              BILLING VIEW (Screenshots 1 & 2)
             ======================================================== */}
          {activeMenu === "billing" && (
            <BillingView user={user} sub={sub} />
          )}

          {/* ========================================================
              AFFILIATE VIEW (Screenshots 1 & 2)
             ======================================================== */}
          {activeMenu === "affiliate" && (
            <AffiliateView user={user} />
          )}

          {/* ========================================================
              SETTINGS & PROFILE VIEW (Screenshot)
             ======================================================== */}
          {activeMenu === "settings" && (
            <SettingsView user={user} sub={sub} />
          )}
        </div>
      </div>
    </div>
  );
}
