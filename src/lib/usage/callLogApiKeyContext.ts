import { AsyncLocalStorage } from "node:async_hooks";

export interface CallLogApiKeyContext {
  apiKeyId: string | null;
  apiKeyName: string | null;
  /**
   * Multi-tenant site scope resolved for this request (`null` = global).
   *
   * Persisted as `site_id` on `call_logs` and `usage_history` so the dashboard
   * can filter usage/logs per website without threading a parameter through
   * every provider handler.
   */
  siteId?: string | null;
}

const callLogApiKeyContext = new AsyncLocalStorage<CallLogApiKeyContext>();

/**
 * Bind API-key attribution to every call log emitted by one request.
 *
 * Modal handlers fan out into provider-specific helpers that write their own
 * call logs. Request-scoped storage keeps that attribution available without
 * threading identity parameters through every provider handler.
 */
export function runWithCallLogApiKeyContext<TResult>(
  context: CallLogApiKeyContext,
  callback: () => TResult
): TResult {
  return callLogApiKeyContext.run(context, callback);
}

export function getCallLogApiKeyContext(): CallLogApiKeyContext | null {
  return callLogApiKeyContext.getStore() ?? null;
}

/**
 * The site scope bound to the current request, or `null` for the global scope.
 * Used by the log/usage writers as a fallback when the entry carries no siteId.
 */
export function getCallLogSiteId(): string | null {
  const siteId = callLogApiKeyContext.getStore()?.siteId;
  return typeof siteId === "string" && siteId.trim() !== "" ? siteId.trim() : null;
}
