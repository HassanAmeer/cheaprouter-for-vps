"use client";

import { useState, useEffect } from "react";

interface ApiKeyItem {
  id: string;
  name: string;
  status: "Enabled" | "Disabled" | "Revoked";
  quota: string;
  group: string;
  key: string;
  fullKey?: string;
  models: string;
  created: string;
  expires: string;
}

const DEFAULT_SAMPLE_KEYS: ApiKeyItem[] = [
  {
    id: "1",
    name: "api1",
    status: "Enabled",
    quota: "Unlimited",
    group: "auto",
    key: "sk-UWVB**********tnuW",
    fullKey: "sk-UWVB9821487219487192847198247192847tnuW",
    models: "All Models",
    created: "Sep 24, 2026",
    expires: "Never",
  },
];

interface ApiKeysViewProps {
  userKey?: string | null;
  onRegenerateKey?: () => Promise<void>;
}

export default function ApiKeysView({ userKey, onRegenerateKey }: ApiKeysViewProps) {
  const [keysList, setKeysList] = useState<ApiKeyItem[]>(() => {
    if (userKey) {
      const prefix = userKey.slice(0, 7);
      const suffix = userKey.slice(-4);
      return [
        {
          id: "active",
          name: "api1",
          status: "Enabled",
          quota: "Unlimited",
          group: "auto",
          key: `${prefix}**********${suffix}`,
          fullKey: userKey,
          models: "All Models",
          created: "Sep 24, 2026",
          expires: "Never",
        },
      ];
    }
    return DEFAULT_SAMPLE_KEYS;
  });

  useEffect(() => {
    if (userKey) {
      const prefix = userKey.slice(0, 7);
      const suffix = userKey.slice(-4);
      setKeysList([
        {
          id: "active",
          name: "api1",
          status: "Enabled",
          quota: "Unlimited",
          group: "auto",
          key: `${prefix}**********${suffix}`,
          fullKey: userKey,
          models: "All Models",
          created: "Sep 24, 2026",
          expires: "Never",
        },
      ]);
    }
  }, [userKey]);

  const [search, setSearch] = useState("");
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [endpointCopied, setEndpointCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);

  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("api2");
  const [newKeyQuota, setNewKeyQuota] = useState("Unlimited");
  const [creating, setCreating] = useState(false);
  const [createdFullKey, setCreatedFullKey] = useState<string | null>(null);

  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/v1/chat/completions`
    : (process.env.NEXT_PUBLIC_CHEAPROUTE_API_URL ? `${process.env.NEXT_PUBLIC_CHEAPROUTE_API_URL}/chat/completions` : "http://localhost:20128/v1/chat/completions");

  const curlCommand = `curl ${endpointUrl} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'`;

  const copyToClipboard = (text: string, onDone: () => void) => {
    navigator.clipboard?.writeText(text).then(onDone);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (onRegenerateKey) {
        await onRegenerateKey();
      }
      const randomKey = `sk-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 8)}`;
      const prefix = randomKey.slice(0, 7);
      const suffix = randomKey.slice(-4);
      const newEntry: ApiKeyItem = {
        id: String(Date.now()),
        name: newKeyName || `api${keysList.length + 1}`,
        status: "Enabled",
        quota: newKeyQuota,
        group: "auto",
        key: `${prefix}**********${suffix}`,
        fullKey: randomKey,
        models: "All Models",
        created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        expires: "Never",
      };
      setKeysList((prev) => [newEntry, ...prev]);
      setCreatedFullKey(randomKey);
    } finally {
      setCreating(false);
    }
  };

  const filteredKeys = keysList.filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.key.toLowerCase().includes(search.toLowerCase()) ||
    k.group.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header Row (Screenshot 4) */}
      <div className="uno-keys-header-row">
        <div className="uno-keys-title-group">
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#10b981", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
            API KEYS
          </div>
          <h1>API Keys</h1>
          <p>Create and manage API keys for accessing AI models.</p>
        </div>

        <button
          type="button"
          className="uno-btn-create-key"
          onClick={() => {
            setCreatedFullKey(null);
            setCreateModalOpen(true);
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 800 }}>+</span>
          <span>Create Key</span>
        </button>
      </div>

      {/* 1. API Endpoint Card (Screenshot 4) */}
      <div className="uno-endpoint-card">
        <div className="uno-endpoint-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>API ENDPOINT</span>
        </div>

        <div className="uno-endpoint-box">
          <span className="uno-endpoint-url">{endpointUrl}</span>
          <button
            type="button"
            className="uno-icon-btn"
            title="Copy Endpoint"
            onClick={() => copyToClipboard(endpointUrl, () => {
              setEndpointCopied(true);
              setTimeout(() => setEndpointCopied(false), 1500);
            })}
          >
            {endpointCopied ? (
              <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>Copied!</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        <p className="uno-endpoint-desc">
          OpenAI-compatible endpoint. Use this URL as the base when configuring an API client.
        </p>
      </div>

      {/* 2. Quick Start (cURL) Card (Screenshot 4) */}
      <div className="uno-curl-card">
        <div className="uno-curl-header">
          <div className="uno-endpoint-label">
            <span>QUICK START (CURL)</span>
          </div>
          <button
            type="button"
            className="uno-icon-btn"
            title="Copy cURL Command"
            onClick={() => copyToClipboard(curlCommand, () => {
              setCurlCopied(true);
              setTimeout(() => setCurlCopied(false), 1500);
            })}
          >
            {curlCopied ? (
              <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>Copied!</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>

        <div className="uno-curl-terminal">
          <span className="cmd">curl</span> https://api.unorouter.com/v1/chat/completions \<br />
          {"  "}<span className="flag">-H</span> <span className="str">&quot;Authorization: Bearer YOUR_API_KEY&quot;</span> \<br />
          {"  "}<span className="flag">-H</span> <span className="str">&quot;Content-Type: application/json&quot;</span> \<br />
          {"  "}<span className="flag">-d</span> <span className="str">&apos;&#123;</span><br />
          {"    "}<span className="key">&quot;model&quot;</span>: <span className="str">&quot;claude-opus-4-5-thinking&quot;</span>,<br />
          {"    "}<span className="key">&quot;messages&quot;</span>: [&#123;<span className="key">&quot;role&quot;</span>: <span className="str">&quot;user&quot;</span>, <span className="key">&quot;content&quot;</span>: <span className="str">&quot;Hello!&quot;</span>&#125;],<br />
          {"    "}<span className="key">&quot;stream&quot;</span>: <span style={{ color: "#f59e0b" }}>true</span><br />
          {"  "}<span className="str">&#125;&apos;</span>
        </div>
      </div>

      {/* 3. Search and View Controls (Screenshot 4) */}
      <div className="uno-keys-toolbar">
        <div className="uno-keys-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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

      {/* 4. API Keys Table (Screenshot 4) */}
      <div className="uno-keys-table-wrap">
        <table className="uno-keys-table">
          <thead>
            <tr>
              <th>NAME</th>
              <th>STATUS</th>
              <th>QUOTA</th>
              <th>GROUP</th>
              <th>KEY</th>
              <th>MODELS</th>
              <th>CREATED</th>
              <th>EXPIRES</th>
              <th style={{ textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeys.map((item) => {
              const isRevealed = revealedIds[item.id];
              const displayKey = isRevealed && item.fullKey ? item.fullKey : item.key;
              return (
                <tr key={item.id}>
                  {/* Name */}
                  <td style={{ fontWeight: 700, color: "#ffffff" }}>
                    {item.name}
                  </td>

                  {/* Status */}
                  <td>
                    <span className="uno-badge-enabled">
                      {item.status}
                    </span>
                  </td>

                  {/* Quota */}
                  <td>
                    <span style={{ color: "var(--uno-text-secondary)" }}>
                      {item.quota}
                    </span>
                  </td>

                  {/* Group */}
                  <td>
                    <span style={{ color: "var(--uno-text-muted)", fontFamily: "var(--uno-font-mono)" }}>
                      {item.group}
                    </span>
                  </td>

                  {/* Key (with reveal eye and copy button) */}
                  <td>
                    <div className="uno-key-masked-cell">
                      <span className="mono" style={{ fontSize: 12, color: "#ffffff" }}>
                        {displayKey}
                      </span>
                      <button
                        type="button"
                        className="uno-icon-action-btn"
                        onClick={() => toggleReveal(item.id)}
                        title={isRevealed ? "Hide key" : "Reveal key"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {isRevealed ? (
                            <>
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          ) : (
                            <>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </>
                          )}
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="uno-icon-action-btn"
                        onClick={() =>
                          copyToClipboard(item.fullKey || item.key, () => {
                            setCopiedId(item.id);
                            setTimeout(() => setCopiedId(null), 1500);
                          })
                        }
                        title="Copy key"
                      >
                        {copiedId === item.id ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Models */}
                  <td>
                    <span style={{ color: "var(--uno-text-secondary)" }}>
                      {item.models}
                    </span>
                  </td>

                  {/* Created */}
                  <td>
                    <span style={{ color: "var(--uno-text-muted)", fontSize: 12 }}>
                      {item.created}
                    </span>
                  </td>

                  {/* Expires */}
                  <td>
                    <span style={{ color: "var(--uno-text-muted)", fontSize: 12 }}>
                      {item.expires}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="uno-icon-btn"
                      title="Key options"
                      onClick={() => {
                        if (confirm(`Revoke and regenerate key for ${item.name}?`)) {
                          if (onRegenerateKey) onRegenerateKey();
                        }
                      }}
                    >
                      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>...</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredKeys.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--uno-text-muted)" }}>
                  No API keys found matching &quot;{search}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Key Modal */}
      {createModalOpen && (
        <div className="uno-modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="uno-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="uno-modal-header">
              <h2 className="uno-modal-title">Create New API Key</h2>
              <button
                type="button"
                className="uno-modal-close"
                onClick={() => setCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {createdFullKey ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ padding: "12px 14px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 6, color: "#10b981", fontSize: 13 }}>
                  Key successfully created! Please save it now; you will not be able to see it again.
                </div>
                <div className="uno-endpoint-box">
                  <span className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
                    {createdFullKey}
                  </span>
                  <button
                    type="button"
                    className="uno-icon-btn"
                    onClick={() => copyToClipboard(createdFullKey, () => {
                      alert("API Key copied to clipboard!");
                    })}
                  >
                    Copy
                  </button>
                </div>
                <button
                  type="button"
                  className="uno-btn-primary"
                  style={{ alignSelf: "flex-end" }}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--uno-text-secondary)", marginBottom: 6 }}>
                    Key Name
                  </label>
                  <input
                    type="text"
                    className="uno-search-input"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. production-backend, cursor-agent"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--uno-text-secondary)", marginBottom: 6 }}>
                    Quota Limit
                  </label>
                  <select
                    className="uno-search-input"
                    value={newKeyQuota}
                    onChange={(e) => setNewKeyQuota(e.target.value)}
                    style={{ background: "#0e1117" }}
                  >
                    <option value="Unlimited">Unlimited (Plan Default)</option>
                    <option value="10M Tokens">10M Tokens</option>
                    <option value="50M Tokens">50M Tokens</option>
                    <option value="100M Tokens">100M Tokens</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="uno-btn-outline"
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="uno-btn-primary"
                    disabled={creating}
                  >
                    {creating ? "Creating…" : "Create Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
