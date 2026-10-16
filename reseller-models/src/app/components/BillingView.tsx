"use client";

import { useState } from "react";

interface BillingViewProps {
  user: { id: number; email: string; name?: string; role: string };
  sub?: {
    plan?: { name: string; token_budget: number | null; rpm_limit: number | null };
    usage?: { tokensUsed: number; tokenBudget: number | null; usedPct: number };
    expiryLabel?: string;
  } | null;
}

const TOPUP_PRESETS = [
  { amount: 1, payment: "1.00" },
  { amount: 5, payment: "5.00" },
  { amount: 10, payment: "10.00" },
  { amount: 20, payment: "20.00" },
  { amount: 50, payment: "50.00" },
  { amount: 100, payment: "100.00" },
  { amount: 200, payment: "200.00" },
  { amount: 500, payment: "500.00" },
  { amount: 1000, payment: "1000.00" },
  { amount: 2000, payment: "2000.00" },
  { amount: 5000, payment: "5000.00" },
  { amount: 10000, payment: "10000.00" },
];

export default function BillingView({ user, sub }: BillingViewProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "topup" | "sub">("buy");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "crypto">("card");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("1");
  const [redeemCode, setRedeemCode] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const displayName = user.name || user.email.split("@")[0] || "Hasan ameer";
  const usedTokens = sub?.usage?.tokensUsed ?? 0;
  const requestsCount = Math.max(14, Math.floor(usedTokens / 250));

  const handlePay = (amt: number | string) => {
    setFeedbackMsg(`Checkout simulation: $${amt} via ${paymentMethod.toUpperCase()}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setFeedbackMsg(`Code "${redeemCode}" verified. $10.00 added to account balance.`);
    setRedeemCode("");
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ========================================================
          1. TOP BALANCE & ACCOUNT BANNER (Screenshot 1)
         ======================================================== */}
      <div className="uno-billing-banner">
        <div className="uno-billing-balance-left">
          <div className="uno-billing-section-tag">CURRENT BALANCE</div>
          <div className="uno-billing-balance-amount">$0.00</div>
          <div className="uno-billing-balance-sub">
            Low balance, top up to keep requests running
          </div>
        </div>

        <div className="uno-billing-account-right">
          <div className="uno-billing-section-tag">ACCOUNT</div>
          <div className="uno-billing-account-name">{displayName}</div>
        </div>
      </div>

      {/* ========================================================
          2. KPI ROW: USED QUOTA & REQUESTS (Screenshot 1)
         ======================================================== */}
      <div className="uno-billing-kpi-row">
        {/* Card 1: Used Quota */}
        <div className="uno-billing-kpi-card">
          <div className="uno-billing-kpi-icon-wrap" style={{ color: "#c084fc" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
              <polyline points="17 18 23 18 23 12" />
            </svg>
          </div>
          <div>
            <div className="uno-billing-kpi-label">USED QUOTA</div>
            <div className="uno-billing-kpi-val">$0.00</div>
          </div>
        </div>

        {/* Card 2: Requests */}
        <div className="uno-billing-kpi-card">
          <div className="uno-billing-kpi-icon-wrap" style={{ color: "#38bdf8" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div>
            <div className="uno-billing-kpi-label">REQUESTS</div>
            <div className="uno-billing-kpi-val">{requestsCount}</div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. SUB-TABS: Buy | Top-up history | Subscription history
         ======================================================== */}
      <div className="uno-billing-subtabs">
        <button
          type="button"
          className={`uno-billing-subtab ${activeTab === "buy" ? "active" : ""}`}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={`uno-billing-subtab ${activeTab === "topup" ? "active" : ""}`}
          onClick={() => setActiveTab("topup")}
        >
          Top-up history
        </button>
        <button
          type="button"
          className={`uno-billing-subtab ${activeTab === "sub" ? "active" : ""}`}
          onClick={() => setActiveTab("sub")}
        >
          Subscription history
        </button>
      </div>

      {feedbackMsg && (
        <div style={{ padding: "12px 16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 6, color: "#10b981", fontSize: 13 }}>
          {feedbackMsg}
        </div>
      )}

      {/* ========================================================
          4. SUBSCRIPTION PLANS SECTION (Screenshot 1)
         ======================================================== */}
      <div className="uno-billing-section-box">
        {/* Section Header */}
        <div className="uno-billing-section-header">
          <span className="uno-billing-section-tag">SUBSCRIPTION PLANS</span>
          <span className="uno-billing-muted-note">Recurring, resets weekly</span>
        </div>

        {/* Current Plan Bar */}
        <div className="uno-billing-current-plan-bar">
          <div>
            <div className="uno-billing-section-tag" style={{ fontSize: 10 }}>CURRENT PLAN</div>
            <div className="uno-billing-plan-title">
              {sub?.plan?.name ? `${sub.plan.name} Subscription` : "No active subscription"}
            </div>
          </div>

          <div className="uno-billing-plan-actions">
            <select className="uno-billing-select">
              <option value="sub-first">Subscription first</option>
              <option value="balance-first">Balance first</option>
            </select>

            <button type="button" className="uno-billing-btn-manage">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Manage billing</span>
            </button>

            <button type="button" className="uno-icon-btn" title="Refresh">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* 3 Subscription Cards */}
        <div className="uno-billing-cards-grid">
          {/* Card 1: 20$ 1 Month */}
          <div className="uno-sub-card">
            <div className="uno-sub-card-title">20$ 1 Month</div>
            <div className="uno-sub-card-price">
              <span className="curr">$</span>
              <span className="num">20</span>
            </div>
            <ul className="uno-sub-card-features">
              <li><span className="dot">•</span> Validity: 1 Month</li>
              <li><span className="dot">•</span> Quota Reset: Weekly</li>
              <li><span className="dot">•</span> Total quota: $10.00 · week</li>
              <li><span className="dot">•</span> Est. total quota: ~$40.00</li>
              <li><span className="dot">•</span> 50% less waiting on free models</li>
            </ul>
            <button
              type="button"
              className="uno-btn-sub-primary"
              onClick={() => handlePay(20)}
            >
              Subscribe now
            </button>
          </div>

          {/* Card 2: 50$ 1 Month (Recommended) */}
          <div className="uno-sub-card uno-sub-card-rec">
            <div className="uno-sub-card-header-rec">
              <div className="uno-sub-card-title">50$ 1 Month</div>
              <span className="uno-badge-rec">
                ★ Recommended
              </span>
            </div>
            <div className="uno-sub-card-price">
              <span className="curr">$</span>
              <span className="num">50</span>
            </div>
            <ul className="uno-sub-card-features">
              <li><span className="dot">•</span> Validity: 1 Month</li>
              <li><span className="dot">•</span> Quota Reset: Weekly</li>
              <li><span className="dot">•</span> Total quota: $25.00 · week</li>
              <li><span className="dot">•</span> Est. total quota: ~$100.00</li>
              <li><span className="dot">•</span> 75% less waiting on free models</li>
            </ul>
            <button
              type="button"
              className="uno-btn-sub-outline"
              onClick={() => handlePay(50)}
            >
              Subscribe now
            </button>
          </div>

          {/* Card 3: 100$ 1 Month */}
          <div className="uno-sub-card">
            <div className="uno-sub-card-title">100$ 1 Month</div>
            <div className="uno-sub-card-price">
              <span className="curr">$</span>
              <span className="num">100</span>
            </div>
            <ul className="uno-sub-card-features">
              <li><span className="dot">•</span> Validity: 1 Month</li>
              <li><span className="dot">•</span> Quota Reset: Weekly</li>
              <li><span className="dot">•</span> Total quota: $50.00 · week</li>
              <li><span className="dot">•</span> Est. total quota: ~$200.00</li>
              <li><span className="dot">•</span> No waiting between free model requests</li>
            </ul>
            <button
              type="button"
              className="uno-btn-sub-outline"
              onClick={() => handlePay(100)}
            >
              Subscribe now
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          5. QUOTA TOP-UP SECTION (Screenshot 2)
         ======================================================== */}
      <div className="uno-billing-section-box">
        {/* Header Row */}
        <div className="uno-billing-section-header" style={{ alignItems: "center" }}>
          <div>
            <span className="uno-billing-section-tag">QUOTA TOP-UP</span>
            <span className="uno-billing-muted-note" style={{ marginLeft: 8 }}>One-time, never expires</span>
          </div>

          {/* Payment Method Tabs */}
          <div className="uno-payment-method-tabs">
            <button
              type="button"
              className={`uno-payment-tab ${paymentMethod === "card" ? "active" : ""}`}
              onClick={() => setPaymentMethod("card")}
            >
              Card / Google &amp; Apple Pay / Alipay
            </button>
            <button
              type="button"
              className={`uno-payment-tab ${paymentMethod === "paypal" ? "active" : ""}`}
              onClick={() => setPaymentMethod("paypal")}
            >
              PayPal
            </button>
            <button
              type="button"
              className={`uno-payment-tab ${paymentMethod === "crypto" ? "active" : ""}`}
              onClick={() => setPaymentMethod("crypto")}
            >
              Crypto
            </button>
          </div>
        </div>

        {/* 12 Presets Grid (Screenshot 2) */}
        <div className="uno-topup-grid">
          {TOPUP_PRESETS.map((p) => {
            const isSelected = selectedPreset === p.amount;
            return (
              <button
                key={p.amount}
                type="button"
                className={`uno-topup-card ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  setSelectedPreset(p.amount);
                  setCustomAmount(String(p.amount));
                }}
              >
                <div className="uno-topup-amt">${p.amount}</div>
                <div className="uno-topup-actual">Actual payment ${p.payment}</div>
              </button>
            );
          })}
        </div>

        {/* Custom Amount Row */}
        <div className="uno-custom-amount-row">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 300 }}>
            <div className="uno-billing-section-tag" style={{ fontSize: 10 }}>CUSTOM AMOUNT</div>
            <input
              type="number"
              min="1"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedPreset(null);
              }}
              className="uno-custom-input"
            />
          </div>

          <div style={{ flex: 1, paddingLeft: 12 }}>
            <div className="uno-topup-actual" style={{ fontSize: 12 }}>
              Actual payment ${Number(customAmount || 0).toFixed(2)}
            </div>
          </div>

          <button
            type="button"
            className="uno-btn-pay"
            onClick={() => handlePay(customAmount)}
          >
            Pay
          </button>
        </div>
      </div>

      {/* ========================================================
          6. REDEEM A CODE SECTION (Screenshot 2)
         ======================================================== */}
      <div className="uno-billing-section-box">
        <div className="uno-billing-section-header">
          <span className="uno-billing-section-tag">REDEEM A CODE</span>
          <span className="uno-billing-muted-note">Gift cards and redemption codes</span>
        </div>

        <form onSubmit={handleRedeem} className="uno-redeem-row">
          <input
            type="text"
            placeholder="Enter your gift card or redemption code"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            className="uno-redeem-input"
          />
          <button type="submit" className="uno-btn-redeem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Redeem</span>
          </button>
        </form>
      </div>

      {/* ========================================================
          7. NEED HELP? FOOTER (Screenshot 2)
         ======================================================== */}
      <div className="uno-billing-help">
        <div className="uno-billing-help-tag">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>NEED HELP?</span>
        </div>
        <p className="uno-billing-help-text">
          Questions about billing or your account? Email us at support@unorouter.com and we will respond within one business day.
        </p>
        <a href="mailto:support@unorouter.com" className="uno-billing-help-link">
          support@unorouter.com
        </a>
      </div>
    </div>
  );
}
