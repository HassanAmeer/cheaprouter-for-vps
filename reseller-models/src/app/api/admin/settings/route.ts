import { NextResponse } from "next/server";
import { getAllSettings, setSettingsBulk } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/settings — fetch all settings */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = getAllSettings();
  return NextResponse.json({ settings });
}

/** POST /api/admin/settings — update settings */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Sanitize and update key-value pairs
  const allowedKeys = [
    "site_name",
    "site_logo",
    "hero_title",
    "hero_subtitle",
    "hero_cta_text",
    "currency_symbol",
    "discord_url",
    "contact_email",
    "footer_text",
    "cheaproute_url",
  ];

  const toUpdate: Record<string, string> = {};
  for (const k of allowedKeys) {
    if (k in body && typeof (body as Record<string, unknown>)[k] === "string") {
      toUpdate[k] = String((body as Record<string, unknown>)[k]).trim();
    }
  }

  setSettingsBulk(toUpdate);
  return NextResponse.json({ success: true, settings: getAllSettings() });
}
