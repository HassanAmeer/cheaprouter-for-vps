/**
 * Request-scoped site resolution for the API routes.
 *
 * The route is the only place that has the raw `Request` (Host header + the
 * caller's API key) before the handler chain starts, so that is where the site
 * scope is resolved ONCE and bound to the request through
 * `runWithCallLogApiKeyContext`. Every call log / usage row written downstream
 * (including from provider-specific helpers) then carries the same `site_id`
 * without threading a parameter through the pipeline.
 *
 * Resolution order lives in `siteScope.ts` (host → X-CheapRoute-Site header →
 * the API key's own site → global). This module only supplies the inputs.
 */

import { extractApiKey } from "@/sse/services/auth";
import { getApiKeyMetadata } from "@/lib/db/apiKeys";
import { resolveSiteIdForRequest } from "./siteScope";

export interface RequestSiteContext {
  /** Resolved site id, or null for the global scope. */
  siteId: string | null;
  /** API-key identity, so call logs stay attributed even when the entry omits it. */
  apiKeyId: string | null;
  apiKeyName: string | null;
}

const EMPTY_CONTEXT: RequestSiteContext = { siteId: null, apiKeyId: null, apiKeyName: null };

/**
 * Resolve the site + key identity for one request.
 *
 * Never throws: any failure (no key, DB hiccup, malformed header) degrades to
 * the global scope, which is exactly the pre-multi-tenant behaviour.
 */
export async function resolveRequestSiteContext(request: Request): Promise<RequestSiteContext> {
  try {
    const headers = request?.headers ?? null;
    const host = headers?.get("host") ?? null;

    let apiKeyId: string | null = null;
    let apiKeyName: string | null = null;
    let keySiteId: string | null = null;

    try {
      const key = extractApiKey(request as never);
      if (key) {
        const metadata = await getApiKeyMetadata(key);
        if (metadata) {
          apiKeyId = metadata.id || null;
          apiKeyName = metadata.name ?? null;
          keySiteId = metadata.siteId ?? null;
        }
      }
    } catch {
      // Auth/DB failure is the handler's problem, not the scope resolver's.
    }

    const siteId = resolveSiteIdForRequest({
      host,
      headers: headers
        ? {
            get: (name: string) => headers.get(name),
          }
        : null,
      apiKeyInfo: { siteId: keySiteId, id: apiKeyId },
    });

    return { siteId, apiKeyId, apiKeyName };
  } catch {
    return EMPTY_CONTEXT;
  }
}
