"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicCombo } from "@/lib/cheaproute";

interface Plan {
  id: number;
  name: string;
  price: number;
  description: string;
  features: string[];
  token_budget: number | null;
  rpm_limit: number | null;
  validity_days: number | null;
  models: string[] | null;
  is_popular: number;
  created_at?: string;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  status: "active" | "banned";
  createdAt: string;
  tokensUsed: number;
  plan: Plan | null;
  hasKey: boolean;
  cheaprouterApiKey: string | null;
  expiresAt: string | null;
}

interface CatalogProvider {
  id: string;
  name: string;
  hasConnection?: boolean;
  modelsCount?: number;
  models?: string[];
}

interface SiteSettings {
  site_name: string;
  site_logo: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_text: string;
  currency_symbol: string;
  discord_url: string;
  contact_email: string;
  footer_text: string;
  cheaproute_url: string;
}

interface OverviewMetrics {
  totalUsers: number;
  totalPlans: number;
  activeSubscriptions: number;
  totalTokensAllocated: number;
}

interface GatewayHealth {
  url: string;
  online: boolean;
  latencyMs: number;
  activeProviders: number;
  activeModels: number;
}

const emptyPlanForm = {
  id: 0,
  name: "",
  price: 0,
  description: "",
  featuresText: "",
  tokenBudget: "",
  rpmLimit: "",
  validityDays: "",
  models: "",
  isPopular: false,
};

const emptyUserForm = {
  id: 0,
  email: "",
  name: "",
  password: "",
  role: "user" as "admin" | "user",
  status: "active" as "active" | "banned",
};

