import { resolveProviderServiceKinds } from "@cheaproute/open-sse/config/mediaServiceKinds.ts";

/**
 * Full serviceKinds for a provider — the declared ones (llm, web*, imageToText)
 * unioned with the registry-derived media kinds (image / video / music / tts /
 * stt / embedding). This is the single client-side source of truth for the
 * `/dashboard/providers` category (serviceKind) filter (#4240).
 *
 * Client-safe: `mediaServiceKinds` only pulls in the pure-data media registries
 * (no server-only deps). Results are memoised per providerId+declared signature
 * because the filter calls this once per provider on every keystroke/render.
 */
const _cache = new Map<string, readonly string[]>();

export function getProviderServiceKinds(
  providerId: string,
  declared?: readonly string[] | null
): readonly string[] {
  const key = `${providerId}\u0000${(declared ?? []).join(",")}`;
  const cached = _cache.get(key);
  if (cached) return cached;
  const kinds = resolveProviderServiceKinds(providerId, declared ?? undefined);
  _cache.set(key, kinds);
  return kinds;
}

/** True when the provider supports `kind` (declared or registry-derived). */
export function providerHasServiceKind(
  providerId: string,
  declared: readonly string[] | null | undefined,
  kind: string
): boolean {
  return getProviderServiceKinds(providerId, declared).includes(kind);
}
