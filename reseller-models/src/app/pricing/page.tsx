import Navbar from "../components/Navbar";
import PricingSection from "../components/PricingSection";
import Footer from "../components/Footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing Plans & Credits — CheapRouter",
  description: "Pay-as-you-go credits and regular monthly subscription plans for AI model routing.",
};

export default function PricingPage() {
  return (
    <div style={{ background: "var(--uno-bg)", minHeight: "100vh", color: "#ffffff" }}>
      <Navbar />
      <main style={{ paddingTop: 20 }}>
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}
