/**
 * Parallel model-test engine.
 *
 * The batch "Test all models" flow used to probe every model SEQUENTIALLY:
 * one model at a time, each waiting for the previous one to finish (or time
 * out at 30s). Testing 40 models therefore cost 40 x latency — most of it
 * spent waiting, not working.
 *
 * This engine runs the same probes with BOUNDED PARALLELISM: a fixed pool of
 * workers pulls models from a shared queue, so N models are in flight at once
 * while the number of concurrent upstream requests stays capped (protecting
 * the provider's rate limit, the connection's Bottleneck and the upstream
 * itself).
 *
 * Everything else about a probe is unchanged — same runner, same skip rules,
 * same persistence (auto-hide + test customization), same early-stop
 * protections:
 *
 *  - a run of consecutive rate-limited results stops the batch (a 429 storm
 *    means the upstream is down; the remaining models would only burn the
 *    timeout window),
 *  - web-session providers that ban burst probes (Arena) stay strictly
 *    sequential with a fixed inter-model delay,
 *  - paid models are skipped without dispatching when `hidePaidModels` is on.
 */
import {
  DEFAULT_MODEL_TEST_TIMEOUT_MS,
  type SingleModelTestResult,
} from "@/lib/api/modelTestRunner";
import { setModelIsHidden } from "@/lib/db/models";
import { upsertCustomization } from "@/lib/db/providerModelCustomizations";
import { sanitizeErrorMessage } from "@cheaproute/open-sse/utils/error";
import { isFreeModel, providerHasFreeModels } from "@/shared/utils/freeModels";
import * as log from "@/sse/utils/logger";

export interface BatchTestResultEntry {
  status: "ok" | "error" | "slow";
  latencyMs: number;
  responseText?: string;
  error?: string;
  statusCode?: number;
  rateLimited?: boolean;
  isTransient?: boolean;
  isQuota?: boolean;
  hidden?: boolean;
  isTimeout?: boolean;
  skipped?: boolean;
}

export type BatchStopReason = "consecutive_rate_limits" | "consecutive_bot_blocks";

/** Injectable probe runner (tests inject a fake; production uses the real one). */
export type BatchTestRunner = (options: {
  providerId: string;
  modelId: string;
  connectionId?: string;
  timeoutMs: number;
  streamChat: boolean;
}) => Promise<SingleModelTestResult>;

export interface BatchTestOptions {
  providerId: string;
  modelIds: string[];
  connectionId?: string;
  /** When false, the connection's rate limiter is bypassed (honour the upstream). */
  respectRateLimit?: boolean;
  /** Persist a hard failure as "hidden" (never for rate-limit/timeout/quota). */
  autoHideFailed?: boolean;
  /** Skip paid models without dispatching (mirrors `hidePaidModels`). */
  hidePaidModels?: boolean;
  /** Concurrent probes for this provider (clamped to 1..MAX). */
  concurrency?: number;
  /** Called as soon as each model's result is known (used for streaming). */
  onResult?: (modelId: string, entry: BatchTestResultEntry) => void | Promise<void>;
  /** Injected runner (tests). */
  runTest?: BatchTestRunner;
}

export interface BatchTestOutcome {
  results: Record<string, BatchTestResultEntry>;
  stoppedEarly: boolean;
  stopReason?: BatchStopReason;
  /** How many models were actually dispatched upstream. */
  tested: number;
}

export const CONSECUTIVE_RATE_LIMIT_STOP_THRESHOLD = 3;
export const CONSECUTIVE_BOT_STOP_THRESHOLD = 2;
/** Web-session providers (esp. Arena/CF) ban burst probes — pause between models. */
export const SLOW_PROBE_PROVIDERS = new Set(["lmarena", "lma"]);
/** Fixed inter-model delay for SLOW_PROBE_PROVIDERS (no env — avoids doc-sync drift). */
export const SLOW_PROBE_DELAY_MS = 3500;

/** Default number of models probed at the same time. */
export const DEFAULT_BATCH_TEST_CONCURRENCY = 6;
/** Hard ceiling — a burst bigger than this trips upstream rate limits. */
export const MAX_BATCH_TEST_CONCURRENCY = 16;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve how many probes may run at once for a provider.
 *
 * Env override: `MODEL_TEST_ALL_CONCURRENCY` (1..16). Providers that ban
 * burst probes are pinned to 1 regardless.
 */
