/**
 * byokHeaders.ts — pure BYOK pass-through header parsing (no DB imports).
 *
 * Kept free of `getDbInstance`/settings so client bundles and jsdom tests
 * can import the header helpers without pulling better-sqlite3. The
 * DB-backed gate (master switch, pause checks) lives in `lib/byok.ts` and
 * re-exports these helpers.
 *
 * @module lib/byokHeaders
 */

/**
 * Provider-scoped BYOK headers. The header names the provider explicitly, so
 * the pause check can run before routing. A provider-scoped header always
 * wins over the generic `x-upstream-key`.
 */
export const PROVIDER_SCOPED_BYOK_HEADERS: Record<string, string> = {
  "x-claude-key": "claude",
  "x-deepseek-key": "deepseek",
  "x-openai-key": "openai",
  "x-gemini-key": "gemini",
  "x-grok-key": "grok",
  "x-qwen-key": "qwen",
  "x-glm-key": "glm",
  "x-antseed-key": "antseed",
};

/** Generic pass-through header — the target provider is resolved by routing. */
export const GENERIC_BYOK_HEADER = "x-upstream-key";

export interface ByokKey {
  /** Provider id for provider-scoped headers; "" for the generic header. */
  providerId: string;
  key: string;
}

/**
 * Extract the BYOK pass-through key from a request, if any.
 * Provider-scoped headers take precedence over the generic header.
 */
export function extractByokKey(request: Request): ByokKey | null {
  if (!request?.headers) return null;
  return extractByokKeyFromHeaders(request.headers);
}

/** Header-map variant of extractByokKey for layers holding only `Headers`. */
export function extractByokKeyFromHeaders(headers: Headers | null | undefined): ByokKey | null {
  if (!headers) return null;
  try {
    for (const [header, providerId] of Object.entries(PROVIDER_SCOPED_BYOK_HEADERS)) {
      const value = headers.get(header);
      if (value && value.trim()) {
        return { providerId, key: value.trim() };
      }
    }
    const generic = headers.get(GENERIC_BYOK_HEADER);
    if (generic && generic.trim()) {
      return { providerId: "", key: generic.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Header-only BYOK presence check (§9b). Usage-accounting layers that only
 * hold the client `Headers` (not the full `Request`) use this to decide
 * whether the request rode a user-supplied upstream key — in which case
 * CheapRouter deducts 0 tokens from the reseller plan (the call is billed
 * to the user's own provider account).
 */
export function hasByokHeader(headers: Headers | null | undefined): boolean {
  return extractByokKeyFromHeaders(headers) !== null;
}
