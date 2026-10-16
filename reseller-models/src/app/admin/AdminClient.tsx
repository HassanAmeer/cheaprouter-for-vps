"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicCombo } from "@/lib/cheaproute";

interface Plan {
  id: number;
  name: string;
  token_budget: number | null;
  rpm_limit: number | null;
  validity_days: number | null;
  models: string[] | null;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  plan: Plan | null;
  hasKey: boolean;
  expiresAt: string | null;
}

interface CatalogProvider {
  id: string;
  name: string;
  hasConnection?: boolean;
  models?: string[];
}

const emptyPlan = { name: "", tokenBudget: "", rpmLimit: "", validityDays: "", models: "" };

export default function AdminClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [catalogProviders, setCatalogProviders] = useState<CatalogProvider[]>([]);
  const [catalogCombos, setCatalogCombos] = useState<PublicCombo[]>([]);
  const [modelFilter, setModelFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, u, cat] = await Promise.all([
        fetch("/api/admin/plans").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/catalog").then((r) => r.json()).catch(() => ({ providers: [], combos: [] })),
      ]);
      if (p.error) throw new Error(p.error);
      if (u.error) throw new Error(u.error);
      setPlans(p.plans ?? []);
      setUsers(u.users ?? []);
      setCatalogProviders(cat.providers ?? []);
      setCatalogCombos(cat.combos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
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
  const allActiveModels = Array.from(
    new Set(activeProviders.flatMap((p) => p.models || []))
  );

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

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          tokenBudget: planForm.tokenBudget === "" ? null : Number(planForm.tokenBudget),
          rpmLimit: planForm.rpmLimit === "" ? null : Number(planForm.rpmLimit),
          validityDays: planForm.validityDays === "" ? null : Number(planForm.validityDays),
          models: planForm.models
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPlanMsg(data?.error ?? "Save failed");
        return;
      }
      setPlanForm(emptyPlan);
      setPlanMsg(`Plan "${data.plan.name}" saved`);
      void refresh();
    } finally {
      setSavingPlan(false);
    }
  }

  async function assignPlan() {
    if (!editingUser || !assignPlanId) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/admin/assign-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editingUser.id, planId: Number(assignPlanId) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setAssignMsg(data?.provisionError ?? data?.error ?? "Assign failed");
        return;
      }
      setAssignMsg(`Plan assigned + CheapRouter key provisioned for ${editingUser.email}`);
      setEditingUser(null);
      void refresh();
    } finally {
      setAssigning(false);
    }
  }

  if (loading) return <p className="muted" style={{ padding: "32px 0" }}>Loading admin panel…</p>;
  if (error) return <div className="alert error" style={{ margin: "32px 0" }}>{error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 0" }}>
      <h1 style={{ margin: 0 }}>Admin Panel</h1>

      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Plans Configuration Studio</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Token budget</th>
              <th>RPM</th>
              <th>Validity</th>
              <th>Models</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td><span className="badge">{p.name}</span></td>
                <td className="mono">{p.token_budget == null ? "∞" : p.token_budget.toLocaleString()}</td>
                <td className="mono">{p.rpm_limit ?? "∞"}</td>
                <td>{p.validity_days == null ? "Unlimited" : `${p.validity_days} days`}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {p.models?.length ? p.models.join(", ") : "All active models"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={savePlan} style={{ display: "grid", gap: 10, marginTop: 16, maxWidth: 560 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field">Name<input className="input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Pro" /></label>
            <label className="field">Token budget<input className="input" inputMode="numeric" value={planForm.tokenBudget} onChange={(e) => setPlanForm({ ...planForm, tokenBudget: e.target.value })} placeholder="50000000" /></label>
            <label className="field">RPM limit<input className="input" inputMode="numeric" value={planForm.rpmLimit} onChange={(e) => setPlanForm({ ...planForm, rpmLimit: e.target.value })} placeholder="30" /></label>
            <label className="field">Validity days (blank = unlimited)<input className="input" inputMode="numeric" value={planForm.validityDays} onChange={(e) => setPlanForm({ ...planForm, validityDays: e.target.value })} placeholder="30" /></label>
          </div>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span>Allowed models (comma-separated, blank = all active)</span>
              <div style={{ display: "flex", gap: 6 }}>
                {allActiveModels.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={selectAllActive}
                    >
                      Select All ({allActiveModels.length})
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={clearAllModels}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
            <input
              className="input mono"
              value={planForm.models}
              onChange={(e) => setPlanForm({ ...planForm, models: e.target.value })}
              placeholder="e.g. glm-5.3_flash, deepseek-r1"
            />

            {/* Configured Combos & Tiers Selector */}
            {catalogCombos.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--surface-2, rgba(255,255,255,0.03))",
                  border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "#8b5cf6",
                      }}
                    />
                    CheapRouter Combos ({catalogCombos.length}):
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={() => selectCombosByTier("free")}
                    >
                      + Free Combos
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      onClick={() => selectCombosByTier("paid")}
                    >
                      + Paid Combos
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 140,
                    overflowY: "auto",
                    paddingTop: 2,
                  }}
                >
                  {catalogCombos.map((c) => {
                    const isSelected = selectedModelsSet.has(c.name);
                    const tier = c.pricing?.tier || "free";
                    const isFree = tier === "free";
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => toggleModel(c.name)}
                        style={{
                          fontSize: 11,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          border: isSelected
                            ? "1px solid #8b5cf6"
                            : "1px solid var(--border-subtle, rgba(255,255,255,0.12))",
                          backgroundColor: isSelected
                            ? "rgba(139, 92, 246, 0.2)"
                            : "transparent",
                          color: isSelected ? "#c084fc" : "var(--text-muted, #94a3b8)",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        <span>{isSelected ? `✓ ${c.name}` : `+ ${c.name}`}</span>
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 4px",
                            borderRadius: 4,
                            backgroundColor: isFree ? "rgba(16, 185, 129, 0.2)" : "rgba(168, 85, 247, 0.2)",
                            color: isFree ? "#34d399" : "#c084fc",
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {isFree
                            ? "FREE"
                            : `$${c.pricing?.inputCost ?? 0}/$${c.pricing?.outputCost ?? 0}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dynamic Handshake Catalog Selector */}
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--surface-2, rgba(255,255,255,0.03))",
                border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: allActiveModels.length > 0 ? "#10b981" : "#f59e0b",
                    }}
                  />
                  CheapRouter Dynamic Handshake:{" "}
                  {allActiveModels.length > 0
                    ? `${allActiveModels.length} active models from ${activeProviders.length} connected providers`
                    : "No connected models detected"}
                </span>
                {allActiveModels.length > 6 && (
                  <input
                    type="text"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    placeholder="Search active models…"
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "inherit",
                    }}
                  />
                )}
              </div>

              {allActiveModels.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxHeight: 180,
                    overflowY: "auto",
                    paddingTop: 4,
                  }}
                >
                  {allActiveModels
                    .filter((m) => !modelFilter || m.toLowerCase().includes(modelFilter.toLowerCase()))
                    .map((m) => {
                      const isSelected = selectedModelsSet.has(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleModel(m)}
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            padding: "3px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            border: isSelected
                              ? "1px solid var(--primary, #3b82f6)"
                              : "1px solid var(--border-subtle, rgba(255,255,255,0.12))",
                            backgroundColor: isSelected
                              ? "var(--primary-subtle, rgba(59, 130, 246, 0.2))"
                              : "transparent",
                            color: isSelected ? "var(--primary, #60a5fa)" : "var(--text-muted, #94a3b8)",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {isSelected ? `✓ ${m}` : `+ ${m}`}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>
                  Connect providers in CheapRouter to enable live model selection.
                </div>
              )}
            </div>
          </div>
          {planMsg && <div className="alert ok">{planMsg}</div>}
          <div><button className="btn small" disabled={savingPlan}>{savingPlan ? "Saving…" : "Save plan"}</button></div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Users Management</h2>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Key</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div>{u.name || u.email}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{u.email} · {u.role}</div>
                </td>
                <td>{u.plan ? <span className="badge">{u.plan.name}</span> : <span className="faint">—</span>}</td>
                <td>{u.hasKey ? <span className="badge">issued</span> : <span className="faint">none</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{u.expiresAt ?? "—"}</td>
                <td>
                  <button className="btn ghost small" onClick={() => { setEditingUser(u); setAssignPlanId(u.plan ? String(u.plan.id) : ""); setAssignMsg(null); }}>
                    Edit Plan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editingUser && (
          <div className="card" style={{ marginTop: 16, background: "var(--surface-2)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Edit plan — {editingUser.email}</h3>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="field" style={{ minWidth: 220 }}>
                Plan
                <select className="select" value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)}>
                  <option value="">Select…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <button className="btn small" disabled={assigning || !assignPlanId} onClick={assignPlan}>
                {assigning ? "Assigning…" : "Assign + provision key"}
              </button>
              <button className="btn ghost small" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
            <p className="faint" style={{ fontSize: 12 }}>
              Saving calls CheapRouter <span className="mono">POST /api/keys</span> and stores the issued key on the subscription.
            </p>
            {assignMsg && <div className="alert ok">{assignMsg}</div>}
          </div>
        )}
      </section>
    </div>
  );
}