export function resolveBatchTestConcurrency(providerId: string, requested?: number): number {
  if (SLOW_PROBE_PROVIDERS.has(providerId)) return 1;

  const fromEnv = Number(process.env.MODEL_TEST_ALL_CONCURRENCY);
  const candidate =
    typeof requested === "number" && Number.isFinite(requested)
      ? requested
      : Number.isFinite(fromEnv) && fromEnv > 0
        ? fromEnv
        : DEFAULT_BATCH_TEST_CONCURRENCY;

  return Math.max(1, Math.min(Math.floor(candidate), MAX_BATCH_TEST_CONCURRENCY));
}

export function toBatchEntry(result: SingleModelTestResult): BatchTestResultEntry {
  const entry: BatchTestResultEntry = {
    status: result.status === "ok" ? "ok" : result.status === "slow" ? "slow" : "error",
    latencyMs: result.latencyMs,
  };
  if (result.responseText !== undefined) entry.responseText = result.responseText;
  if (result.error !== undefined) entry.error = result.error;
  if (result.statusCode !== undefined) entry.statusCode = result.statusCode;
  if (result.rateLimited === true) entry.rateLimited = true;
  if (result.isTransient === true) entry.isTransient = true;
  if (result.isQuota === true) entry.isQuota = true;
  if (result.isTimeout === true) entry.isTimeout = true;
  if (result.skipped === true) entry.skipped = true;
  return entry;
}

/**
 * Whether a result looks like a bot-management / Cloudflare block.
 * Quota errors (403 "insufficient balance") are NOT bot blocks (#9511).
 */
export function isBotBlockedEntry(entry: BatchTestResultEntry): boolean {
  return (
    !entry.isQuota &&
    (entry.statusCode === 403 ||
      (typeof entry.error === "string" &&
        /cloudflare|bot management|recaptcha|cf-chl|just a moment/i.test(entry.error)))
  );
}

/**
 * Probe every model of a provider, several at a time.
 *
 * Results are reported through `onResult` as soon as each probe finishes, so
 * a streaming caller can paint them live instead of waiting for the whole
 * batch.
 */
