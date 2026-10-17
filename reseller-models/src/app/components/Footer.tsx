"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FooterProps {
  initialSiteName?: string;
  initialSiteLogo?: string;
  initialFooterText?: string;
  initialDiscordUrl?: string;
}

export default function Footer({
  initialSiteName,
  initialSiteLogo,
  initialFooterText,
  initialDiscordUrl,
}: FooterProps) {
  const [siteName, setSiteName] = useState(initialSiteName || "UNOROUTER");
  const [siteLogo, setSiteLogo] = useState(initialSiteLogo || "");
  const [footerText, setFooterText] = useState(
    initialFooterText ||
      "The unified high-speed AI proxy & router. One endpoint, 370+ AI models, auto-failover, and Bring Your Own Key support."
  );
  const [discordUrl, setDiscordUrl] = useState(initialDiscordUrl || "https://discord.gg");

  useEffect(() => {
    if (!initialSiteName || !initialFooterText) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.site_name) setSiteName(data.site_name.toUpperCase());
          if (data.site_logo !== undefined) setSiteLogo(data.site_logo);
          if (data.footer_text) setFooterText(data.footer_text);
          if (data.discord_url) setDiscordUrl(data.discord_url);
        })
        .catch(() => {});
    }
  }, [initialSiteName, initialFooterText]);

  return (
    <footer className="uno-footer">
      <div className="uno-container">
        <div className="uno-footer-grid">
          {/* Brand Info */}
          <div className="uno-footer-col">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              {siteLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={siteLogo} alt={siteName} width={24} height={24} style={{ objectFit: "contain" }} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="15" fill="#0E1219" stroke="#E11D48" strokeWidth="2" />
                  <path d="M11 11L7 16L11 21" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 11L11 16L15 21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 21L25 16L21 11" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 21L21 16L17 11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{ color: "#ffffff", fontWeight: 800, fontSize: 16, letterSpacing: 0.8 }}>
                {siteName}
              </span>
            </div>
            <p style={{ color: "var(--uno-text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 320 }}>
              {footerText}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
              <span className="uno-dot-pulse" />
              <span style={{ fontSize: 12, color: "var(--uno-green)", fontFamily: "var(--uno-font-mono)", fontWeight: 600 }}>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="uno-footer-col">
            <h4>Platform</h4>
            <ul className="uno-footer-links">
              <li><Link href="/models" className="uno-footer-link">Models Catalog</Link></li>
              <li><Link href="/models" className="uno-footer-link">Model Rankings</Link></li>
              <li><Link href="/pricing" className="uno-footer-link">Pricing Plans</Link></li>
              <li><Link href="/dashboard" className="uno-footer-link">BYOK Key Vault</Link></li>
            </ul>
          </div>

          <div className="uno-footer-col">
            <h4>Developers</h4>
            <ul className="uno-footer-links">
              <li><Link href="/docs" className="uno-footer-link">Documentation &amp; Guides</Link></li>
              <li><Link href="/docs#apis" className="uno-footer-link">API Reference</Link></li>
              <li><Link href="/dashboard" className="uno-footer-link">Usage Metrics</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="uno-footer-link">GitHub Repository</a></li>
              <li><a href={discordUrl} target="_blank" rel="noopener noreferrer" className="uno-footer-link">Discord Community</a></li>
            </ul>
          </div>

          <div className="uno-footer-col">
            <h4>Account</h4>
            <ul className="uno-footer-links">
              <li><Link href="/login" className="uno-footer-link">User Login</Link></li>
              <li><Link href="/register" className="uno-footer-link">Create Account</Link></li>
              <li><Link href="/dashboard" className="uno-footer-link">User Dashboard</Link></li>
              <li><Link href="/admin" className="uno-footer-link">Admin Console</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="uno-footer-bottom">
          <div>
            &copy; {new Date().getFullYear()} {siteName} &middot; Powered by CheapRoute Engine.
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <Link href="/" className="uno-footer-link">Privacy Policy</Link>
            <Link href="/" className="uno-footer-link">Terms of Service</Link>
            <Link href="/" className="uno-footer-link">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
