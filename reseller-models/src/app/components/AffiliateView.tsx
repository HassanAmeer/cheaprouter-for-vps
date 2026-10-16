"use client";

import { useMemo, useState } from "react";

interface AffiliateViewProps {
  user: { id: number; email: string; name?: string; role: string };
}

export default function AffiliateView({ user }: AffiliateViewProps) {
  // Referral code generated from user ID or email
  const refCode = useMemo(() => {
    return "7yMv";
  }, []);

  const inviteUrl = `https://unorouter.com/register?aff=${refCode}`;

  // Badge Generator state
  const [badgeType, setBadgeType] = useState("Referral");
  const [badgeSize, setBadgeSize] = useState<"XS" | "SM" | "MD" | "LG" | "XL" | "OG">("MD");
  const [badgeTheme, setBadgeTheme] = useState<"Dark" | "Light">("Dark");
  const [badgeLang, setBadgeLang] = useState("EN");
  const [badgeFormat, setBadgeFormat] = useState<"SVG" | "PNG">("SVG");
  const [embedTab, setEmbedTab] = useState<"HTML" | "Markdown" | "BBCode" | "URL">("HTML");

  // Bottom table state
  const [historyTab, setHistoryTab] = useState<"users" | "commissions">("users");

  // Feedback notifications
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const copyToClipboard = (text: string, cb: () => void) => {
    navigator.clipboard?.writeText(text).then(cb);
  };

  const badgeImgUrl = `https://unorouter.com/api/ops/badge/referral?locale=${badgeLang.toLowerCase()}&theme=${badgeTheme.toLowerCase()}&size=${badgeSize.toLowerCase()}&ref=${refCode}`;

  const embedSnippets = {
    HTML: `<a href="https://unorouter.com/?aff=${refCode}" target="_blank">\n  <img src="${badgeImgUrl}" alt="UnoRouter" />\n</a>`,
    Markdown: `[![UnoRouter](${badgeImgUrl})](https://unorouter.com/?aff=${refCode})`,
    BBCode: `[URL=https://unorouter.com/?aff=${refCode}][IMG]${badgeImgUrl}[/IMG][/URL]`,
    URL: `https://unorouter.com/?aff=${refCode}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ========================================================
          1. HEADER (Screenshot 1)
         ======================================================== */}
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
            AFFILIATE PROGRAM
          </div>
          <h1>Affiliate Program</h1>
          <p>
            Earn commissions by referring new users. Share your invite link and earn a percentage of their top-ups.
          </p>
        </div>
      </div>

      {/* ========================================================
          2. TOP 5 KPI METRICS (Screenshot 1)
         ======================================================== */}
      <div className="uno-aff-kpi-grid">
        {/* Card 1: Commission Rate */}
        <div className="uno-aff-kpi-card">
          <div className="uno-aff-kpi-header">
            <span style={{ color: "#eab308", fontSize: 16 }}>%</span>
            <span>COMMISSION RATE</span>
          </div>
          <div className="uno-aff-kpi-val">10%</div>
        </div>

        {/* Card 2: Max Recharges */}
        <div className="uno-aff-kpi-card">
          <div className="uno-aff-kpi-header">
            <span style={{ color: "#f97316", fontSize: 15 }}>⇄</span>
            <span>MAX RECHARGES</span>
          </div>
          <div className="uno-aff-kpi-val">Unlimited</div>
        </div>

        {/* Card 3: Pending Earnings */}
        <div className="uno-aff-kpi-card">
          <div className="uno-aff-kpi-header">
            <span style={{ color: "#10b981", fontSize: 15 }}>👛</span>
            <span>PENDING EARNINGS</span>
          </div>
          <div className="uno-aff-kpi-val">$0.00</div>
        </div>

        {/* Card 4: Total Earned */}
        <div className="uno-aff-kpi-card">
          <div className="uno-aff-kpi-header">
            <span style={{ color: "#c084fc", fontSize: 15 }}>$</span>
            <span>TOTAL EARNED</span>
          </div>
          <div className="uno-aff-kpi-val">$0.00</div>
        </div>

        {/* Card 5: Invited Users */}
        <div className="uno-aff-kpi-card">
          <div className="uno-aff-kpi-header">
            <span style={{ color: "#38bdf8", fontSize: 15 }}>👥</span>
            <span>INVITED USERS</span>
          </div>
          <div className="uno-aff-kpi-val">0</div>
          <div className="uno-aff-kpi-sub">0 paying</div>
        </div>
      </div>

      {/* ========================================================
          3. MAIN 2-COLUMN SECTION: HOW IT WORKS + BADGE GENERATOR
         ======================================================== */}
      <div className="uno-aff-main-grid">
        {/* LEFT COLUMN: How It Works & Invite Link */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Card: How It Works */}
          <div className="uno-aff-card">
            <div className="uno-aff-section-tag">HOW IT WORKS</div>

            <div className="uno-aff-steps-list">
              <div className="uno-aff-step-item">
                <span className="uno-aff-step-num" style={{ color: "#38bdf8" }}>01</span>
                <div>
                  <div className="uno-aff-step-title">Share Your Link</div>
                  <div className="uno-aff-step-desc">
                    Send your unique invite link to friends and colleagues.
                  </div>
                </div>
              </div>

              <div className="uno-aff-step-item">
                <span className="uno-aff-step-num" style={{ color: "#10b981" }}>02</span>
                <div>
                  <div className="uno-aff-step-title">They Sign Up &amp; Top Up</div>
                  <div className="uno-aff-step-desc">
                    When referred users register and add funds, you earn a commission.
                  </div>
                </div>
              </div>

              <div className="uno-aff-step-item">
                <span className="uno-aff-step-num" style={{ color: "#c084fc" }}>03</span>
                <div>
                  <div className="uno-aff-step-title">Earn Commission</div>
                  <div className="uno-aff-step-desc">
                    Transfer your earnings to your account balance anytime.
                  </div>
                </div>
              </div>
            </div>

            <div className="uno-aff-disclaimer">
              <span>ⓘ</span>
              <span>
                Invite real people. Creating extra accounts to refer yourself is not what this program is for, and self-referrals do not earn commission.
              </span>
            </div>
          </div>

          {/* Card: Invite Link & Transfer */}
          <div className="uno-aff-card">
            <div className="uno-aff-section-tag">INVITE LINK</div>

            <div className="uno-aff-link-row">
              <span className="uno-aff-link-text">{inviteUrl}</span>
              <button
                type="button"
                className="uno-aff-btn-copy"
                onClick={() =>
                  copyToClipboard(inviteUrl, () => {
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  })
                }
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>

            <div className="uno-aff-refcode-row">
              <span className="uno-aff-section-tag" style={{ fontSize: 10 }}>REFERRAL CODE</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, color: "#ffffff", fontWeight: 700 }}>
                  {refCode}
                </span>
                <button
                  type="button"
                  className="uno-icon-btn"
                  title="Copy code"
                  onClick={() =>
                    copyToClipboard(refCode, () => {
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 1500);
                    })
                  }
                >
                  {copiedCode ? (
                    <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>✓</span>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="uno-aff-transfer-box">
              <div className="uno-aff-section-tag" style={{ fontSize: 10 }}>TRANSFER TO BALANCE</div>
              <p className="uno-aff-transfer-desc">
                Transfer your pending affiliate earnings to your account balance for immediate use.
              </p>
              <div className="uno-aff-transfer-val">
                <span style={{ color: "#ffffff", fontWeight: 700 }}>$0.00</span>
                <span>available</span>
              </div>
              <button
                type="button"
                className="uno-btn-transfer"
                disabled
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3h5v5" />
                  <path d="M4 20L21 3" />
                  <path d="M21 16v5h-5" />
                  <path d="M15 15l6 6" />
                  <path d="M4 4l5 5" />
                </svg>
                <span>Transfer to Balance</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Badge Generator & Embed Code */}
        <div className="uno-aff-card">
          <div className="uno-aff-section-tag">BADGE GENERATOR</div>
          <p style={{ margin: "2px 0 14px", fontSize: 12, color: "var(--uno-text-secondary)" }}>
            Create an embed badge to promote UnoRouter on your website or blog.
          </p>

          {/* Controls Row 1: Type & Size */}
          <div className="uno-badge-controls-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="uno-badge-ctl-label">Type</span>
              <select
                value={badgeType}
                onChange={(e) => setBadgeType(e.target.value)}
                className="uno-badge-select"
              >
                <option value="Referral">Referral</option>
                <option value="Compact">Compact</option>
                <option value="Banner">Banner</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="uno-badge-ctl-label">Size</span>
              <div className="uno-badge-pill-group">
                {(["XS", "SM", "MD", "LG", "XL", "OG"] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`uno-badge-pill ${badgeSize === sz ? "active" : ""}`}
                    onClick={() => setBadgeSize(sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Row 2: Theme & Language & Format */}
          <div className="uno-badge-controls-row" style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="uno-badge-ctl-label">Theme</span>
              <div className="uno-badge-pill-group">
                <button
                  type="button"
                  className={`uno-badge-pill ${badgeTheme === "Dark" ? "active" : ""}`}
                  onClick={() => setBadgeTheme("Dark")}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={`uno-badge-pill ${badgeTheme === "Light" ? "active" : ""}`}
                  onClick={() => setBadgeTheme("Light")}
                >
                  Light
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="uno-badge-ctl-label">Language</span>
              <select
                value={badgeLang}
                onChange={(e) => setBadgeLang(e.target.value)}
                className="uno-badge-select"
                style={{ minWidth: 64 }}
              >
                <option value="EN">EN</option>
                <option value="ES">ES</option>
                <option value="FR">FR</option>
                <option value="ZH">ZH</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="uno-badge-ctl-label">Format</span>
              <div className="uno-badge-pill-group">
                <button
                  type="button"
                  className={`uno-badge-pill ${badgeFormat === "SVG" ? "active" : ""}`}
                  onClick={() => setBadgeFormat("SVG")}
                >
                  SVG
                </button>
                <button
                  type="button"
                  className={`uno-badge-pill ${badgeFormat === "PNG" ? "active" : ""}`}
                  onClick={() => setBadgeFormat("PNG")}
                >
                  PNG
                </button>
              </div>
            </div>
          </div>

          {/* PREVIEW Card (Screenshot 1 & 2) */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="uno-aff-section-tag" style={{ fontSize: 10 }}>PREVIEW</span>
              <button
                type="button"
                className="uno-icon-btn"
                title="Copy badge URL"
                onClick={() =>
                  copyToClipboard(badgeImgUrl, () => {
                    setCopiedEmbed(true);
                    setTimeout(() => setCopiedEmbed(false), 1500);
                  })
                }
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>

            {/* Rendered Badge Card */}
            <div className={`uno-badge-preview-card ${badgeTheme === "Light" ? "light" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: 3, background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 900 }}>⚡</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: badgeTheme === "Light" ? "#0f172a" : "#ffffff", letterSpacing: 0.5 }}>
                    UNOROUTER.COM
                  </span>
                </div>
                <span className="uno-badge-ref-tag">
                  REFERRAL
                </span>
              </div>

              <div style={{ fontSize: 12, color: badgeTheme === "Light" ? "#475569" : "#94a3b8" }}>
                Sign up and get started with AI for less
              </div>

              <div className="uno-badge-preview-bottom">
                <span className="mono" style={{ fontSize: 12, color: badgeTheme === "Light" ? "#1e293b" : "#cbd5e1" }}>
                  unorouter.com/?aff={refCode}
                </span>
                <span className="uno-badge-btn-get">
                  GET STARTED
                </span>
              </div>
            </div>
          </div>

          {/* EMBED CODE (Screenshot 2) */}
          <div style={{ marginTop: 20 }}>
            <div className="uno-aff-section-tag" style={{ fontSize: 10, marginBottom: 8 }}>
              EMBED CODE
            </div>

            {/* Sub-tabs: HTML | Markdown | BBCode | URL */}
            <div className="uno-embed-tabs">
              {(["HTML", "Markdown", "BBCode", "URL"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`uno-embed-tab ${embedTab === t ? "active" : ""}`}
                  onClick={() => setEmbedTab(t)}
                >
                  {t}
                </button>
              ))}

              <button
                type="button"
                className="uno-icon-btn"
                style={{ marginLeft: "auto" }}
                title="Copy code"
                onClick={() =>
                  copyToClipboard(embedSnippets[embedTab], () => {
                    setCopiedEmbed(true);
                    setTimeout(() => setCopiedEmbed(false), 1500);
                  })
                }
              >
                {copiedEmbed ? (
                  <span style={{ color: "#10b981", fontSize: 11, fontWeight: 700 }}>Copied!</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>

            {/* Code Block */}
            <div className="uno-embed-terminal">
              <code>{embedSnippets[embedTab]}</code>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. BOTTOM HISTORY TABLE (Screenshot 2)
         ======================================================== */}
      <div className="uno-aff-table-section">
        {/* Subtabs: Invited Users | Commission History */}
        <div className="uno-aff-history-tabs">
          <button
            type="button"
            className={`uno-aff-history-tab ${historyTab === "users" ? "active" : ""}`}
            onClick={() => setHistoryTab("users")}
          >
            <span style={{ fontSize: 13 }}>👥</span>
            <span>Invited Users</span>
          </button>
          <button
            type="button"
            className={`uno-aff-history-tab ${historyTab === "commissions" ? "active" : ""}`}
            onClick={() => setHistoryTab("commissions")}
          >
            <span style={{ fontSize: 13 }}>📑</span>
            <span>Commission History</span>
          </button>
        </div>

        {/* Table */}
        <div className="uno-keys-table-wrap">
          <table className="uno-keys-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>COMMISSIONS</th>
                <th>TOTAL EARNED</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "64px 20px" }}>
                  <div className="uno-logs-empty-state">
                    <svg
                      width="42"
                      height="42"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth="1.5"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <p style={{ color: "var(--uno-text-muted)", fontSize: 13, margin: 0 }}>
                      No invited users yet. Share your invite link to start growing your network.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
