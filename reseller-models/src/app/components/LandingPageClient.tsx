"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import ModelsTable from "./ModelsTable";
import PricingSection from "./PricingSection";
import Footer from "./Footer";
import type { PublicCombo, PublicProvider } from "@/lib/cheaproute";

interface LandingPageClientProps {
  providers: PublicProvider[];
  combos: PublicCombo[];
  live: boolean;
}

export default function LandingPageClient({
  providers,
  combos,
  live,
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
      <Navbar />

      <main>
        {/* Hero Section matching UnoRouter */}
        <HeroSection
          providersCount={publishedProvidersCount}
          modelsCount={displayModelsCount}
          freeCount={freeCount}
          paidCount={paidCount}
        />

        {/* Routable Models Table directly below Hero */}
        <ModelsTable providers={providers} combos={combos} />

        {/* Pricing Plans Cards directly after Models Table */}
        <PricingSection />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
