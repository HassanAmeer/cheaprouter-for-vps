/**
 * OpenCode Free Lane — Bypass Setup
 *
 * Is folder ka main entry point. Yahan se sab kuch export hota hai.
 *
 * @module provider-opencode/opencode-bypass-setup
 */

export {
  OPENCODE_BYPASS_ENABLED,
  FREE_MODELS,
  bypassChat,
  bypassChatStream,
  resolveChatEndpoint,
  resolveChatCompletionsUrl,
} from "./client.ts";
export type {
  BypassChatMessage,
  BypassRequestOptions,
  BypassResponse,
  FreeModel,
} from "./client.ts";
export {
  mintSession,
  canonicalizeSession,
  isCanonicalSession,
  getCurrentSession,
  rotateSession,
  SESSION_RE,
  SESSION_DESCENDING_RE,
} from "./session.ts";
export {
  CLIENT_UA,
  UPSTREAM_BASE,
  buildBypassHeaders,
  injectFingerprintTools,
  FINGERPRINT_TOOLS,
  FINGERPRINT_TOOL_DEFINITIONS,
} from "./fingerprint.ts";
export {
  getBypassDispatcher,
  setBypassDispatcherForTest,
} from "./dispatcher.ts";
