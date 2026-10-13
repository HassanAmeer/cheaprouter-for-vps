/**
 * byok.ts — Multi-User BYOK (Bring Your Own Key) stateless pass-through gate.
 *
 * Reseller users send their personal upstream provider key per-request via
 * headers (`x-upstream-key`, or provider-scoped `x-claude-key` /
 * `x-deepseek-key` / …). When the operator's master BYOK switch is ON,
 * CheapRouter injects that key in place of its own default upstream key so
 * the request is billed to the user's own provider account (0 tokens deducted
 * from the reseller plan). When the switch is OFF, any pass-through key is
 * rejected with 403.
 *
 * The real key material never touches CheapRouter's DB — only a masked
 * reference + a pause toggle live in `user_byok_keys` (see resellerUsers.ts),
 * so the pause check here is a stateless prefix/suffix match against the
 * masked form.
 *
 * @module lib/byok
 */

import { getSettings } from "@/lib/db/settings";
import { getDbInstance } from "@/lib/db/core";
import { errorResponse } from "@cheaproute/open-sse/utils/error.ts";
import { HTTP_STATUS } from "@cheaproute/open-sse/config/constants.ts";

/**
 * Provider-scoped BYOK headers. The header names the provider explicitly, so
 * the pause check can run before routing. A provider-scoped header always
 * wins over the generic `x-upstream-key`.
 */
const PROVIDER_SCOPED_BYOK_HEADERS: Record<string, string> = {
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
const GENERIC_BYOK_HEADER = "x-upstream-key";

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
  for (const [header, providerId] of Object.entries(
    PROVIDER_SCOPED_BYOK_HEADERS
  )) {
    const value = request.headers.get(header);
    if (value && value.trim()) {
      return { providerId, key: value.trim() };
    }
  }
  const generic = request.headers.get(GENERIC_BYOK_HEADER);
  if (generic && generic.trim()) {
    return { providerId: "", key: generic.trim() };
  }
  return null;
}

/**
 * Master BYOK switch (settings.byokEnabled, default ON). When OFF, no
 * pass-through key is accepted.
 */
export async function isByokEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.byokEnabled !== false;
}

/**
 * Whether a BYOK key is paused. Stateless match: the stored `masked_key`
 * has the form `prefix...suffix`; a live key matches when it starts with
 * `prefix` and (when a suffix is recorded) ends with `suffix`.
 */
export function isByokKeyPaused(providerId: string, key: string): boolean {
  const db = getDbInstance();
  const rows = db
    .prepare(
      "SELECT masked_key FROM user_byok_keys WHERE provider_id = ? AND is_paused = 1"
    )
    .all(providerId) as Array<{ masked_key: string }>;
  for (const row of rows) {
    if (matchesMaskedKey(row.masked_key, key)) return true;
  }
  return false;
}

function matchesMaskedKey(masked: string, key: string): boolean {
  const idx = masked.indexOf("...");
  if (idx === -1) return masked === key;
  const prefix = masked.slice(0, idx);
  const suffix = masked.slice(idx + 3);
  if (prefix && !key.startsWith(prefix)) return false;
  if (suffix && !key.endsWith(suffix)) return false;
  return true;
}

/**
 * Gate a request that carries a BYOK pass-through key.
 *
 * Returns a 403 `Response` when the master switch is OFF or the (provider-
 * scoped) key is paused, or `null` when the request may proceed. Requests
 * without any BYOK header always pass through (normal routing).
 */
export async function assertByokAllowed(request: Request): Promise<Response | null> {
  const byok = extractByokKey(request);
  if (!byok) return null;

  if (!(await isByokEnabled())) {
    return errorResponse(
      HTTP_STATUS.FORBIDDEN,
      "BYOK is currently disabled by administrator"
    );
  }

  // Provider-scoped headers name the provider, so the pause check can run
  // here. The generic header's provider is only known after routing; its
  // pause check is applied at credential-selection time (see getProviderCredentials).
  if (byok.providerId && isByokKeyPaused(byok.providerId, byok.key)) {
    return errorResponse(
      HTTP_STATUS.FORBIDDEN,
      "This BYOK key is paused. Resume it to continue routing."
    );
  }
  return null;
}
