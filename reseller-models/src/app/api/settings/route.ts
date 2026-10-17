import { NextResponse } from "next/server";
import { getAllSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/settings — Public site branding and configuration */
export async function GET() {
  try {
    const settings = getAllSettings();
    return NextResponse.json({
      site_name: settings.site_name || "UnoRouter",
      site_logo: settings.site_logo || "",
      hero_title: settings.hero_title || "UNIFIED CRTT",
      hero_subtitle:
        settings.hero_subtitle ||
        "Connect to 226+ AI models through one unified API key. Build apps and run agents with auto-failover, lowest latency, and pay-as-you-go pricing.",
      hero_cta_text: settings.hero_cta_text || "GET STARTED",
      currency_symbol: settings.currency_symbol || "$",
      discord_url: settings.discord_url || "https://discord.gg",
      contact_email: settings.contact_email || "support@unorouter.com",
      footer_text:
        settings.footer_text ||
        "The unified high-speed AI proxy & router. One endpoint, 370+ AI models, auto-failover, and Bring Your Own Key support.",
      cheaproute_url: settings.cheaproute_url || "http://localhost:20128",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load settings" },
      { status: 500 }
    );
  }
}
