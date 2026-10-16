"use client";

import { useState } from "react";
import Link from "next/link";

const PRESET_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export default function PricingSection() {
  const [activePayment, setActivePayment] = useState<"card" | "paypal" | "crypto">("card");
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>("1");

  const handleSelectAmount = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount(String(amt));
  };

  const handleCustomChange = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    setCustomAmount(num);
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed)) {
      setSelectedAmount(parsed);
    }
  };

  return (
    <section id="pricing" className="uno-section" style={{ borderTop: "1px solid var(--uno-border)" }}>
      <div className="uno-container">
        <div className="uno-pricing-page-wrap">
          {/* Top Payment Methods Tabs */}
          <div style={{ textAlign: "center" }}>
            <div className="uno-payment-tabs">
              <button
                type="button"
                className={`uno-payment-tab ${activePayment === "card" ? "active" : ""}`}
                onClick={() => setActivePayment("card")}
              >
                Card / Google &amp; Apple Pay / Alipay
              </button>
              <button
                type="button"
                className={`uno-payment-tab ${activePayment === "paypal" ? "active" : ""}`}
                onClick={() => setActivePayment("paypal")}
              >
                PayPal
              </button>
              <button
                type="button"
                className={`uno-payment-tab ${activePayment === "crypto" ? "active" : ""}`}
                onClick={() => setActivePayment("crypto")}
              >
                Crypto
              </button>
            </div>
          </div>

          {/* Preset Top-Up Amounts Grid */}
          <div className="uno-preset-grid">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`uno-preset-btn ${selectedAmount === amt ? "active" : ""}`}
                onClick={() => handleSelectAmount(amt)}
              >
                ${amt}
              </button>
            ))}
          </div>

          {/* Custom Pay Row */}
          <div className="uno-custom-pay-row">
            <div className="uno-custom-input-box">
              <span>$</span>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="1"
              />
            </div>
            <Link href="/dashboard" className="uno-pay-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Pay
            </Link>
          </div>

          {/* Pay As You Go Note */}
          <p className="uno-paygo-note">
            PAY AS YOU GO CREDIT NEVER EXPIRES.
          </p>

          {/* Ask on Discord Link */}
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noopener noreferrer"
            className="uno-discord-custom-link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>Need a custom plan? Ask on Discord</span>
          </a>

          {/* Middle Callout / Separator */}
          <div className="uno-subscribe-callout">
            <h3>Using it regularly? Subscribe and get more credit each month.</h3>
            <p>
              Top up when you want flexibility. Subscribe once your usage is predictable and get extra credit on top of what you pay.
            </p>
            <div className="uno-chevron-down">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          {/* Subscription 3 Cards Grid */}
          <div className="uno-sub-cards-grid">
            {/* 1. STARTER */}
            <div className="uno-sub-card">
              <div className="uno-sub-tier-name">STARTER</div>
              <div className="uno-sub-price-row">
                <span className="uno-sub-price-val">$20</span>
                <span className="uno-sub-price-mo">/ mo</span>
              </div>

              {/* Green Highlight Box */}
              <div className="uno-credit-highlight-box">
                <div className="uno-credit-highlight-title">$40 API CREDIT / MONTH</div>
              </div>

              <div className="uno-sub-card-desc">
                Pay $20/mo, get $40 in API credit. Use it on any model.
                <br />
                Delivered $10 each week.
                <span className="uno-credit-warning">
                  Unused credit does not carry over to the next week.
                </span>
              </div>

              <div className="uno-sub-card-divider" />

              <ul className="uno-sub-bullet-list">
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>2x the API credit you pay for</span>
                </li>
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>50% less waiting on free models</span>
                  <span className="info-icon" title="High priority routing on queue">ⓘ</span>
                </li>
              </ul>

              <Link href="/register" className="uno-sub-btn outline">
                SUBSCRIBE
              </Link>
            </div>

            {/* 2. PRO (BEST VALUE / POPULAR) */}
            <div className="uno-sub-card best-value">
              <div className="uno-card-top-tag">BEST VALUE</div>
              <div className="uno-card-border-badge">POPULAR</div>

              <div className="uno-sub-tier-name">PRO</div>
              <div className="uno-sub-price-row">
                <span className="uno-sub-price-val">$50</span>
                <span className="uno-sub-price-mo">/ mo</span>
              </div>

              {/* Green Highlight Box */}
              <div className="uno-credit-highlight-box">
                <div className="uno-credit-highlight-title">$100 API CREDIT / MONTH</div>
              </div>

              <div className="uno-sub-card-desc">
                Pay $50/mo, get $100 in API credit. Use it on any model.
                <br />
                Delivered $25 each week.
                <span className="uno-credit-warning">
                  Unused credit does not carry over to the next week.
                </span>
              </div>

              <div className="uno-sub-card-divider" />

              <ul className="uno-sub-bullet-list">
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>2x the API credit you pay for</span>
                </li>
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>75% less waiting on free models</span>
                  <span className="info-icon" title="Express routing lane">ⓘ</span>
                </li>
              </ul>

              <Link href="/register" className="uno-sub-btn solid">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                SUBSCRIBE
              </Link>
            </div>

            {/* 3. SCALE */}
            <div className="uno-sub-card">
              <div className="uno-sub-tier-name">SCALE</div>
              <div className="uno-sub-price-row">
                <span className="uno-sub-price-val">$100</span>
                <span className="uno-sub-price-mo">/ mo</span>
              </div>

              {/* Green Highlight Box */}
              <div className="uno-credit-highlight-box">
                <div className="uno-credit-highlight-title">$200 API CREDIT / MONTH</div>
              </div>

              <div className="uno-sub-card-desc">
                Pay $100/mo, get $200 in API credit. Use it on any model.
                <br />
                Delivered $50 each week.
                <span className="uno-credit-warning">
                  Unused credit does not carry over to the next week.
                </span>
              </div>

              <div className="uno-sub-card-divider" />

              <ul className="uno-sub-bullet-list">
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>2x the API credit you pay for</span>
                </li>
                <li className="uno-sub-bullet-item">
                  <span className="check">✓</span>
                  <span>No waiting between free model requests</span>
                  <span className="info-icon" title="Zero rate-limiting delay">ⓘ</span>
                </li>
              </ul>

              <Link href="/register" className="uno-sub-btn outline">
                SUBSCRIBE
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
