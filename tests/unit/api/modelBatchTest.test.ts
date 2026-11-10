/**
 * Parallel model-test engine — regression guard.
 *
 * The batch "Test all models" flow used to probe models one after another,
 * each waiting for the previous one. These tests pin the new contract:
 *
 *  - several models are probed at the same time (bounded by the concurrency),
 *  - the concurrency limit is respected (never more probes in flight than
 *    allowed — the upstream's rate limit depends on it),
 *  - a run of rate-limited results still stops the batch,
 *  - providers that ban burst probes stay strictly sequential,
 *  - paid models are skipped without dispatching when hidePaidModels is on.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveBatchTestConcurrency,
  runModelBatchTest,
  DEFAULT_BATCH_TEST_CONCURRENCY,
  MAX_BATCH_TEST_CONCURRENCY,
  type BatchTestRunner,
} from "../../../src/lib/api/modelBatchTest.ts";

function okResult(modelId: string) {
  return {
    modelId,
    status: "ok" as const,
    latencyMs: 12,
    httpStatus: 200,
    responseText: "pong",
  };
}

function rateLimitedResult(modelId: string) {
  return {
    modelId,
    status: "rate_limited" as const,
    latencyMs: 5,
    httpStatus: 429,
    error: "Rate limited",
    rateLimited: true,
  };
}

/** A runner that records concurrency and resolves after a short delay. */
function trackingRunner(delayMs = 20) {
  const state = { inFlight: 0, maxInFlight: 0, calls: [] as string[] };
  const runTest: BatchTestRunner = async ({ modelId }) => {
    state.calls.push(modelId);
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    state.inFlight -= 1;
    return okResult(modelId);
  };
  return { runTest, state };
}

describe("runModelBatchTest — parallel probing", () => {
  it("probes several models at the same time instead of one by one", async () => {
    const { runTest, state } = trackingRunner(30);
    const outcome = await runModelBatchTest({
      providerId: "openai",
      modelIds: ["m1", "m2", "m3", "m4"],
      runTest,
    });

    assert.equal(Object.keys(outcome.results).length, 4);
    assert.ok(
      state.maxInFlight > 1,
      `expected parallel probes, but max in-flight was ${state.maxInFlight}`
    );
  });

  it("never exceeds the requested concurrency", async () => {
    const { runTest, state } = trackingRunner(25);
    await runModelBatchTest({
      providerId: "openai",
      modelIds: Array.from({ length: 12 }, (_, i) => `m${i}`),
      runTest,
      concurrency: 3,
    });

    assert.ok(
      state.maxInFlight <= 3,
      `expected at most 3 probes in flight, saw ${state.maxInFlight}`
    );
    assert.ok(state.maxInFlight > 1, "expected the batch to run in parallel");
  });

  it("clamps the concurrency to the allowed range", () => {
    assert.equal(resolveBatchTestConcurrency("openai", 0), 1);
    assert.equal(resolveBatchTestConcurrency("openai", 999), MAX_BATCH_TEST_CONCURRENCY);
    assert.equal(resolveBatchTestConcurrency("openai", 4), 4);
    assert.equal(resolveBatchTestConcurrency("openai", undefined), DEFAULT_BATCH_TEST_CONCURRENCY);
  });

  it("keeps burst-banned providers sequential", () => {
    assert.equal(resolveBatchTestConcurrency("lmarena", 8), 1);
  });

  it("stops the batch after consecutive rate-limited results", async () => {
    let call = 0;
    const runTest: BatchTestRunner = async ({ modelId }) => {
      call += 1;
      // Every result is rate limited → the batch must stop early.
      return rateLimitedResult(modelId);
    };

    const outcome = await runModelBatchTest({
      providerId: "openai",
      modelIds: Array.from({ length: 20 }, (_, i) => `m${i}`),
      runTest,
      concurrency: 1,
    });

    assert.equal(outcome.stoppedEarly, true);
    assert.equal(outcome.stopReason, "consecutive_rate_limits");
    assert.ok(call < 20, `expected an early stop, but ${call} models were probed`);
  });

  it("reports every result through the onResult callback", async () => {
    const { runTest } = trackingRunner(5);
    const seen: string[] = [];
    await runModelBatchTest({
      providerId: "openai",
      modelIds: ["a", "b", "c"],
      runTest,
      onResult: (modelId, entry) => {
        seen.push(modelId);
        assert.equal(entry.status, "ok");
      },
    });

    assert.deepEqual(seen.sort(), ["a", "b", "c"]);
  });

  it("skips paid models without dispatching them", async () => {
    const { runTest, state } = trackingRunner(5);
    const outcome = await runModelBatchTest({
      providerId: "openai",
      modelIds: ["paid-model-1", "paid-model-2"],
      runTest,
      hidePaidModels: true,
    });

    assert.equal(state.calls.length, 0, "paid models must not reach the upstream");
    assert.equal(Object.keys(outcome.results).length, 2);
    assert.match(outcome.results["paid-model-1"].error ?? "", /Skipped/);
  });
});
