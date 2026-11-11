/**
 * GET  /api/sites            → the site registry (name + subdomains per site)
 * POST /api/sites            → add a site (writes config/sites.json, reloads the map)
 *
 * Management-auth gated (dashboard only). The write target is the project's
 * `config/sites.json` — the same file the in-memory resolver reads at boot.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { addSite, listSites, reloadSiteRegistry } from "@/lib/sites/siteRegistry";

export const dynamic = "force-dynamic";

const addSiteSchema = z.object({
  name: z.string().min(1).max(120),
  subdomains: z.array(z.string().min(1).max(253)).min(1).max(50),
});

export async function GET(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  return NextResponse.json({ sites: listSites() });
}

export async function POST(request: NextRequest) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const parsed = addSiteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid site", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const result = addSite(parsed.data);
  if (!result.ok || !result.site) {
    return NextResponse.json(
      { error: { message: result.error || "Failed to add site" } },
      { status: 400 }
    );
  }

  // Re-read so the in-memory map is hot even when the file was written by a
  // different process (e.g. a second instance behind the same nginx).
  reloadSiteRegistry();

  return NextResponse.json({ site: result.site, sites: listSites() });
}
