/**
 * Site-scoped model catalog filtering.
 *
 * `GET /v1/models` builds a catalog that is cached globally (several cache
 * dimensions, none of which know about sites). Rather than adding a site
 * dimension to every cache key, the response is filtered per request — and
 * only when the request actually resolves to a site WITH an explicit provider
 * allowlist. Every other request (the overwhelming majority, including all
 * site-less traffic) returns the cached response untouched.
 *
 * The filter works on the serialized OpenAI-style payload:
 *   { "object": "list", "data": [{ "id": "openai/gpt-4o", "owned_by": "openai" }, ...] }
 */

import { getProviderAlias, resolveProviderId } from "@/shared/constants/providers";
import { getSiteProviderScope } from "./siteScope";

interface CatalogModelEntry {
  id?: unknown;
  owned_by?: unknown;
  [key: string]: unknown;
}

/** Every provider identity an entry could be matched against. */
function providerCandidates(entry: CatalogModelEntry): string[] {
  const candidates = new Set<string>();
  const ownedBy = typeof entry.owned_by === "string" ? entry.owned_by : "";
  if (ownedBy) {
    candidates.add(ownedBy);
    candidates.add(resolveProviderId(ownedBy));
    candidates.add(getProviderAlias(ownedBy));
  }
  const id = typeof entry.id === "string" ? entry.id : "";
  const slash = id.indexOf("/");
  if (slash > 0) {
    const prefix = id.slice(0, slash);
    candidates.add(prefix);
    candidates.add(resolveProviderId(prefix));
    candidates.add(getProviderAlias(prefix));
  }
  return [...candidates].filter(Boolean);
}

/** The bare model id (provider prefix stripped), used for the model allowlist. */
function bareModelId(id: string): string {
  const slash = id.indexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

/**
 * Filter one catalog payload for a site.
 *
 * Returns the input array unchanged when the site inherits the global pool.
 */
export function filterCatalogEntriesForSite<T extends CatalogModelEntry>(
  siteId: string | null,
  entries: T[]
): T[] {
  const scope = getSiteProviderScope(siteId);
  if (!siteId || scope.inheritsGlobal) return entries;

  return entries.filter((entry) => {
    const provider = providerCandidates(entry).find((candidate) =>
      scope.providers.has(candidate)
    );
    if (!provider) return false;

    const allowedModels = scope.modelsByProvider.get(provider);
    if (!allowedModels || allowedModels.size === 0) return true; // whole provider exposed

    const id = typeof entry.id === "string" ? entry.id : "";
    const bare = bareModelId(id);
    return allowedModels.has(bare) || allowedModels.has(id);
  });
}

/**
 * Apply the site filter to a `/v1/models` response.
 *
 * No-ops (same Response object, zero copying) when the request has no site or
 * the site inherits the global pool. The resolver is injected so this module
 * never imports the auth graph.
 */
export async function scopeModelsResponseForSite(
  response: Response,
  resolveSite: () => Promise<string | null>
): Promise<Response> {
  try {
    if (!response.ok) return response;
    const siteId = await resolveSite();
    if (!siteId) return response;
    if (getSiteProviderScope(siteId).inheritsGlobal) return response;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return response;

    const payload = (await response.json()) as {
      data?: CatalogModelEntry[];
      [key: string]: unknown;
    };
    if (!Array.isArray(payload?.data)) return response;

    const filtered = { ...payload, data: filterCatalogEntriesForSite(siteId, payload.data) };
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(filtered), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    // Never break the catalog because of a site-scope problem.
    return response;
  }
}
