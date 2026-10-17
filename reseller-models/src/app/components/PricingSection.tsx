"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export interface Plan {
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
}

const PRESET_AMOUNTS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface PricingSectionProps {
  initialPlans?: Plan[];
  initialCurrencySymbol?: string;
  initialDiscordUrl?: string;
}

export default function PricingSection({
  initialPlans,
  initialCurrencySymbol,
  initialDiscordUrl,
}: PricingSectionProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans || []);
  const [currencySymbol, setCurrencySymbol] = useState(initialCurrencySymbol || "$");
  const [discordUrl, setDiscordUrl] = useState(initialDiscordUrl || "https://discord.gg");
  const [activePayment, setActivePayment] = useState<"card" | "paypal" | "crypto">("card");
  const [selectedAmount, setSelectedAmount] = useState<number>(1);
  const [customAmount, setCustomAmount] = useState<string>("1");

  useEffect(() => {
    if (!initialPlans || initialPlans.length === 0) {
      fetch("/api/plans")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data?.plans)) setPlans(data.plans);
        })
        .catch(() => {});
    }

    if (!initialCurrencySymbol || !initialDiscordUrl) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((s) => {
          if (s.currency_symbol) setCurrencySymbol(s.currency_symbol);
          if (s.discord_url) setDiscordUrl(s.discord_url);
        })
        .catch(() => {});
    }
  }, [initialPlans, initialCurrencySymbol, initialDiscordUrl]);

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
                {currencySymbol}{amt}
              </button>
            ))}
          </div>

          {/* Custom Pay Row */}
          <div className="uno-custom-pay-row">
            <div className="uno-custom-input-box">
              <span>{currencySymbol}</span>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomChange(e.target.value)}
                placeholder="1"
              />
            </div>
            <Link
              href="/dashboard"
              className="uno-pay-btn"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              Pay
            </Link>
          </div>

          {/* Pay As You Go Note */}
          <p className="uno-paygo-note">
            PAY AS YOU GO CREDIT NEVER EXPIRES.
          </p>

          {/* Dynamic Discord Link */}
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="uno-discord-custom-link"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span>Need a custom plan? Ask on Discord</span>
          </a>

          {/* Middle Callout / Separator */}
          <div className="uno-subscribe-callout">
            <h3>Using it regularly? Subscribe and get dedicated high-speed quotas each month.</h3>
            <p>
              Top up when you want flexibility. Subscribe once your usage is predictable and get guaranteed RPM and priority routing.
            </p>
            <div className="uno-chevron-down">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          {/* Dynamic Subscription Plans Grid */}
          <div className="uno-sub-cards-grid">
            {plans.map((p) => {
              const isPopular = p.is_popular === 1;
              const formattedBudget =
                p.token_budget == null
                  ? "UNLIMITED TOKENS"
                  : `${(p.token_budget / 1_000_000).toFixed(0)}M API TOKENS / MO`;

              return (
                <div key={p.id} className={`uno-sub-card ${isPopular ? "best-value" : ""}`}>
                  {isPopular && (
                    <>
                      <div className="uno-card-top-tag">BEST VALUE</div>
                      <div className="uno-card-border-badge">POPULAR</div>
                    </>
                  )}

                  <div className="uno-sub-tier-name">{p.name.toUpperCase()}</div>
                  <div className="uno-sub-price-row">
                    <span className="uno-sub-price-val">
                      {p.price === 0 ? "FREE" : `${currencySymbol}${p.price}`}
                    </span>
                    {p.price > 0 && <span className="uno-sub-price-mo">/ mo</span>}
                  </div>

                  {/* Highlight Box */}
                  <div className="uno-credit-highlight-box">
                    <div className="uno-credit-highlight-title">{formattedBudget}</div>
                  </div>

                  <div className="uno-sub-card-desc">
                    {p.description || `Full access to high-speed AI routing with ${p.rpm_limit ?? "unlimited"} RPM.`}
                    {p.validity_days && (
                      <span className="uno-credit-warning">
                        Valid for {p.validity_days} days after activation.
                      </span>
                    )}
                  </div>

                  <div className="uno-sub-card-divider" />

                  {/* Dynamic bullet items */}
                  <ul className="uno-sub-bullet-list">
                    {Array.isArray(p.features) && p.features.length > 0 ? (
                      p.features.map((feat, idx) => (
                        <li key={idx} className="uno-sub-bullet-item">
                          <span className="check">✓</span>
                          <span>{feat}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="uno-sub-bullet-item">
                          <span className="check">✓</span>
                          <span>{p.token_budget ? `${(p.token_budget / 1_000_000).toFixed(0)}M Tokens Included` : "Unlimited Tokens"}</span>
                        </li>
                        <li className="uno-sub-bullet-item">
                          <span className="check">✓</span>
                          <span>{p.rpm_limit ?? 30} Requests per minute</span>
                        </li>
                      </>
                    )}
                  </ul>

                  <Link
                    href={`/register?plan=${p.id}`}
                    className={`uno-sub-btn ${isPopular ? "solid" : "outline"}`}
                  >
                    {isPopular && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    )}
                    {p.price === 0 ? "START FOR FREE" : "SUBSCRIBE"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
