import { fetchPublicProviders, type PublicCombo, type PublicProvider } from "@/lib/cheaproute";
import { getAllSettings, getDb, rowToPlan } from "@/lib/db";
import LandingPageClient from "./components/LandingPageClient";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  let providers: PublicProvider[] = [];
  let combos: PublicCombo[] = [];
  let live = false;

  try {
    const catalog = await fetchPublicProviders();
    providers = catalog.providers || [];
    combos = catalog.combos || [];
    live = true;
  } catch {
    live = false;
  }

  // Load dynamic branding settings and plans from local SQLite database
  const settings = getAllSettings();
  const planRows = getDb()
    .prepare("SELECT * FROM plans ORDER BY price ASC, token_budget ASC")
    .all() as Array<Record<string, unknown>>;
  const plans = planRows.map(rowToPlan);

  return (
    <LandingPageClient
      providers={providers}
      combos={combos}
      live={live}
      settings={settings}
      plans={plans}
    />
  );
}
