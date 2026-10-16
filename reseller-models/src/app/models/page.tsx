import Navbar from "../components/Navbar";
import ModelsTable from "../components/ModelsTable";
import Footer from "../components/Footer";
import { fetchPublicProviders, type PublicCombo, type PublicProvider } from "@/lib/cheaproute";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Model Library — UnoRouter",
  description: "Browse 226+ AI models, live context length, uptime, success rate, and real-time pricing.",
};

export default async function ModelsPage() {
  let providers: PublicProvider[] = [];
  let combos: PublicCombo[] = [];

  try {
    const catalog = await fetchPublicProviders();
    providers = catalog.providers || [];
    combos = catalog.combos || [];
  } catch {
    providers = [];
    combos = [];
  }

  return (
    <div style={{ background: "var(--uno-bg)", minHeight: "100vh", color: "#ffffff" }}>
      <Navbar />
      <main style={{ paddingTop: 20 }}>
        <ModelsTable providers={providers} combos={combos} />
      </main>
      <Footer />
    </div>
  );
}
