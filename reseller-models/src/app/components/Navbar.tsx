"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface NavbarProps {
  initialSiteName?: string;
  initialSiteLogo?: string;
  initialDiscordUrl?: string;
}

export default function Navbar({
  initialSiteName,
  initialSiteLogo,
  initialDiscordUrl,
}: NavbarProps) {
  const [mobileOpen] = useState(false);
  const pathname = usePathname();
  const [siteName, setSiteName] = useState(initialSiteName || "UnoRouter");
  const [siteLogo, setSiteLogo] = useState(initialSiteLogo || "");
  const [discordUrl, setDiscordUrl] = useState(initialDiscordUrl || "https://discord.gg");

  useEffect(() => {
    if (!initialSiteName) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data.site_name) setSiteName(data.site_name);
          if (data.site_logo !== undefined) setSiteLogo(data.site_logo);
          if (data.discord_url) setDiscordUrl(data.discord_url);
        })
        .catch(() => {});
    }
  }, [initialSiteName]);

  return (
    <nav className="uno-nav">
      <div className="uno-nav-inner">
        {/* Dynamic Brand Logo & Name */}
        <Link href="/" className="uno-brand">
          <div className="uno-logo-icon">
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt={siteName} width={28} height={28} style={{ objectFit: "contain" }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="15" fill="#0E1219" stroke="#E11D48" strokeWidth="2" />
                <path d="M11 11L7 16L11 21" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 11L11 16L15 21" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 21L25 16L21 11" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 21L21 16L17 11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span style={{ textTransform: "uppercase" }}>{siteName}</span>
        </Link>

        {/* Center Links */}
        <div className="uno-nav-links" style={{ display: mobileOpen ? "flex" : undefined }}>
          <Link href="/dashboard" className={`uno-nav-link ${pathname === "/dashboard" ? "active" : ""}`}>
            DASHBOARD
          </Link>
          <Link href="/models" className={`uno-nav-link ${pathname === "/models" ? "active" : ""}`}>
            MODELS
          </Link>
          <Link href="/pricing" className={`uno-nav-link ${pathname === "/pricing" ? "active" : ""}`}>
            PRICING
          </Link>
          <Link href="/docs" className={`uno-nav-link ${pathname?.startsWith("/docs") ? "active" : ""}`}>
            DOCS
          </Link>
        </div>

        {/* Right Actions */}
        <div className="uno-nav-actions">
          {/* Discord Icon */}
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="uno-icon-btn"
            title="Discord Community"
            aria-label="Discord"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>

          {/* User Profile Avatar / Admin Link */}
          <Link href="/dashboard" className="uno-icon-btn" title="Dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
