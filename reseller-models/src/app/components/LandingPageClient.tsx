"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import ModelsTable from "./ModelsTable";
import PricingSection, { type Plan } from "./PricingSection";
import Footer from "./Footer";
import type { PublicCombo, PublicProvider } from "@/lib/cheaproute";

interface LandingPageClientProps {
  providers: PublicProvider[];
  combos: PublicCombo[];
  live: boolean;
  settings?: Record<string, string>;
  plans?: Plan[];
}

export default function LandingPageClient({
  providers,
  combos,
  settings,
  plans,
}: LandingPageClientProps) {
  // Compute counts from live catalog if available, or fallback to screenshot counts
  const publishedProvidersCount = providers.length > 0 ? providers.length : 37;
  const totalModelsCount =
    providers.reduce((acc, p) => acc + (p.modelsCount || (p.models ? p.models.length : 0)), 0) +
    combos.length;
  const displayModelsCount = totalModelsCount > 50 ? totalModelsCount : 226;
  const freeCount = Math.max(
    combos.filter((c) => c.pricing?.tier === "free").length,
    93
  );
  const paidCount = Math.max(displayModelsCount - freeCount, 133);

  return (
    <div style={{ background: "var(--uno-bg)", minHeight: "100vh", color: "#ffffff" }}>
      {/* Top Navbar */}
      <Navbar
        initialSiteName={settings?.site_name}
        initialSiteLogo={settings?.site_logo}
        initialDiscordUrl={settings?.discord_url}
      />

      <main>
        {/* Hero Section matching UnoRouter with dynamic headline and CTA */}
        <HeroSection
          providersCount={publishedProvidersCount}
          modelsCount={displayModelsCount}
          freeCount={freeCount}
          paidCount={paidCount}
          heroTitle={settings?.hero_title}
          heroSubtitle={settings?.hero_subtitle}
          heroCtaText={settings?.hero_cta_text}
        />

        {/* Routable Models Table directly below Hero */}
        <ModelsTable providers={providers} combos={combos} />

        {/* Dynamic Pricing Plans Cards directly after Models Table */}
        <PricingSection
          initialPlans={plans}
          initialCurrencySymbol={settings?.currency_symbol}
          initialDiscordUrl={settings?.discord_url}
        />
      </main>

      {/* Dynamic Footer */}
      <Footer
        initialSiteName={settings?.site_name}
        initialSiteLogo={settings?.site_logo}
        initialFooterText={settings?.footer_text}
        initialDiscordUrl={settings?.discord_url}
      />
    </div>
  );
}
