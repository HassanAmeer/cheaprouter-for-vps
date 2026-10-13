"use client";

import { useCallback, useEffect, useState } from "react";

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
}: {
  user: { id: number; email: string; name: string; role: string };
}) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [keys, setKeys] = useState<ByokKey[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [byokEnabled, setByokEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setAnalytics(a.error ? null : a);
      setByokEnabled(c?.byokEnabled ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(apiKey).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => setCopied(false)
      );
    }
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

  if (loading) return <p className="muted" style={{ padding: "32px 0" }}>Loading dashboard…</p>;
  if (error || !sub) {
    return <div className="alert error" style={{ margin: "32px 0" }}>{error ?? "No subscription"}</div>;
  }

  const maxDaily = Math.max(1, ...((analytics?.daily ?? []).map((d) => d.tokens)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "32px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn ghost small" onClick={logout}>Logout</button>
      </div>

      <section className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Active Subscription</h2>
          <span className="badge">{sub.plan.name}</span>
          <span className="spacer" style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 13 }}>{sub.expiryLabel}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }} className="muted">
            <span>Token quota</span>
            <span className="mono">
              {sub.usage.tokensUsed.toLocaleString()} /{" "}
              {sub.usage.tokenBudget == null ? "∞" : sub.usage.tokenBudget.toLocaleString()}
            </span>
          </div>
          <div className="progress" style={{ marginTop: 6 }}>
            <div style={{ width: `${sub.usage.usedPct}%` }} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>API Key</h2>
        {!sub.plan.hasKey && !apiKey && (
          <p className="muted" style={{ fontSize: 13 }}>
            No key issued yet — ask your admin to assign a plan, or regenerate below.
          </p>
        )}
        {apiKey && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <code className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{apiKey}</code>
            <button className="btn ghost small" onClick={copyKey}>{copied ? "Copied" : "Copy"}</button>
          </div>
        )}
        {keyMsg && <div className="alert ok" style={{ marginBottom: 8 }}>{keyMsg}</div>}
        <button className="btn small" onClick={regenerate}>Regenerate key</button>
      </section>

      {byokEnabled !== false && (
        <section className="card">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>BYOK Keys Manager</h2>
          {byokEnabled === null && (
            <p className="faint" style={{ fontSize: 12 }}>
              Gateway BYOK state unknown (gateway unreachable?) — keys are still stored locally.
            </p>
          )}
          <form onSubmit={addByok} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input
              className="input"
              style={{ maxWidth: 180 }}
              placeholder="provider id (e.g. glm)"
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
            />
            <input
              className="input mono"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="paste provider key"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn small" disabled={byokBusy}>{byokBusy ? "Adding…" : "Add key"}</button>
          </form>
          {byokMsg && <div className="alert ok" style={{ marginBottom: 8 }}>{byokMsg}</div>}
          {keys.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No BYOK keys yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Masked key</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="mono">{k.provider_id}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{k.masked_key}</td>
                    <td>{k.is_paused ? <span className="badge">paused</span> : <span className="badge">active</span>}</td>
                    <td className="faint" style={{ fontSize: 12 }}>{k.created_at}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn ghost small" onClick={() => togglePause(k.id, !k.is_paused)}>
                        {k.is_paused ? "Resume" : "Pause"}
                      </button>{" "}
                      <button className="btn ghost small" onClick={() => deleteKey(k.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="faint" style={{ fontSize: 12 }}>
            Send your key per-request as <span className="mono">x-upstream-key</span> (billed to your
            own provider account, 0 plan tokens deducted).
          </p>
        </section>
      )}

      <section className="card">
        <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Live Analytics</h2>
        <div style={{ display: "flex", gap: 24, marginBottom: 12, fontSize: 13 }} className="muted">
          <span>RPM limit: <b className="mono">{analytics?.rpmLimit ?? "—"}</b></span>
          <span>Tokens used: <b className="mono">{(analytics?.tokensUsed ?? 0).toLocaleString()}</b></span>
          {!analytics?.live && <span className="faint">(gateway offline — plan data only)</span>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {(analytics?.daily ?? []).map((d) => (
            <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                title={`${d.day}: ${d.tokens.toLocaleString()} tokens`}
                style={{
                  width: "100%",
                  height: `${Math.max(2, Math.round((d.tokens / maxDaily) * 96))}px`,
                  background: "var(--muted)",
                  borderRadius: 4,
                  opacity: d.tokens > 0 ? 1 : 0.25,
                }}
              />
              <span className="faint" style={{ fontSize: 10 }}>{d.day}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
