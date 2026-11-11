/**
 * GET    /api/sites/:id   → one site: identity + exposed providers + routes + settings
 * PATCH  /api/sites/:id   → update the operational side (exposed providers, routes, settings)
 * DELETE /api/sites/:id   → drop the DB-side records (the JSON identity stays under the operator's control)
 *
 * Site IDENTITY (name + subdomains) lives in `config/sites.json` and is edited
 * through `/api/sites`. This route owns the per-site operational config:
 *
 *   - `providers` — the allowlist of exposed providers (+ optional model list).
 *     An EMPTY list means "inherit the global pool" (nothing is restricted).
 *   - `routes`    — dispatchable route ids. Empty = no restriction.
 *   - `settings`  — free-form per-site settings (merged).
 *
 * Provider CONNECTIONS (credentials) are global and are never touched here.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import {
  deleteSiteRecord,
  getSiteRecord,
  listSiteProviders,
  listSiteRoutes,
  setSiteProviders,
  setSiteRoutes,
  updateSiteSettings,
  upsertSiteRecord,
} from "@/lib/db/sites";
import { getSiteRegistry } from "@/lib/sites/siteRegistry";
import { invalidateSiteScopeCache } from "@/lib/sites/siteScope";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  providers: z
    .array(
      z.object({
        provider: z.string().min(1).max(120),
        models: z.array(z.string().min(1).max(200)).max(2000).optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .max(500)
    .optional(),
  routes: z.array(z.string().min(1).max(200)).max(1000).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

function findRegistrySite(siteId: string) {
  return getSiteRegistry().sites.find((site) => site.id === siteId) ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const registrySite = findRegistrySite(id);
  const record = getSiteRecord(id);
  if (!registrySite && !record) {
    return NextResponse.json({ error: { message: "Site not found" } }, { status: 404 });
  }

  return NextResponse.json({
    site: {
      id,
      // The JSON registry is the identity source of truth; the DB row mirrors it.
      name: registrySite?.name ?? record?.name ?? id,
      subdomains: registrySite?.subdomains ?? record?.subdomains ?? [],
      isActive: record?.isActive ?? true,
      settings: record?.settings ?? {},
    },
    providers: listSiteProviders(id),
    routes: listSiteRoutes(id).map((row) => row.routeId),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const registrySite = findRegistrySite(id);
  const record = getSiteRecord(id);
  if (!registrySite && !record) {
    return NextResponse.json({ error: { message: "Site not found" } }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Invalid site config", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }
  const patch = parsed.data;

  // Mirror the identity into the DB on first PATCH (a site created before the
  // multi-tenant schema existed gets its row here).
  if (!record) {
    upsertSiteRecord({
      id,
      name: registrySite?.name ?? id,
      subdomains: registrySite?.subdomains ?? [],
    });
  }

  if (patch.providers) {
    setSiteProviders(id, patch.providers);
  }
  if (patch.routes) {
    setSiteRoutes(id, patch.routes);
  }
  if (patch.settings) {
    updateSiteSettings(id, patch.settings);
  }

  // The allowlist changed — drop the 5s scope cache so the next request sees it.
  invalidateSiteScopeCache();

  return NextResponse.json({
    ok: true,
    providers: listSiteProviders(id),
    routes: listSiteRoutes(id).map((row) => row.routeId),
    settings: getSiteRecord(id)?.settings ?? {},
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const removed = deleteSiteRecord(id);
  invalidateSiteScopeCache();
  if (!removed) {
    return NextResponse.json({ error: { message: "Site records not found" } }, { status: 404 });
  }
  // The identity (name + subdomains) stays in config/sites.json — deleting it
  // from disk is the operator's call, not an API side effect.
  return NextResponse.json({ ok: true });
}