export default function AdminClient({
  user = { id: 1, email: "admin@unorouter.com", name: "Administrator", role: "admin" },
}: {
  user?: { id: number; email: string; name: string; role: string };
}) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "plans" | "users" | "branding" | "models"
  >("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [gateway, setGateway] = useState<GatewayHealth | null>(null);
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "UnoRouter",
    site_logo: "",
    hero_title: "UNIFIED CRTT",
    hero_subtitle: "",
    hero_cta_text: "GET STARTED",
    currency_symbol: "$",
    discord_url: "https://discord.gg",
    contact_email: "support@unorouter.com",
    footer_text: "",
    cheaproute_url: "http://localhost:20128",
  });
  const [catalogProviders, setCatalogProviders] = useState<CatalogProvider[]>([]);
  const [catalogCombos, setCatalogCombos] = useState<PublicCombo[]>([]);

  // Modals & UI state
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // Plans state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planModelFilter, setPlanModelFilter] = useState("");

  // Users state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Assign Plan state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState<AdminUser | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Formatted Date
  const formattedDate = useMemo(() => {
    return new Date()
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
  }, []);

  // Initial load
  const refresh = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const [pRes, uRes, oRes, sRes, catRes] = await Promise.all([
        fetch("/api/admin/plans").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/admin/overview").then((r) => r.json()),
        fetch("/api/admin/settings").then((r) => r.json()),
        fetch("/api/catalog").then((r) => r.json()).catch(() => ({ providers: [], combos: [] })),
      ]);

      if (pRes?.plans) setPlans(pRes.plans);
      if (uRes?.users) setUsers(uRes.users);
      if (oRes?.metrics) setOverview(oRes.metrics);
      if (oRes?.gateway) setGateway(oRes.gateway);
      if (sRes?.settings) setSettings(sRes.settings);
      if (catRes?.providers) setCatalogProviders(catRes.providers);
      if (catRes?.combos) setCatalogCombos(catRes.combos);
    } catch (err) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Failed to load admin data",
        type: "err",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeProviders = catalogProviders.filter(
    (p) => p.hasConnection !== false && Array.isArray(p.models) && p.models.length > 0
  );
  const allActiveModels = Array.from(new Set(activeProviders.flatMap((p) => p.models || [])));

  const selectedModelsArray = planForm.models
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedModelsSet = new Set(selectedModelsArray);

  function toggleModel(modelId: string) {
    if (selectedModelsSet.has(modelId)) {
      const next = selectedModelsArray.filter((m) => m !== modelId);
      setPlanForm({ ...planForm, models: next.join(", ") });
    } else {
      const next = [...selectedModelsArray, modelId];
      setPlanForm({ ...planForm, models: next.join(", ") });
    }
  }

  function selectAllActive() {
    setPlanForm({ ...planForm, models: allActiveModels.join(", ") });
  }

  function selectCombosByTier(tier: "free" | "paid") {
    const matching = catalogCombos
      .filter((c) => (c.pricing?.tier || "free") === tier)
      .map((c) => c.name);
    const union = Array.from(new Set([...selectedModelsArray, ...matching]));
    setPlanForm({ ...planForm, models: union.join(", ") });
  }

  function clearAllModels() {
    setPlanForm({ ...planForm, models: "" });
  }

  // Save Settings handler
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setStatusMsg({ text: "Branding and site settings saved successfully!", type: "ok" });
    } catch (err) {
      setStatusMsg({
        text: err instanceof Error ? err.message : "Failed to save settings",
        type: "err",
      });
    } finally {
      setSavingSettings(false);
    }
  }

  // Plan CRUD handlers
  function openAddPlan() {
    setPlanForm(emptyPlanForm);
    setPlanModalOpen(true);
  }

  function openEditPlan(p: Plan) {
    setPlanForm({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      featuresText: Array.isArray(p.features) ? p.features.join("\n") : "",
      tokenBudget: p.token_budget == null ? "" : String(p.token_budget),
      rpmLimit: p.rpm_limit == null ? "" : String(p.rpm_limit),
      validityDays: p.validity_days == null ? "" : String(p.validity_days),
      models: Array.isArray(p.models) ? p.models.join(", ") : "",
      isPopular: p.is_popular === 1,
    });
    setPlanModalOpen(true);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const features = planForm.featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: planForm.id || undefined,
          name: planForm.name,
          price: Number(planForm.price),
          description: planForm.description,
          features,
          isPopular: planForm.isPopular,
          tokenBudget: planForm.tokenBudget === "" ? null : Number(planForm.tokenBudget),
          rpmLimit: planForm.rpmLimit === "" ? null : Number(planForm.rpmLimit),
          validityDays: planForm.validityDays === "" ? null : Number(planForm.validityDays),
          models: planForm.models
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plan");
      setPlanModalOpen(false);
      setStatusMsg({ text: `Plan "${data.plan.name}" saved successfully!`, type: "ok" });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete plan "${name}"? Users on this plan will be safely moved to Free.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/plans?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setStatusMsg({ text: `Plan "${name}" deleted.`, type: "ok" });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete plan");
    }
  }

  // User CRUD handlers
  function openAddUser() {
    setUserForm(emptyUserForm);
    setUserModalOpen(true);
  }

  function openEditUser(u: AdminUser) {
    setUserForm({
      id: u.id,
      email: u.email,
      name: u.name,
      password: "",
      role: u.role,
      status: u.status,
    });
    setUserModalOpen(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");
      setUserModalOpen(false);
      setStatusMsg({ text: `User ${data.user.email} saved successfully!`, type: "ok" });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(id: number, email: string) {
    if (!confirm(`Are you sure you want to delete user "${email}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setStatusMsg({ text: `User "${email}" deleted.`, type: "ok" });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function handleToggleUserStatus(u: AdminUser) {
    const nextStatus = u.status === "banned" ? "active" : "banned";
    try {
      const res = await fetch("/api/admin/user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle status");
      setStatusMsg({
        text: `User ${u.email} is now ${nextStatus.toUpperCase()}`,
        type: "ok",
      });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status update failed");
    }
  }

  // Plan Assignment
  function openAssignPlan(u: AdminUser) {
    setAssigningUser(u);
    setAssignPlanId(u.plan ? String(u.plan.id) : "");
    setAssignModalOpen(true);
  }

  async function handleAssignPlan() {
    if (!assigningUser || !assignPlanId) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/assign-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assigningUser.id, planId: Number(assignPlanId) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.provisionError || data?.error || "Plan assignment failed");
      }
      setAssignModalOpen(false);
      setStatusMsg({
        text: `Plan assigned and CheapRoute API key provisioned for ${assigningUser.email}`,
        type: "ok",
      });
      void refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
  });

  return (
    <div className="uno-dash-wrapper">
      {/* ========================================================
          LEFT SIDEBAR (MATCHING UNOROUTER DASHBOARD SYSTEM)
         ======================================================== */}
      <aside className={`uno-dash-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* Brand Logo */}
        <Link href="/" className="uno-dash-sidebar-brand">
          <div className="uno-logo-icon" style={{ width: 24, height: 24, flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" fill="#0E1219" stroke="#E11D48" strokeWidth="2" />
              <path d="M11 11L7 16L11 21" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 11L11 16L15 21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 21L25 16L21 11" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 21L21 16L17 11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>{settings.site_name.toUpperCase()}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "#E11D48",
                  color: "#ffffff",
                  letterSpacing: "0.5px",
                }}
              >
                ADMIN
              </span>
            </div>
          )}
        </Link>

        {/* Section 1: Admin Menu */}
        <div className="uno-dash-sidebar-section">
          {!sidebarCollapsed && <div className="uno-dash-section-label">Admin Menu</div>}

          <button
            type="button"
            className={`uno-dash-nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Overview & Health</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeTab === "plans" ? "active" : ""}`}
            onClick={() => setActiveTab("plans")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Plans Studio</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Users & Quotas</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeTab === "branding" ? "active" : ""}`}
            onClick={() => setActiveTab("branding")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Branding & Settings</span>}
          </button>

          <button
            type="button"
            className={`uno-dash-nav-item ${activeTab === "models" ? "active" : ""}`}
            onClick={() => setActiveTab("models")}
          >
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Models Catalog</span>}
          </button>
        </div>

        {/* Section 2: Navigate */}
        <div className="uno-dash-sidebar-section">
          {!sidebarCollapsed && <div className="uno-dash-section-label">Navigate</div>}

          <Link href="/dashboard" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="12 8 8 12 12 16 12 8" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>User Dashboard</span>}
          </Link>

          <Link href="/models" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Models Library</span>}
          </Link>

          <Link href="/pricing" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Pricing Plans</span>}
          </Link>

          <Link href="/docs" className="uno-dash-nav-item">
            <span className="uno-dash-nav-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
            {!sidebarCollapsed && <span>Documentation</span>}
          </Link>
        </div>

        {/* Sidebar Footer */}
        <div className="uno-dash-sidebar-footer">
          <button
            type="button"
            className="uno-dash-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
          {!sidebarCollapsed && (
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                {user.email}
              </div>
              <div style={{ fontSize: 10, color: "var(--uno-text-muted)", textTransform: "uppercase" }}>
                Role: {user.role}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================
          MAIN CONTENT AREA
         ======================================================== */}
      <div className="uno-dash-main">
        {/* Topbar */}
        <header className="uno-dash-topbar">
          <div className="uno-dash-topbar-left">
            <button
              type="button"
              className="uno-dash-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="uno-dash-breadcrumb">
              <span>{settings.site_name.toUpperCase()}</span>
              <span>/</span>
              <span>ADMIN CONSOLE</span>
              <span>/</span>
              <span style={{ color: "#ffffff" }}>{activeTab.toUpperCase()}</span>
            </div>
          </div>

          <div className="uno-dash-topbar-right">
            <div className="uno-dash-date-badge">
              <span className="uno-dot-green" />
              <span>{formattedDate}</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: "var(--uno-font-mono)",
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 4,
                backgroundColor: gateway?.online ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: gateway?.online ? "#34d399" : "#f87171",
                border: `1px solid ${gateway?.online ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: gateway?.online ? "#10b981" : "#ef4444",
                }}
              />
              GATEWAY: {gateway?.online ? `ONLINE (${gateway.latencyMs}ms)` : "DISCONNECTED"}
            </div>

            <button
              type="button"
              onClick={() => void refresh()}
              className="uno-analysis-btn"
              title="Reload all admin metrics"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="uno-dash-content">
          {/* Greeting */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 className="uno-dash-greeting">Admin Control Center</h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--uno-text-muted)" }}>
                Full A-to-Z control over plans, quotas, CheapRoute gateway routing, and dynamic site branding.
              </p>
            </div>
          </div>

          {/* Sub-tabs bar */}
          <div className="uno-dash-subtabs">
            <button
              type="button"
              className={`uno-dash-subtab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview &amp; Health
            </button>
            <button
              type="button"
              className={`uno-dash-subtab ${activeTab === "plans" ? "active" : ""}`}
              onClick={() => setActiveTab("plans")}
            >
              Plans Studio ({plans.length})
            </button>
            <button
              type="button"
              className={`uno-dash-subtab ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              Users &amp; Quotas ({users.length})
            </button>
            <button
              type="button"
              className={`uno-dash-subtab ${activeTab === "branding" ? "active" : ""}`}
              onClick={() => setActiveTab("branding")}
            >
              Branding &amp; Settings
            </button>
            <button
              type="button"
              className={`uno-dash-subtab ${activeTab === "models" ? "active" : ""}`}
              onClick={() => setActiveTab("models")}
            >
              Models Catalog ({allActiveModels.length})
            </button>
          </div>

          {/* 5 KPI Stat Cards Grid */}
          <div className="uno-dash-kpi-grid">
            {/* Card 1: TOTAL USERS */}
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>#</span>
                <span>TOTAL REGISTERED USERS</span>
              </div>
              <div className="uno-kpi-val">{overview?.totalUsers ?? users.length}</div>
              <div className="uno-kpi-sub">
                Admins: {users.filter((u) => u.role === "admin").length} · Users: {users.filter((u) => u.role === "user").length}
              </div>
            </div>

            {/* Card 2: ACTIVE PLANS */}
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>$</span>
                <span>ACTIVE PLANS TIERS</span>
              </div>
              <div className="uno-kpi-val">{plans.length}</div>
              <div className="uno-kpi-sub">
                Free: {plans.filter((p) => p.price === 0).length} · Paid: {plans.filter((p) => p.price > 0).length}
              </div>
            </div>

            {/* Card 3: SUBSCRIPTIONS */}
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⇶</span>
                <span>ACTIVE SUBSCRIPTIONS</span>
              </div>
              <div className="uno-kpi-val" style={{ color: "#34d399" }}>
                {overview?.activeSubscriptions ?? 0}
              </div>
              <div className="uno-kpi-sub">
                With CheapRoute Key: {users.filter((u) => u.hasKey).length}
              </div>
            </div>

            {/* Card 4: ALLOCATED CAPACITY */}
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⏱</span>
                <span>TOKEN CAPACITY ALLOCATED</span>
              </div>
              <div className="uno-kpi-val" style={{ color: "#c084fc" }}>
                {((overview?.totalTokensAllocated ?? 0) / 1_000_000).toFixed(1)}M
              </div>
              <div className="uno-kpi-sub">Enforced by CheapRoute Gateway</div>
            </div>

            {/* Card 5: GATEWAY HEALTH */}
            <div className="uno-kpi-card">
              <div className="uno-kpi-header">
                <span>⚡</span>
                <span>GATEWAY STATUS</span>
              </div>
              <div className="uno-kpi-val" style={{ color: gateway?.online ? "#34d399" : "#f87171" }}>
                {gateway?.online ? "ONLINE" : "OFFLINE"}
              </div>
              <div className="uno-kpi-sub">
                Ping: {gateway?.latencyMs ?? 0}ms · {allActiveModels.length} models
              </div>
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMsg && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 18px",
                borderRadius: 6,
                backgroundColor: statusMsg.type === "ok" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${statusMsg.type === "ok" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: statusMsg.type === "ok" ? "#34d399" : "#f87171",
                fontSize: 13,
              }}
            >
              <span>{statusMsg.text}</span>
              <button
                type="button"
                onClick={() => setStatusMsg(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* CheapRoute Gateway Health Card */}
              <div className="uno-analysis-box">
                <div className="uno-analysis-header">
                  <div className="uno-analysis-title">
                    <span>🔌 CheapRoute Core Engine Link</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: gateway?.online ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: gateway?.online ? "#34d399" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {gateway?.online ? "CONNECTED & ROUTING" : "DISCONNECTED"}
                    </span>
                  </div>
                  <div className="uno-analysis-controls">
                    <span className="uno-analysis-date-badge">
                      Target: {gateway?.url || settings.cheaproute_url}
                    </span>
                  </div>
                </div>

                <div className="uno-analysis-body">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", fontFamily: "var(--uno-font-mono)" }}>
                        Gateway URL
                      </div>
                      <div style={{ fontSize: 13, fontFamily: "var(--uno-font-mono)", marginTop: 4, color: "#fff" }}>
                        {gateway?.url}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", fontFamily: "var(--uno-font-mono)" }}>
                        Response Ping
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "#34d399" }}>
                        {gateway?.latencyMs ?? 0} ms
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", fontFamily: "var(--uno-font-mono)" }}>
                        Live Providers Connected
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "#fff" }}>
                        {gateway?.activeProviders ?? activeProviders.length} Upstream Providers
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", fontFamily: "var(--uno-font-mono)" }}>
                        Available AI Models
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "#60a5fa" }}>
                        {allActiveModels.length} Models Ready
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Users Table */}
              <div className="uno-analysis-box">
                <div className="uno-analysis-header">
                  <div className="uno-analysis-title">
                    <span>Recent Registered Users</span>
                    <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>
                      ({users.length} total)
                    </span>
                  </div>
                  <div className="uno-analysis-controls">
                    <button
                      type="button"
                      className="uno-analysis-btn"
                      onClick={() => setActiveTab("users")}
                    >
                      View All Users ({users.length}) →
                    </button>
                  </div>
                </div>

                <div className="uno-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="uno-table">
                    <thead>
                      <tr>
                        <th>User Details</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Plan</th>
                        <th>CheapRoute Key</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.slice(0, 6).map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{u.name || u.email}</div>
                            <div style={{ fontSize: 11, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                              {u.email}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--uno-font-mono)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: u.role === "admin" ? "rgba(168, 85, 247, 0.2)" : "#161b26",
                                color: u.role === "admin" ? "#c084fc" : "var(--uno-text-secondary)",
                              }}
                            >
                              {u.role.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--uno-font-mono)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                backgroundColor: u.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: u.status === "active" ? "#34d399" : "#f87171",
                                fontWeight: 700,
                              }}
                            >
                              {u.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {u.plan ? (
                              <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 600 }}>{u.plan.name}</span>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>—</span>
                            )}
                          </td>
                          <td>
                            {u.hasKey ? (
                              <span style={{ fontSize: 11, color: "#34d399" }}>✓ Issued</span>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>None</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                            {u.createdAt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLANS MANAGEMENT */}
          {activeTab === "plans" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Subscription &amp; Pricing Plans</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uno-text-muted)" }}>
                    Configure token budgets, RPM limits, pricing, allowed models, and display features.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddPlan}
                  style={{
                    background: "#E11D48",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 16px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  + Add New Plan
                </button>
              </div>

              {/* Plans Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="uno-kpi-card"
                    style={{
                      position: "relative",
                      border: p.is_popular ? "1px solid #E11D48" : "1px solid #161b26",
                    }}
                  >
                    {p.is_popular === 1 && (
                      <span
                        style={{
                          position: "absolute",
                          top: -10,
                          right: 14,
                          background: "#E11D48",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 12,
                          letterSpacing: "0.5px",
                        }}
                      >
                        MOST POPULAR
                      </span>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>{p.name}</h3>
                        <div style={{ fontSize: 12, color: "var(--uno-text-muted)", marginTop: 2 }}>
                          {p.description || "No description set"}
                        </div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--uno-font-mono)", color: "#fff" }}>
                        {settings.currency_symbol}{p.price}
                        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--uno-text-muted)" }}> /mo</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        margin: "8px 0 14px",
                        padding: "10px 12px",
                        borderRadius: 6,
                        background: "#080b10",
                        border: "1px solid #141822",
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--uno-text-muted)" }}>Budget: </span>
                        <strong style={{ fontFamily: "var(--uno-font-mono)", color: "#fff" }}>
                          {p.token_budget == null ? "Unlimited" : `${(p.token_budget / 1_000_000).toFixed(0)}M`}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--uno-text-muted)" }}>RPM: </span>
                        <strong style={{ fontFamily: "var(--uno-font-mono)", color: "#fff" }}>
                          {p.rpm_limit ?? "Unlimited"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--uno-text-muted)" }}>Validity: </span>
                        <strong style={{ color: "#fff" }}>
                          {p.validity_days ? `${p.validity_days} days` : "Unlimited"}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--uno-text-muted)" }}>Models: </span>
                        <strong style={{ color: "#60a5fa" }}>
                          {p.models?.length ? `${p.models.length} restricted` : "All active"}
                        </strong>
                      </div>
                    </div>

                    {Array.isArray(p.features) && p.features.length > 0 && (
                      <ul style={{ margin: "0 0 16px", paddingLeft: 16, fontSize: 12, color: "var(--uno-text-secondary)" }}>
                        {p.features.map((f, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>{f}</li>
                        ))}
                      </ul>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: "auto", borderTop: "1px solid #161b26", paddingTop: 12 }}>
                      <button
                        type="button"
                        className="uno-analysis-btn"
                        style={{ flex: 1, justifyContent: "center" }}
                        onClick={() => openEditPlan(p)}
                      >
                        Edit Plan
                      </button>
                      {p.name.toLowerCase() !== "free" && (
                        <button
                          type="button"
                          className="uno-analysis-btn"
                          style={{ color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}
                          onClick={() => void handleDeletePlan(p.id, p.name)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Plan Modal */}
              {planModalOpen && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 100,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 620,
                      maxHeight: "90vh",
                      overflowY: "auto",
                      background: "#0a0d14",
                      border: "1px solid #1f2738",
                      borderRadius: 10,
                      padding: 24,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>
                        {planForm.id ? `Edit Plan: ${planForm.name}` : "Create New Plan"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setPlanModalOpen(false)}
                        style={{ background: "none", border: "none", color: "var(--uno-text-muted)", cursor: "pointer", fontSize: 18 }}
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSavePlan} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Plan Name *
                          </label>
                          <input
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={planForm.name}
                            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                            placeholder="e.g. Pro, Ultra, Starter"
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Price ({settings.currency_symbol}) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={planForm.price}
                            onChange={(e) => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                          Short Description
                        </label>
                        <input
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 12px",
                            fontSize: 13,
                          }}
                          value={planForm.description}
                          onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                          placeholder="e.g. Perfect for developers and small teams"
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Token Budget
                          </label>
                          <input
                            type="number"
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={planForm.tokenBudget}
                            onChange={(e) => setPlanForm({ ...planForm, tokenBudget: e.target.value })}
                            placeholder="e.g. 50000000"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            RPM Limit
                          </label>
                          <input
                            type="number"
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={planForm.rpmLimit}
                            onChange={(e) => setPlanForm({ ...planForm, rpmLimit: e.target.value })}
                            placeholder="e.g. 60"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Validity Days
                          </label>
                          <input
                            type="number"
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={planForm.validityDays}
                            onChange={(e) => setPlanForm({ ...planForm, validityDays: e.target.value })}
                            placeholder="e.g. 30"
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                          Features List (One per line)
                        </label>
                        <textarea
                          rows={3}
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                          value={planForm.featuresText}
                          onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                          placeholder="50M Monthly Tokens&#10;Access to Claude 3.5 &amp; GPT-4o&#10;Fast Upstream Routing"
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          id="isPopular"
                          checked={planForm.isPopular}
                          onChange={(e) => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                        />
                        <label htmlFor="isPopular" style={{ fontSize: 12, color: "#fff", cursor: "pointer" }}>
                          Mark as &quot;Most Popular&quot; card
                        </label>
                      </div>

                      {/* Model Picker */}
                      <div style={{ background: "#080b10", border: "1px solid #161b26", borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--uno-text-muted)", textTransform: "uppercase" }}>
                            Allowed AI Models ({selectedModelsArray.length} selected)
                          </span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="uno-analysis-btn" style={{ fontSize: 10, padding: "2px 8px" }} onClick={selectAllActive}>
                              Select All
                            </button>
                            <button type="button" className="uno-analysis-btn" style={{ fontSize: 10, padding: "2px 8px" }} onClick={clearAllModels}>
                              Clear
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 4,
                            color: "#fff",
                            padding: "4px 8px",
                            fontSize: 11,
                            marginBottom: 8,
                          }}
                          value={planModelFilter}
                          onChange={(e) => setPlanModelFilter(e.target.value)}
                          placeholder="Filter models..."
                        />

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 110, overflowY: "auto" }}>
                          {allActiveModels
                            .filter((m) => !planModelFilter || m.toLowerCase().includes(planModelFilter.toLowerCase()))
                            .map((m) => {
                              const isSel = selectedModelsSet.has(m);
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => toggleModel(m)}
                                  style={{
                                    fontSize: 10,
                                    fontFamily: "var(--uno-font-mono)",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    border: isSel ? "1px solid #E11D48" : "1px solid #1a2233",
                                    background: isSel ? "rgba(225, 29, 72, 0.2)" : "#0e1219",
                                    color: isSel ? "#ffffff" : "var(--uno-text-muted)",
                                    cursor: "pointer",
                                  }}
                                >
                                  {isSel ? `✓ ${m}` : `+ ${m}`}
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          type="button"
                          className="uno-analysis-btn"
                          onClick={() => setPlanModalOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{
                            background: "#E11D48",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 16px",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                          disabled={savingPlan}
                        >
                          {savingPlan ? "Saving..." : "Save Plan"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: USERS & QUOTAS MANAGEMENT */}
          {activeTab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Users &amp; API Quota Provisioning</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uno-text-muted)" }}>
                    Assign plans, provision CheapRoute API keys, manage accounts, and control token quotas.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{
                      background: "#0a0d14",
                      border: "1px solid #161b26",
                      borderRadius: 6,
                      color: "#fff",
                      padding: "6px 12px",
                      fontSize: 12,
                      width: 220,
                    }}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search email or name..."
                  />
                  <button
                    type="button"
                    onClick={openAddUser}
                    style={{
                      background: "#E11D48",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 14px",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    + Add User
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="uno-analysis-box">
                <div className="uno-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="uno-table">
                    <thead>
                      <tr>
                        <th>User Details</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Current Plan</th>
                        <th>CheapRoute Key</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{u.name || u.email}</div>
                            <div style={{ fontSize: 11, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                              {u.email}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--uno-font-mono)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: u.role === "admin" ? "rgba(168, 85, 247, 0.2)" : "#161b26",
                                color: u.role === "admin" ? "#c084fc" : "var(--uno-text-secondary)",
                              }}
                            >
                              {u.role.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void handleToggleUserStatus(u)}
                              disabled={u.email === "admin"}
                              title={u.email === "admin" ? "Admin cannot be banned" : "Click to toggle active/banned"}
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--uno-font-mono)",
                                padding: "2px 8px",
                                borderRadius: 4,
                                cursor: u.email === "admin" ? "default" : "pointer",
                                backgroundColor: u.status === "active" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                                color: u.status === "active" ? "#34d399" : "#f87171",
                                border: `1px solid ${u.status === "active" ? "#10b981" : "#ef4444"}`,
                                fontWeight: 700,
                              }}
                            >
                              {u.status.toUpperCase()}
                            </button>
                          </td>
                          <td>
                            {u.plan ? (
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>{u.plan.name}</span>
                                <div style={{ fontSize: 10, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                                  {u.plan.token_budget ? `${(u.plan.token_budget / 1_000_000).toFixed(0)}M` : "∞"} tok · {u.plan.rpm_limit ?? "∞"} RPM
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>No Plan</span>
                            )}
                          </td>
                          <td>
                            {u.hasKey ? (
                              <div>
                                <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✓ Issued</span>
                                {u.cheaprouterApiKey && (
                                  <div style={{ fontSize: 10, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)", marginTop: 2 }}>
                                    {u.cheaprouterApiKey.slice(0, 10)}...
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>None</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                            {u.expiresAt ? new Date(u.expiresAt).toLocaleDateString() : "Never"}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="uno-analysis-btn"
                                style={{ fontSize: 11, padding: "3px 8px" }}
                                onClick={() => openAssignPlan(u)}
                              >
                                Assign Plan
                              </button>
                              <button
                                type="button"
                                className="uno-analysis-btn"
                                style={{ fontSize: 11, padding: "3px 8px" }}
                                onClick={() => openEditUser(u)}
                              >
                                Edit
                              </button>
                              {u.email !== "admin" && (
                                <button
                                  type="button"
                                  className="uno-analysis-btn"
                                  style={{ fontSize: 11, padding: "3px 8px", color: "#f87171" }}
                                  onClick={() => void handleDeleteUser(u.id, u.email)}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add / Edit User Modal */}
              {userModalOpen && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 100,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 460,
                      background: "#0a0d14",
                      border: "1px solid #1f2738",
                      borderRadius: 10,
                      padding: 24,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>
                        {userForm.id ? `Edit User: ${userForm.email}` : "Add New User"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setUserModalOpen(false)}
                        style={{ background: "none", border: "none", color: "var(--uno-text-muted)", cursor: "pointer", fontSize: 18 }}
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                          Email / Username *
                        </label>
                        <input
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 12px",
                            fontSize: 13,
                          }}
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          placeholder="user@example.com"
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                          Full Name
                        </label>
                        <input
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 12px",
                            fontSize: 13,
                          }}
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                          Password {userForm.id ? "(leave blank to keep current)" : "*"}
                        </label>
                        <input
                          type="password"
                          style={{
                            width: "100%",
                            background: "#07090e",
                            border: "1px solid #1a2233",
                            borderRadius: 6,
                            color: "#fff",
                            padding: "8px 12px",
                            fontSize: 13,
                          }}
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          placeholder={userForm.id ? "••••••••" : "Enter password"}
                          required={!userForm.id}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Role
                          </label>
                          <select
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as "admin" | "user" })}
                          >
                            <option value="user">User</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            Status
                          </label>
                          <select
                            style={{
                              width: "100%",
                              background: "#07090e",
                              border: "1px solid #1a2233",
                              borderRadius: 6,
                              color: "#fff",
                              padding: "8px 12px",
                              fontSize: 13,
                            }}
                            value={userForm.status}
                            onChange={(e) => setUserForm({ ...userForm, status: e.target.value as "active" | "banned" })}
                          >
                            <option value="active">Active</option>
                            <option value="banned">Banned</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          type="button"
                          className="uno-analysis-btn"
                          onClick={() => setUserModalOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{
                            background: "#E11D48",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "8px 16px",
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                          disabled={savingUser}
                        >
                          {savingUser ? "Saving..." : "Save User"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Assign Plan Modal */}
              {assignModalOpen && assigningUser && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 100,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 500,
                      background: "#0a0d14",
                      border: "1px solid #1f2738",
                      borderRadius: 10,
                      padding: 24,
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 18, color: "#fff" }}>
                        Assign Plan &amp; Provision Key
                      </h3>
                      <button
                        type="button"
                        onClick={() => setAssignModalOpen(false)}
                        style={{ background: "none", border: "none", color: "var(--uno-text-muted)", cursor: "pointer", fontSize: 18 }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase" }}>
                        Assigning to User:
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: "#fff" }}>
                        {assigningUser.name || assigningUser.email} ({assigningUser.email})
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                        Select Subscription Plan:
                      </label>
                      <select
                        style={{
                          width: "100%",
                          background: "#07090e",
                          border: "1px solid #1a2233",
                          borderRadius: 6,
                          color: "#fff",
                          padding: "8px 12px",
                          fontSize: 13,
                        }}
                        value={assignPlanId}
                        onChange={(e) => setAssignPlanId(e.target.value)}
                      >
                        <option value="">Choose a plan...</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {settings.currency_symbol}{p.price} / {p.token_budget ? `${(p.token_budget / 1_000_000).toFixed(0)}M tok` : "Unlimited"} ({p.rpm_limit ?? "∞"} RPM)
                          </option>
                        ))}
                      </select>
                    </div>

                    <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--uno-text-muted)", background: "#07090e", padding: 10, borderRadius: 6, border: "1px solid #141822" }}>
                      ⚡ When confirmed, CheapRoute Gateway will be called via <span style={{ fontFamily: "var(--uno-font-mono)", color: "#fff" }}>POST /api/keys</span> to provision a fresh, secured API key with the plan token quota, RPM limit, and model restrictions.
                    </p>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                      <button
                        type="button"
                        className="uno-analysis-btn"
                        onClick={() => setAssignModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "#E11D48",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 16px",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                        disabled={assigning || !assignPlanId}
                        onClick={() => void handleAssignPlan()}
                      >
                        {assigning ? "Provisioning..." : "Assign & Provision Key"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BRANDING & SITE SETTINGS */}
          {activeTab === "branding" && (
            <form onSubmit={saveSettings} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Dynamic Branding &amp; Site Configuration</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uno-text-muted)" }}>
                    Every element updates dynamically: site name, logo, hero headlines, CTA buttons, and currencies.
                  </p>
                </div>
                <button
                  type="submit"
                  style={{
                    background: "#E11D48",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "8px 18px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  disabled={savingSettings}
                >
                  {savingSettings ? "Saving..." : "Save All Changes"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
                {/* Brand Identity */}
                <div className="uno-kpi-card" style={{ gap: 14 }}>
                  <div className="uno-kpi-header">
                    <span>🎨</span>
                    <span>BRAND IDENTITY</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Website Name
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.site_name}
                      onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Logo Image URL
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.site_logo}
                      onChange={(e) => setSettings({ ...settings, site_logo: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Currency Symbol
                    </label>
                    <input
                      style={{
                        width: 90,
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontFamily: "var(--uno-font-mono)",
                      }}
                      value={settings.currency_symbol}
                      onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Hero Section */}
                <div className="uno-kpi-card" style={{ gap: 14 }}>
                  <div className="uno-kpi-header">
                    <span>⚡</span>
                    <span>LANDING PAGE HERO</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Hero Title
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.hero_title}
                      onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Hero Subtitle / Description
                    </label>
                    <textarea
                      rows={3}
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 12,
                      }}
                      value={settings.hero_subtitle}
                      onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Hero CTA Button Text
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.hero_cta_text}
                      onChange={(e) => setSettings({ ...settings, hero_cta_text: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Contact & Footer */}
                <div className="uno-kpi-card" style={{ gap: 14 }}>
                  <div className="uno-kpi-header">
                    <span>💬</span>
                    <span>CONTACT &amp; FOOTER</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Discord URL
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.discord_url}
                      onChange={(e) => setSettings({ ...settings, discord_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Contact Email
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                      value={settings.contact_email}
                      onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      Footer Text
                    </label>
                    <textarea
                      rows={2}
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 12,
                      }}
                      value={settings.footer_text}
                      onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
                    />
                  </div>
                </div>

                {/* Gateway Router Configuration */}
                <div className="uno-kpi-card" style={{ gap: 14 }}>
                  <div className="uno-kpi-header">
                    <span>🔌</span>
                    <span>CHEAPROUTE CORE GATEWAY</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--uno-text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                      CheapRoute Gateway Address
                    </label>
                    <input
                      style={{
                        width: "100%",
                        background: "#07090e",
                        border: "1px solid #1a2233",
                        borderRadius: 6,
                        color: "#fff",
                        padding: "8px 12px",
                        fontSize: 13,
                        fontFamily: "var(--uno-font-mono)",
                      }}
                      value={settings.cheaproute_url}
                      onChange={(e) => setSettings({ ...settings, cheaproute_url: e.target.value })}
                      required
                    />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--uno-text-muted)", margin: 0, lineHeight: 1.5 }}>
                    This is the backend service handling streaming completions, model fallback, and token rate limits.
                  </p>
                </div>
              </div>
            </form>
          )}

          {/* TAB 5: MODELS CATALOG */}
          {activeTab === "models" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>Upstream AI Providers &amp; Combos</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--uno-text-muted)" }}>
                  Live catalog loaded directly from CheapRoute Gateway ({activeProviders.length} connected providers, {allActiveModels.length} models, {catalogCombos.length} combos).
                </p>
              </div>

              {/* Combos list */}
              {catalogCombos.length > 0 && (
                <div className="uno-analysis-box">
                  <div className="uno-analysis-header">
                    <div className="uno-analysis-title">
                      <span>Configured CheapRoute Combos</span>
                      <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>
                        ({catalogCombos.length} combos)
                      </span>
                    </div>
                  </div>
                  <div className="uno-analysis-body">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {catalogCombos.map((c) => (
                        <div
                          key={c.name}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "#080b10",
                            border: "1px solid #161b26",
                            fontSize: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#fff" }}>{c.name}</span>
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "var(--uno-font-mono)",
                              padding: "1px 5px",
                              borderRadius: 4,
                              backgroundColor: c.pricing?.tier === "free" ? "rgba(16, 185, 129, 0.2)" : "rgba(168, 85, 247, 0.2)",
                              color: c.pricing?.tier === "free" ? "#34d399" : "#c084fc",
                              fontWeight: 700,
                            }}
                          >
                            {c.pricing?.tier?.toUpperCase() || "FREE"}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>({c.models.length} targets)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Providers grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {activeProviders.map((p) => (
                  <div key={p.id} className="uno-kpi-card" style={{ gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{p.name}</div>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: "var(--uno-font-mono)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: "rgba(16, 185, 129, 0.15)",
                          color: "#34d399",
                          fontWeight: 700,
                        }}
                      >
                        CONNECTED
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--uno-text-muted)" }}>
                      {p.models?.length ?? 0} Models available
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 110, overflowY: "auto", marginTop: 4 }}>
                      {p.models?.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--uno-font-mono)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#080b10",
                            border: "1px solid #161b26",
                            color: "var(--uno-text-secondary)",
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
