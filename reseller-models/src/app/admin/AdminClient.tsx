"use client";

import { useCallback, useEffect, useState } from "react";

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

const emptyPlan = { name: "", tokenBudget: "", rpmLimit: "", validityDays: "", models: "" };

export default function AdminClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
      const [p, u] = await Promise.all([
        fetch("/api/admin/plans").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
      ]);
      if (p.error) throw new Error(p.error);
      if (u.error) throw new Error(u.error);
      setPlans(p.plans ?? []);
      setUsers(u.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          <label className="field">
            Allowed models (comma-separated, blank = all active)
            <input className="input mono" value={planForm.models} onChange={(e) => setPlanForm({ ...planForm, models: e.target.value })} placeholder="glm-5.3_flash, deepseek-r1" />
          </label>
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
