/**
 * Site scope — request → site resolution and per-site exposure rules.
 *
 * The registry (`siteRegistry.ts`) answers "which site owns this hostname" with
 * a free in-memory Map lookup. This module layers the rest of the resolution
 * order on top and reads the per-site allowlists from the DB.
 *
 * Resolution order (see docs/specs/sites-multi-tenant.md):
 *   1. Host header          → in-memory map (free)
 *   2. X-CheapRoute-Site    → explicit override header
 *   3. API key              → api_keys.site_id
 *   4. default              → null (global scope)
 *
 * A site with NO `site_providers` rows inherits the global pool (no
 * restriction); once it has rows, only those providers are exposed.
 */

import {
  getSiteRegistry,
  listSites,
  resolveSiteIdByHost,
} from "./siteRegistry";
import {
  getSiteRecord,
  listSiteProviders,
  listSiteRoutes,
  listSiteRecords,
} from "@/lib/db/sites";

export interface SiteScopeInput {
  /** Raw Host header (may include a port). */
  host?: string | null;
  /** Request headers — used for the X-CheapRoute-Site override. */
  headers?: { get(name: string): string | null } | null;
  /** Resolved API-key metadata (its `siteId`, when the key is site-scoped). */
  apiKeyInfo?: { siteId?: string | null; id?: string | null } | null;
}

/** Is this site id present in the live registry? */
function isKnownSite(siteId: string | null | undefined): siteId is string {
  if (!siteId) return false;
  return getSiteRegistry().sites.some((site) => site.id === siteId);
}

/**
 * Resolve the site for a request. Returns null for the global scope.
 *
 * Never throws — every lookup is defensive so the hot path stays safe.
 */
export function resolveSiteIdForRequest(input: SiteScopeInput = {}): string | null {
  const { host, headers, apiKeyInfo } = input;

  // 1. Host header — free Map lookup.
  const byHost = resolveSiteIdByHost(host);
  if (byHost && isKnownSite(byHost)) return byHost;

  // 2. Explicit override header (validated against the registry so a spoofed
  //    value cannot invent a scope).
  const headerValue = headers?.get("x-cheaproute-site");
  if (headerValue && isKnownSite(headerValue.trim().toLowerCase())) {
    return headerValue.trim().toLowerCase();
  }

  // 3. API key's site (validated the same way).
  const keySite = apiKeyInfo?.siteId;
  if (keySite && isKnownSite(keySite)) return keySite;

  // 4. Global scope.
  return null;
}

export interface SiteProviderScope {
  /** True when the site has no explicit allowlist → inherit the global pool. */
  inheritsGlobal: boolean;
  /** Enabled providers (canonical or alias ids as stored). */
  providers: Set<string>;
  /** provider → allowed models (empty set = every model of that provider). */
  modelsByProvider: Map<string, Set<string>>;
}

let scopeCache: {
  siteId: string;
  at: number;
  scope: SiteProviderScope;
} | null = null;

const SCOPE_CACHE_TTL_MS = 5_000;

/**
 * The provider/model exposure rules for a site.
 *
 * Cached for a few seconds: the catalog is built under a short-TTL cache of its
 * own, and a site's allowlist changes rarely. A miss costs one indexed query.
 */
export function getSiteProviderScope(siteId: string | null): SiteProviderScope {
  const inheritsGlobal: SiteProviderScope = {
    inheritsGlobal: true,
    providers: new Set<string>(),
    modelsByProvider: new Map<string, Set<string>>(),
  };
  if (!siteId) return inheritsGlobal;

  const cached = scopeCache;
  if (cached && cached.siteId === siteId && Date.now() - cached.at < SCOPE_CACHE_TTL_MS) {
    return cached.scope;
  }

  const rows = listSiteProviders(siteId);
  const enabled = rows.filter((row) => row.isEnabled);
  if (enabled.length === 0) return inheritsGlobal;

  const providers = new Set<string>();
  const modelsByProvider = new Map<string, Set<string>>();
  for (const row of enabled) {
    providers.add(row.provider);
    modelsByProvider.set(row.provider, new Set(row.models));
  }
  const scope: SiteProviderScope = { inheritsGlobal: false, providers, modelsByProvider };
  scopeCache = { siteId, at: Date.now(), scope };
  return scope;
}

/** Invalidate the scope cache (after a site's allowlist changes). */
export function invalidateSiteScopeCache(): void {
  scopeCache = null;
}

/** True when a provider may be exposed to a site. */
export function isProviderAllowedForSite(siteId: string | null, provider: string): boolean {
  if (!siteId || !provider) return true;
  const scope = getSiteProviderScope(siteId);
  if (scope.inheritsGlobal) return true;
  return scope.providers.has(provider);
}

/** True when a model may be exposed to a site. */
export function isModelAllowedForSite(
  siteId: string | null,
  provider: string,
  model: string
): boolean {
  if (!siteId || !provider || !model) return true;
  const scope = getSiteProviderScope(siteId);
  if (scope.inheritsGlobal) return true;
  if (!scope.providers.has(provider)) return false;
  const allowed = scope.modelsByProvider.get(provider);
  if (!allowed || allowed.size === 0) return true; // whole provider exposed
  return allowed.has(model);
}

/**
 * Per-site route allowlist. Returns null when the site has no explicit list
 * (= every route is allowed).
 */
export function getSiteRouteAllowlist(siteId: string | null): Set<string> | null {
  if (!siteId) return null;
  const rows = listSiteRoutes(siteId);
  if (rows.length === 0) return null;
  return new Set(rows.map((row) => row.routeId));
}

/** The site's display name (falls back to the id, then "Global"). */
export function getSiteDisplayName(siteId: string | null): string {
  if (!siteId) return "Global";
  return getSiteRecord(siteId)?.name ?? siteId;
}

/** Sites for the dashboard dropdown (registry view + DB settings merged). */
export function listSiteScopes(): Array<{
  id: string;
  name: string;
  subdomains: string[];
  isActive: boolean;
  providerCount: number;
}> {
  const dbSites = new Map(
    listSiteRecords().map((record) => [
      record.id,
      { name: record.name, subdomains: record.subdomains, isActive: record.isActive },
    ])
  );
  return listSites().map((site) => {
    const record = dbSites.get(site.id);
    return {
      id: site.id,
      name: record?.name ?? site.name,
      subdomains: record?.subdomains?.length ? record.subdomains : site.subdomains,
      isActive: record?.isActive ?? true,
      providerCount: listSiteProviders(site.id).length,
    };
  });
}
