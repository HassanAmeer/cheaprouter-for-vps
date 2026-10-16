/**
 * T-08 options-schema tests.
 *
 * Covers `parseCheapRouterPluginOptions(opts)` — the strict Zod gate that
 * validates the second-arg `PluginOptions` bag from opencode.json before
 * any hook is wired. Anti-pattern checklist mirrored here:
 *
 *  - `null` / `undefined` must collapse to `{}` (defaults apply downstream).
 *  - Unknown keys must THROW (`.strict()` catches opencode.json typos).
 *  - Validation runs at parse time, not import time (module loads cleanly).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { parseCheapRouterPluginOptions } from "../src/index.js";

test("parseCheapRouterPluginOptions: undefined → {}", () => {
  assert.deepEqual(parseCheapRouterPluginOptions(undefined), {});
});

test("parseCheapRouterPluginOptions: null → {}", () => {
  assert.deepEqual(parseCheapRouterPluginOptions(null), {});
});

test("parseCheapRouterPluginOptions: empty object → {}", () => {
  assert.deepEqual(parseCheapRouterPluginOptions({}), {});
});

test("parseCheapRouterPluginOptions: valid providerId → returns it", () => {
  const r = parseCheapRouterPluginOptions({ providerId: "cheaprouter-preprod" });
  assert.equal(r.providerId, "cheaprouter-preprod");
});

test("parseCheapRouterPluginOptions: invalid providerId (special chars) → throws", () => {
  assert.throws(
    () => parseCheapRouterPluginOptions({ providerId: "cheaprouter prod!" }),
    /providerId.*slug/i
  );
});

test("parseCheapRouterPluginOptions: empty providerId → throws", () => {
  assert.throws(() => parseCheapRouterPluginOptions({ providerId: "" }), /providerId/i);
});

test("parseCheapRouterPluginOptions: valid modelCacheTtl → returns it", () => {
  const r = parseCheapRouterPluginOptions({ modelCacheTtl: 60_000 });
  assert.equal(r.modelCacheTtl, 60_000);
});

test("parseCheapRouterPluginOptions: negative modelCacheTtl → throws", () => {
  assert.throws(() => parseCheapRouterPluginOptions({ modelCacheTtl: -1 }), /modelCacheTtl/i);
});

test("parseCheapRouterPluginOptions: zero modelCacheTtl → throws (positive required)", () => {
  assert.throws(() => parseCheapRouterPluginOptions({ modelCacheTtl: 0 }), /modelCacheTtl/i);
});

test("parseCheapRouterPluginOptions: invalid baseURL (not a URL) → throws", () => {
  assert.throws(() => parseCheapRouterPluginOptions({ baseURL: "not-a-url" }), /baseURL/i);
});

test("parseCheapRouterPluginOptions: baseURL without an http(s) scheme → throws", () => {
  // `new URL()` reads "localhost:20128" as the scheme "localhost:" followed by
  // a path, so the address parses and the models are published with an api url
  // no client can call.
  for (const baseURL of ["localhost:20128", "localhost:20128/v1", "ftp://or.example.com", "or.example.com"]) {
    assert.throws(
      () => parseCheapRouterPluginOptions({ baseURL }),
      /baseURL must be an http\(s\) URL/,
      `expected ${baseURL} to be rejected`
    );
  }
});

test("parseCheapRouterPluginOptions: http and https baseURLs are accepted, padding trimmed", () => {
  for (const baseURL of ["http://localhost:20128", "https://or.example.com/v1"]) {
    assert.equal(parseCheapRouterPluginOptions({ baseURL }).baseURL, baseURL);
    assert.equal(parseCheapRouterPluginOptions({ baseURL: `  ${baseURL}  ` }).baseURL, baseURL);
  }
});

test("parseCheapRouterPluginOptions: unknown key → throws (strict mode catches typos)", () => {
  assert.throws(
    () =>
      parseCheapRouterPluginOptions({
        providerId: "cheaprouter",
        provider_id: "typo-here",
      }),
    /provider_id|unrecognized/i
  );
});

test("parseCheapRouterPluginOptions: all four fields populated correctly → returns them", () => {
  const opts = {
    providerId: "cheaprouter-prod",
    displayName: "CheapRouter Production",
    modelCacheTtl: 120_000,
    baseURL: "https://or.example.com/v1",
  };
  const r = parseCheapRouterPluginOptions(opts);
  assert.deepEqual(r, opts);
});

test("parseCheapRouterPluginOptions: error message lists every issue path", () => {
  // Two bad fields at once → error string should mention BOTH.
  try {
    parseCheapRouterPluginOptions({
      providerId: "",
      baseURL: "garbage",
    });
    assert.fail("expected throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert.match(msg, /providerId/);
    assert.match(msg, /baseURL/);
  }
});

test("parseCheapRouterPluginOptions: module import alone does NOT throw", async () => {
  // Re-importing the entry must not trigger validation; validation only fires
  // on explicit parseCheapRouterPluginOptions / CheapRouterPlugin invocation.
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.parseCheapRouterPluginOptions, "function");
});
