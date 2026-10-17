"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface HeroSectionProps {
  providersCount?: number;
  modelsCount?: number;
  freeCount?: number;
  paidCount?: number;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCtaText?: string;
}

export default function HeroSection({
  providersCount = 37,
  modelsCount = 226,
  freeCount = 93,
  paidCount = 133,
  heroTitle = "UNIFIED CRTT",
  heroSubtitle,
  heroCtaText = "GET STARTED",
}: HeroSectionProps) {
  // Animated live token counter
  const [tokensServed, setTokensServed] = useState<number>(944432915290);

  useEffect(() => {
    const timer = setInterval(() => {
      setTokensServed((prev) => prev + Math.floor(Math.random() * 3200 + 1200));
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const formattedTokens = tokensServed.toLocaleString("en-US");

  // Title formatting helper
  const titleParts = (heroTitle || "UNIFIED CRTT").trim().split(" ");
  const firstWord = titleParts[0] || "UNIFIED";
  const secondWord = titleParts.slice(1).join(" ") || "CRTT";

  return (
    <section className="uno-hero-wrap">
      {/* High-speed background light streaks */}
      <div className="uno-speed-line" style={{ top: "18%", left: "10%", width: "75%" }} />
      <div className="uno-speed-line" style={{ top: "42%", left: "30%", width: "65%", opacity: 0.35 }} />
      <div className="uno-speed-line" style={{ top: "72%", left: "5%", width: "90%", opacity: 0.2 }} />

      {/* Floating Provider Orbit Icons in the hero background */}
      <div
        className="uno-floating-icon"
        style={{ top: "16%", right: "38%", borderColor: "rgba(168, 85, 247, 0.4)" }}
        title="OpenAI"
      >
        <span style={{ fontSize: 18 }}>OI</span>
      </div>
      <div
        className="uno-floating-icon"
        style={{ top: "28%", right: "42%", borderColor: "rgba(239, 68, 68, 0.3)" }}
        title="Anthropic"
      >
        <span style={{ fontSize: 16 }}>✻</span>
      </div>
      <div
        className="uno-floating-icon"
        style={{ top: "12%", right: "28%", borderColor: "rgba(59, 130, 246, 0.4)" }}
        title="Google Gemini"
      >
        <span style={{ fontSize: 16 }}>✦</span>
      </div>
      <div
        className="uno-floating-icon"
        style={{ top: "22%", right: "22%", borderColor: "rgba(34, 197, 94, 0.4)" }}
        title="DeepSeek"
      >
        <span style={{ fontSize: 16 }}>🐋</span>
      </div>
      <div
        className="uno-floating-icon"
        style={{ top: "14%", right: "14%", borderColor: "rgba(249, 115, 22, 0.4)" }}
        title="Mistral AI"
      >
        <span style={{ fontSize: 16 }}>⚡</span>
      </div>
      <div
        className="uno-floating-icon"
        style={{ top: "34%", right: "12%", borderColor: "rgba(14, 165, 233, 0.4)" }}
        title="Meta Llama"
      >
        <span style={{ fontSize: 16 }}>∞</span>
      </div>

      <div className="uno-container">
        <div className="uno-hero-grid">
          {/* Left Column: Headline & Description */}
          <div className="uno-hero-left">
            {/* Status Badge */}
            <div className="uno-status-badge">
              <span className="uno-dot-pulse" />
              <span>ROUTER ONLINE</span>
            </div>

            {/* Main Cyber Typography */}
            <h1 className="uno-hero-title">
              {firstWord}
              <br />
              <span className="title-accent">
                {secondWord}<span className="uno-title-dot" />
              </span>
            </h1>

            {/* Description */}
            <p className="uno-hero-desc">
              {heroSubtitle ||
                `Connect to ${modelsCount}+ AI models through one single unified key. Build apps and run agents with auto-failover, lowest latency, and pay-as-you-go pricing.`}
            </p>

            {/* CTA Buttons */}
            <div className="uno-hero-ctas">
              <Link href="/register" className="uno-btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                {heroCtaText}
              </Link>
              <Link href="/models" className="uno-btn-outline">
                VIEW MODELS &gt;
              </Link>
              <Link href="/dashboard" className="uno-btn-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                OPEN CHAT
              </Link>
            </div>
          </div>

          {/* Right Column: Live Metrics Card */}
          <div className="uno-metrics-card">
            <div className="uno-metrics-header">
              <div className="uno-metrics-label">
                <span className="uno-dot-pulse" />
                <span>TOKENS SERVED</span>
              </div>
              {/* ECG Sparkline Waveform SVG */}
              <svg width="26" height="16" viewBox="0 0 28 16" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 8h5l2-6 4 12 3-8 3 5 4-3h5" />
              </svg>
            </div>

            {/* Huge Counter */}
            <div className="uno-metrics-main-val">
              {formattedTokens}
            </div>

            <div className="uno-metrics-divider" />

            {/* Sub-metrics */}
            <div className="uno-metrics-subgrid">
              <div>
                <div className="uno-submetric-label">REQUESTS</div>
                <div className="uno-submetric-val">23,705,655</div>
              </div>
              <div>
                <div className="uno-submetric-label">TOKENS / MIN</div>
                <div className="uno-submetric-val">
                  <span>1,846,000</span>
                  <span className="uno-live-tag">Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Hero Stats Strip */}
        <div className="uno-bottom-stats">
          <div className="uno-stat-col">
            <div className="uno-stat-label">MODELS</div>
            <div className="uno-stat-num">{modelsCount}</div>
            <div className="uno-stat-sub">
              <span className="dot" />
              <span>Routable</span>
            </div>
          </div>

          <div className="uno-stat-col">
            <div className="uno-stat-label">PROVIDERS</div>
            <div className="uno-stat-num">{providersCount}+</div>
            <div className="uno-stat-sub">
              <span className="dot" />
              <span>Upstreams</span>
            </div>
          </div>

          <div className="uno-stat-col">
            <div className="uno-stat-label">FREE</div>
            <div className="uno-stat-num">{freeCount}</div>
            <div className="uno-stat-sub">
              <span className="dot" />
              <span>No cost</span>
            </div>
          </div>

          <div className="uno-stat-col">
            <div className="uno-stat-label">PAID</div>
            <div className="uno-stat-num">{paidCount}</div>
            <div className="uno-stat-sub">
              <span className="dot" style={{ background: "#38bdf8" }} />
              <span>Pay per use</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
