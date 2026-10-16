import { fetchPublicProviders, type PublicCombo, type PublicProvider } from "@/lib/cheaproute";
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

  return <LandingPageClient providers={providers} combos={combos} live={live} />;
}
