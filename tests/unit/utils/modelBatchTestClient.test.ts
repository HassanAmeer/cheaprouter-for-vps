/**
 * Parallel model-test client — regression guard.
 *
 * The dashboard used to fire ONE request per model and wait for each to come
 * back. The client now sends one request per provider and consumes the NDJSON
 * stream, so every model is reported the moment its probe resolves.
 *
 * These tests pin:
 *  - each streamed model is reported as soon as its line arrives,
 *  - the progress counter advances per model,
 *  - a non-NDJSON (legacy JSON) response still works,
 *  - a network failure marks every model of that group as failed,
 *  - groups (providers) are probed in parallel, bounded by groupConcurrency.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  runParallelModelTests,
  type ModelTestEntry,
} from "../../../src/shared/utils/modelBatchTestClient.ts";

type FetchArgs = [input: string, init?: RequestInit];

const originalFetch = globalThis.fetch;

function ndjsonResponse(lines: string[]): Response {
  const body = lines.map((line) => `${line}\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runParallelModelTests — parallel client", () => {
  let calls: FetchArgs[] = [];

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports every streamed model as its line arrives", async () => {
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      calls.push([input, init]);
      return ndjsonResponse([
        JSON.stringify({ modelId: "m1", entry: { status: "ok", latencyMs: 10 } }),
        JSON.stringify({ modelId: "m2", entry: { status: "error", error: "boom" } }),
        JSON.stringify({ done: true, tested: 2 }),
      ]);
    }) as typeof fetch;

    const seen: Array<{ modelId: string; entry: ModelTestEntry }> = [];
    const progress: number[] = [];

    const summary = await runParallelModelTests({
      groups: [{ providerId: "openai", modelIds: ["m1", "m2"] }],
      onResult: ({ modelId, entry }) => {
        seen.push({ modelId, entry });
      },
      onProgress: (done) => progress.push(done),
    });

    assert.equal(calls.length, 1, "one request per provider");
    assert.equal(seen.length, 2);
    assert.equal(seen[0].modelId, "m1");
    assert.equal(seen[0].entry.status, "ok");
    assert.equal(seen[1].entry.status, "error");
    assert.deepEqual(progress, [1, 2]);
    assert.equal(summary.ok, 1);
    assert.equal(summary.error, 1);
    assert.equal(summary.total, 2);
  });

  it("sends every model of the provider in one request", async () => {
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      calls.push([input, init]);
      return ndjsonResponse([]);
    }) as typeof fetch;

    const modelIds = Array.from({ length: 40 }, (_, i) => `m${i}`);
    await runParallelModelTests({
      groups: [{ providerId: "openai", modelIds }],
      onResult: () => {},
    });

    assert.equal(calls.length, 1);
    const body = JSON.parse(String(calls[0][1]?.body));
    assert.equal(body.modelIds.length, 40);
    assert.equal(body.stream, true);
  });

  it("falls back to a legacy JSON response", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        results: {
          m1: { status: "ok", latencyMs: 5 },
          m2: { status: "error", error: "nope" },
        },
      })) as typeof fetch;

    const seen: string[] = [];
    const summary = await runParallelModelTests({
      groups: [{ providerId: "openai", modelIds: ["m1", "m2"] }],
      onResult: ({ modelId }) => {
        seen.push(modelId);
      },
    });

    assert.deepEqual(seen.sort(), ["m1", "m2"]);
    assert.equal(summary.ok, 1);
    assert.equal(summary.error, 1);
  });

  it("marks every model as failed when the request fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;

    const seen: string[] = [];
    const summary = await runParallelModelTests({
      groups: [{ providerId: "openai", modelIds: ["m1", "m2"] }],
      onResult: ({ modelId }) => {
        seen.push(modelId);
      },
    });

    assert.deepEqual(seen.sort(), ["m1", "m2"]);
    assert.equal(summary.ok, 0);
    assert.equal(summary.error, 2);
  });

  it("probes different providers in parallel", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    globalThis.fetch = (async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 25));
      inFlight -= 1;
      return ndjsonResponse([
        JSON.stringify({ modelId: "m1", entry: { status: "ok" } }),
        JSON.stringify({ done: true }),
      ]);
    }) as typeof fetch;

    await runParallelModelTests({
      groups: [
        { providerId: "openai", modelIds: ["m1"] },
        { providerId: "groq", modelIds: ["m2"] },
        { providerId: "cerebras", modelIds: ["m3"] },
      ],
      groupConcurrency: 2,
      onResult: () => {},
    });

    assert.ok(maxInFlight > 1, "providers must be probed at the same time");
    assert.ok(maxInFlight <= 2, `group concurrency exceeded: ${maxInFlight}`);
  });
});