export async function runModelBatchTest(options: BatchTestOptions): Promise<BatchTestOutcome> {
  const {
    providerId,
    modelIds,
    connectionId,
    respectRateLimit = true,
    autoHideFailed = false,
    hidePaidModels = false,
    onResult,
  } = options;

  const runTest: BatchTestRunner =
    options.runTest ??
    (async ({ providerId: pid, modelId, connectionId: connId, timeoutMs, streamChat }) => {
      // Imported lazily so this module stays light for callers that inject
      // their own runner (tests) — the real runner pulls in the whole request
      // pipeline (chat/responses/embeddings routes).
      const { runSingleModelTest } = await import("@/lib/api/modelTestRunner");
      return runSingleModelTest({
        providerId: pid,
        modelId,
        ...(connId ? { connectionId: connId } : {}),
        timeoutMs,
        streamChat,
      });
    });

  const results: Record<string, BatchTestResultEntry> = {};
  const concurrency = resolveBatchTestConcurrency(providerId, options.concurrency);
  const slowProbe = SLOW_PROBE_PROVIDERS.has(providerId);
  // `runSingleModelTest` only engages the Bottleneck rate limiter when a
  // connectionId is provided. To honour `respectRateLimit=false` we omit the
  // connectionId so the runner bypasses `withRateLimit`.
  const effectiveConnectionId =
    connectionId && respectRateLimit !== false ? connectionId : undefined;

  let consecutiveRateLimits = 0;
  let consecutiveBotBlocks = 0;
  let stoppedEarly = false;
  let stopReason: BatchStopReason | undefined;
  let cursor = 0;
  let testedUpstream = 0;

  const persistResult = async (modelId: string, entry: BatchTestResultEntry) => {
    if (
      autoHideFailed &&
      entry.status === "error" &&
      !entry.rateLimited &&
      !entry.isTimeout &&
      !entry.isTransient &&
      !entry.isQuota &&
      // #14780: a skipped probe (web-session provider) never ran — not a failure.
      !entry.skipped
    ) {
      try {
        await setModelIsHidden(providerId, modelId, true);
        entry.hidden = true;
        log.info("MODEL_TEST_ALL", `Auto-hidden model ${modelId} after test failure`, {
          providerId,
          modelId,
        });
      } catch (hideError: unknown) {
        log.error("MODEL_TEST_ALL", `Failed to auto-hide model ${modelId}`, {
          providerId,
          modelId,
          error: sanitizeErrorMessage(hideError),
        });
      }
    }

    if (!entry.skipped) {
      try {
        const isOk = entry.status === "ok";
        upsertCustomization({
          providerId,
          originalModelId: modelId,
          isTested: true,
          testStatus: isOk ? "verified" : "failed",
          testHttpStatus: entry.statusCode ?? (isOk ? 200 : 500),
          testLatencyMs: entry.latencyMs,
          testResponse:
            (typeof entry.responseText === "string" ? entry.responseText.slice(0, 500) : null) ||
            (typeof entry.error === "string" ? entry.error.slice(0, 500) : null),
        });
      } catch (custErr) {
        log.warn("MODEL_TEST_ALL", `Failed to persist customization for ${modelId}: ${custErr}`);
      }
    }
  };

  const processModel = async (modelId: string): Promise<void> => {
    // #6328: skip paid ids without dispatching; do not increment
    // consecutiveRateLimits — skip is not a rate-limited failure.
    if (
      hidePaidModels &&
      !(providerHasFreeModels(providerId) && isFreeModel(providerId, { id: modelId }))
    ) {
      const skippedEntry: BatchTestResultEntry = {
        status: "error",
        latencyMs: 0,
        error: "Skipped: paid model with hidePaidModels enabled",
      };
      results[modelId] = skippedEntry;
      await onResult?.(modelId, skippedEntry);
      return;
    }

    let entry: BatchTestResultEntry;
    try {
      // Space out Arena/CF probes — sequential alone still looks like a burst.
      if (slowProbe && testedUpstream > 0 && SLOW_PROBE_DELAY_MS > 0) {
        await sleep(SLOW_PROBE_DELAY_MS);
      }
      const result = await runTest({
        providerId,
        modelId,
        ...(effectiveConnectionId ? { connectionId: effectiveConnectionId } : {}),
        timeoutMs: DEFAULT_MODEL_TEST_TIMEOUT_MS,
        streamChat: true,
      });
      entry = toBatchEntry(result);
      testedUpstream += 1;
    } catch (error: unknown) {
      log.error("MODEL_TEST_ALL", `Unexpected error testing model ${modelId}`, {
        providerId,
        modelId,
        error: sanitizeErrorMessage(error),
      });
      entry = {
        status: "error",
        latencyMs: 0,
        error: sanitizeErrorMessage(error) || "Unknown error",
      };
    }

    if (entry.rateLimited) {
      consecutiveRateLimits += 1;
    } else {
      consecutiveRateLimits = 0;
    }

    // #9511: quota entries (403 with "insufficient balance" etc.) are NOT
    // bot-blocks — they should not count toward the bot-block stop threshold.
    if (isBotBlockedEntry(entry)) {
      consecutiveBotBlocks += 1;
    } else if (entry.status === "ok") {
      consecutiveBotBlocks = 0;
    }

    await persistResult(modelId, entry);
    results[modelId] = entry;
    await onResult?.(modelId, entry);

    log.info(
      "MODEL_TEST_ALL",
      `Tested ${modelId}: ${entry.status}${entry.rateLimited ? " (rate-limited)" : ""}${entry.isTimeout ? " (timeout)" : ""}`,
      {
        providerId,
        modelId,
        latencyMs: entry.latencyMs,
        rateLimited: entry.rateLimited,
        isTimeout: entry.isTimeout,
        hidden: entry.hidden,
      }
    );

    if (consecutiveRateLimits >= CONSECUTIVE_RATE_LIMIT_STOP_THRESHOLD) {
      stoppedEarly = true;
      stopReason = "consecutive_rate_limits";
      log.warn(
        "MODEL_TEST_ALL",
        `Stopping batch early after ${consecutiveRateLimits} consecutive rate-limited results`,
        {
          providerId,
          testedCount: Object.keys(results).length,
          totalCount: modelIds.length,
        }
      );
      return;
    }

    if (slowProbe && consecutiveBotBlocks >= CONSECUTIVE_BOT_STOP_THRESHOLD) {
      stoppedEarly = true;
      stopReason = "consecutive_bot_blocks";
      log.warn(
        "MODEL_TEST_ALL",
        `Stopping batch early after ${consecutiveBotBlocks} consecutive bot/Cloudflare blocks (avoid session ban)`,
        {
          providerId,
          testedCount: Object.keys(results).length,
          totalCount: modelIds.length,
        }
      );
    }
  };

  // Worker pool: `concurrency` workers pull from one shared queue. A worker
  // stops pulling new models as soon as the batch is halted (early stop).
  const worker = async () => {
    for (;;) {
      if (stoppedEarly) return;
      const index = cursor++;
      if (index >= modelIds.length) return;
      await processModel(modelIds[index]);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, modelIds.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    results,
    stoppedEarly,
    ...(stopReason ? { stopReason } : {}),
    tested: testedUpstream,
  };
}
