import Navbar from "../components/Navbar";
import PricingSection from "../components/PricingSection";
import Footer from "../components/Footer";
import { getAllSettings, getDb, rowToPlan } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const settings = getAllSettings();
  const planRows = getDb()
    .prepare("SELECT * FROM plans ORDER BY price ASC, token_budget ASC")
    .all() as Array<Record<string, unknown>>;
  const plans = planRows.map(rowToPlan);

  return (
    <div style={{ background: "var(--uno-bg)", minHeight: "100vh", color: "#ffffff" }}>
      <Navbar
        initialSiteName={settings.site_name}
        initialSiteLogo={settings.site_logo}
        initialDiscordUrl={settings.discord_url}
      />
      <main style={{ paddingTop: 20 }}>
        <PricingSection
          initialPlans={plans}
          initialCurrencySymbol={settings.currency_symbol}
          initialDiscordUrl={settings.discord_url}
        />
      </main>
      <Footer
        initialSiteName={settings.site_name}
        initialSiteLogo={settings.site_logo}
        initialFooterText={settings.footer_text}
        initialDiscordUrl={settings.discord_url}
      />
    </div>
  );
}
