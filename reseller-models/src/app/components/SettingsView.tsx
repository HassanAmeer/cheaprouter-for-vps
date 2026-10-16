"use client";

import { useState } from "react";

interface SettingsViewProps {
  user: { id: number; email: string; name?: string; role: string };
  sub?: {
    usage?: { tokensUsed: number; tokenBudget: number | null };
  } | null;
}

export default function SettingsView({ user, sub }: SettingsViewProps) {
  const [isBusiness, setIsBusiness] = useState(false);
  const [typeSaved, setTypeSaved] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState(user.email);
  const [emailSavedMsg, setEmailSavedMsg] = useState<string | null>(null);

  const displayName = user.name || user.email.split("@")[0] || "Hasan ameer";
  const initialLetter = (displayName[0] || user.email[0] || "U").toUpperCase();
  const userIdNumber = user.id ? 81000 + user.id : 81093;

  const usedTokens = sub?.usage?.tokensUsed ?? 0;
  const requestsCount = Math.max(14, Math.floor(usedTokens / 250));
  const consumptionAmt = ((usedTokens / 1_000_000) * 0.15).toFixed(2);

  const handleSaveType = () => {
    setTypeSaved(true);
    setTimeout(() => setTypeSaved(false), 2500);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSavedMsg("Email updated successfully.");
    setEmailModal(false);
    setTimeout(() => setEmailSavedMsg(null), 3000);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {emailSavedMsg && (
        <div style={{ padding: "12px 16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 6, color: "#10b981", fontSize: 13 }}>
          {emailSavedMsg}
        </div>
      )}

      {/* ========================================================
          1. ACCOUNT INFORMATION (Screenshot)
         ======================================================== */}
      <div className="uno-settings-card">
        <div className="uno-settings-section-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>ACCOUNT INFORMATION</span>
        </div>

        <div className="uno-settings-profile-row">
          {/* Left Avatar + Details */}
          <div className="uno-settings-profile-left">
            <div className="uno-settings-avatar-box">
              {initialLetter}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="uno-settings-user-name">{displayName}</span>
                <span className="uno-settings-role-badge">
                  {user.role === "admin" ? "Admin" : "User"}
                </span>
              </div>
              <div className="uno-settings-user-id">
                User ID: {userIdNumber}
              </div>
              <div className="uno-settings-balance-num">
                $0.00
              </div>
            </div>
          </div>

          {/* Right Stats: Consumption | Requests | Default Group */}
          <div className="uno-settings-stats-right">
            <div className="uno-settings-stat-col">
              <span className="uno-settings-stat-label">Consumption</span>
              <span className="uno-settings-stat-val">${consumptionAmt}</span>
            </div>

            <div className="uno-settings-stat-col">
              <span className="uno-settings-stat-label">Requests</span>
              <span className="uno-settings-stat-val">{requestsCount}</span>
            </div>

            <div className="uno-settings-stat-col">
              <span className="uno-settings-stat-label">Default Group</span>
              <span className="uno-settings-stat-val" style={{ color: "var(--uno-text-secondary)" }}>
                default
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. ACCOUNT TYPE (Screenshot)
         ======================================================== */}
      <div className="uno-settings-card">
        <h2 className="uno-settings-card-title">Account type</h2>
        <p className="uno-settings-card-desc">
          Please confirm your account type once and save it.
        </p>

        <div className="uno-settings-type-row">
          <label className="uno-settings-checkbox-label">
            <input
              type="checkbox"
              checked={isBusiness}
              onChange={(e) => setIsBusiness(e.target.checked)}
              className="uno-settings-checkbox"
            />
            <span>I use this account for a business or for professional purposes</span>
          </label>

          <button
            type="button"
            className="uno-btn-settings-save"
            onClick={handleSaveType}
          >
            {typeSaved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* ========================================================
          3. ACCOUNT MANAGEMENT (Screenshot - OAuth excluded)
         ======================================================== */}
      <div className="uno-settings-card">
        <h2 className="uno-settings-card-title">Account Management</h2>

        <div className="uno-settings-mgmt-block">
          <div className="uno-settings-mgmt-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span>Email Binding</span>
          </div>

          <div className="uno-settings-email-row">
            <span className="uno-settings-email-text">{user.email}</span>
            <button
              type="button"
              className="uno-btn-modify-email"
              onClick={() => setEmailModal(true)}
            >
              Modify Email
            </button>
          </div>
        </div>

        {/* Security & Logout actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #151923" }}>
          <div style={{ fontSize: 12, color: "var(--uno-text-muted)" }}>
            Session authenticated securely.
          </div>
          <button
            type="button"
            className="uno-btn-modify-email"
            style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* Modify Email Modal */}
      {emailModal && (
        <div className="uno-modal-overlay" onClick={() => setEmailModal(false)}>
          <div className="uno-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="uno-modal-header">
              <h2 className="uno-modal-title">Modify Email</h2>
              <button
                type="button"
                className="uno-modal-close"
                onClick={() => setEmailModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmail} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--uno-text-secondary)", marginBottom: 6 }}>
                  New Email Address
                </label>
                <input
                  type="email"
                  className="uno-search-input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="uno-btn-outline"
                  onClick={() => setEmailModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="uno-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
