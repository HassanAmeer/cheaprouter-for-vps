/**
 * OpenCode Free Lane — Bypass Setup
 *
 * Is folder ka main entry point. Yahan se sab kuch export hota hai.
 *
 * ## Enable/Disable karna:
 *
 * ### Option 1: Environment variable (recommended)
 * ```
 * OPENCODE_BYPASS_ENABLED=true
 * ```
 *
 * ### Option 2: Direct import me check
 * ```ts
 * import { OPENCODE_BYPASS_ENABLED } from "@t3tools/provider-opencode/opencode-bypass-setup"
 * if (OPENCODE_BYPASS_ENABLED) { ... }
 * ```
 *
 * ## RAM Usage:
 * - Enabled: ~0 MB extra (website ke existing process me chalega)
 * - Disabled: 0 MB (koi code load hi nahi hoga jab tak import na ho)
 *
 * ## Future RAM/ROM boost plans:
 * - [ ] Session caching (ek hi session ko reuse karo)
 * - [ ] Request queue (concurrent requests throttle karo server load ke liye)
 * - [ ] Response cache (same prompt ke liye cached response do)
 *
 * @module provider-opencode/opencode-bypass-setup
 */

export {
  OPENCODE_BYPASS_ENABLED,
  FREE_MODELS,
  bypassChat,
  bypassChatStream,
  resolveChatCompletionsUrl,
} from "./client.ts";
export type {
  BypassChatMessage,
  BypassRequestOptions,
  BypassResponse,
  FreeModel,
} from "./client.ts";
export { mintSession, canonicalizeSession, isCanonicalSession } from "./session.ts";
export {
  CLIENT_UA,
  UPSTREAM_BASE,
  buildBypassHeaders,
  injectFingerprintTools,
  FINGERPRINT_TOOLS,
} from "./fingerprint.ts";
