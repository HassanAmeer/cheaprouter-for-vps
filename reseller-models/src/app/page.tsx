import Link from "next/link";
import { fetchPublicProviders, gatewayUrl } from "@/lib/cheaproute";

export const dynamic = "force-dynamic";

const TIERS = [
  { name: "Free", tokens: "10M tokens", rpm: "10 req/min", validity: "7 days", cta: "Start free" },
  { name: "Pro", tokens: "50M tokens", rpm: "30 req/min", validity: "30 days", cta: "Go Pro" },
  { name: "Premium", tokens: "100M tokens", rpm: "120 req/min", validity: "Unlimited", cta: "Go Premium" },
];

export default async function LandingPage() {
  let providers: Array<{ id: string; name: string; iconUrl?: string; modelsCount?: number }> = [];
  let combos: Array<{
    name: string;
    strategy?: string;
    models: string[];
    pricing?: { tier?: "free" | "paid"; inputCost?: number | null; outputCost?: number | null };
  }> = [];
  let live = false;
  try {
    const catalog = await fetchPublicProviders();
    providers = catalog.providers.slice(0, 24);
    combos = catalog.combos || [];
    live = true;
  } catch {
    live = false;
  }

  return (
    <div className="wrap">
      <nav className="nav">
        <Link href="/" className="brand">Reseller Gateway</Link>
        <span className="spacer" />
        <Link href="/login" className="link">Login</Link>
        <Link href="/register" className="link">Sign up</Link>
        <Link href="/dashboard" className="link">Dashboard</Link>
      </nav>

      <header className="hero">
        <h1>Your Private AI Gateway.<br />370+ Models. One Endpoint.</h1>
        <p>
          High-speed OpenAI-compatible access with plan quotas, per-model budgets,
          and bring-your-own-key support — powered by CheapRouter.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/register" className="btn">Sign Up</Link>
          <Link href="/login" className="btn ghost">Login</Link>
        </div>
      </header>

      {combos.length > 0 && (
        <section className="section">
          <h2>Featured AI Combos & Routers</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {combos.map((c) => {
              const tier = c.pricing?.tier || "free";
              const isFree = tier === "free";
              return (
                <div key={c.name} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        backgroundColor: isFree ? "rgba(16, 185, 129, 0.2)" : "rgba(168, 85, 247, 0.2)",
                        color: isFree ? "#34d399" : "#c084fc",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {isFree
                        ? "FREE"
                        : `$${c.pricing?.inputCost ?? 0}/$${c.pricing?.outputCost ?? 0}`}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>Strategy: {c.strategy || "priority"}</div>
                  {c.models && c.models.length > 0 && (
                    <div className="faint" style={{ fontSize: 11 }}>
                      Targets: {c.models.slice(0, 3).join(", ")}{c.models.length > 3 ? ` +${c.models.length - 3} more` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Live Models Catalog {live ? "" : "(gateway offline)"}</h2>
        {!live && (
          <p className="muted">
            CheapRouter at <span className="mono">{gatewayUrl()}</span> is unreachable —
            showing the catalog requires the gateway online.
          </p>
        )}
        <div className="provider-grid">
          {providers.map((p) => (
            <div key={p.id} className="provider-card">
              {p.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.iconUrl} alt="" loading="lazy" />
              ) : (
                <span className="badge">{p.id.slice(0, 2).toUpperCase()}</span>
              )}
              <div className="meta">
                <b>{p.name}</b>
                <span>{p.modelsCount ?? 0} models</span>
              </div>
            </div>
          ))}
          {providers.length === 0 && live && (
            <p className="muted">No providers published yet.</p>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Pricing</h2>
        <div className="grid3">
          {TIERS.map((t) => (
            <div key={t.name} className="card">
              <h3 style={{ margin: "0 0 8px" }}>{t.name}</h3>
              <p style={{ fontSize: 28, margin: "0 0 8px" }}>{t.tokens}</p>
              <p className="muted" style={{ margin: "0 0 4px" }}>{t.rpm}</p>
              <p className="muted" style={{ margin: "0 0 16px" }}>{t.validity}</p>
              <Link href="/register" className="btn ghost small">{t.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ padding: "32px 0", color: "var(--faint)", fontSize: 12 }}>
        Reseller Gateway · powered by CheapRouter
      </footer>
    </div>
  );
}
