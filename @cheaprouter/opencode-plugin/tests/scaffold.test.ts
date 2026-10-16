import test from "node:test";
import assert from "node:assert/strict";
import {
  CheapRouterPlugin,
  CHEAPROUTER_PROVIDER_KEY,
  DEFAULT_MODEL_CACHE_TTL_MS,
  resolveCheapRouterPluginOptions,
} from "../src/index.js";

test("scaffold: exports public surface", () => {
  assert.equal(
    typeof CheapRouterPlugin,
    "function",
    "CheapRouterPlugin must be a function (Plugin factory)"
  );
  assert.equal(CHEAPROUTER_PROVIDER_KEY, "cheaprouter");
  assert.equal(DEFAULT_MODEL_CACHE_TTL_MS, 300_000);
});

test("scaffold: default export is v1 plugin shape { id, server: CheapRouterPlugin }", async () => {
  const mod = await import("../src/index.js");
  assert.equal(typeof mod.default, "object");
  assert.equal(mod.default.id, "@cheaprouter/opencode-plugin");
  assert.equal(mod.default.server, mod.CheapRouterPlugin);
});

test("resolveCheapRouterPluginOptions: defaults", () => {
  const r = resolveCheapRouterPluginOptions();
  assert.equal(r.providerId, "opencode-cheaprouter");
  assert.equal(r.displayName, "CheapRouter");
  assert.equal(r.modelCacheTtl, 300_000);
  assert.equal(r.baseURL, undefined);
});

test("resolveCheapRouterPluginOptions: custom providerId derives displayName", () => {
  const r = resolveCheapRouterPluginOptions({ providerId: "cheaprouter-preprod" });
  assert.equal(r.providerId, "opencode-cheaprouter-preprod");
  assert.equal(r.displayName, "CheapRouter (opencode-cheaprouter-preprod)");
});

test("resolveCheapRouterPluginOptions: explicit displayName wins", () => {
  const r = resolveCheapRouterPluginOptions({
    providerId: "cheaprouter-x",
    displayName: "Custom Label",
  });
  assert.equal(r.displayName, "Custom Label");
});

test("resolveCheapRouterPluginOptions: invalid TTL falls back to default", () => {
  assert.equal(resolveCheapRouterPluginOptions({ modelCacheTtl: 0 }).modelCacheTtl, 300_000);
  assert.equal(resolveCheapRouterPluginOptions({ modelCacheTtl: -1 }).modelCacheTtl, 300_000);
});

test("resolveCheapRouterPluginOptions: positive TTL respected", () => {
  assert.equal(resolveCheapRouterPluginOptions({ modelCacheTtl: 60_000 }).modelCacheTtl, 60_000);
});

test("CheapRouterPlugin: returns an empty hooks object (scaffold)", async () => {
  const fakeCtx = {} as Parameters<typeof CheapRouterPlugin>[0];
  const hooks = await CheapRouterPlugin(fakeCtx);
  assert.equal(typeof hooks, "object");
  assert.notEqual(hooks, null);
});

test("scaffold: built ESM default export resolves with the v1 plugin shape", async () => {
  // The plugin is ESM-only now — the CJS bundle was dropped to fix the OpenCode
  // loader (#3883), so there is no more ../dist/index.cjs. Validate that the built
  // distributable's default export still carries the OpenCode v1 { id, server } shape.
  const mod = await import("../dist/index.js");
  assert.strictEqual(typeof mod.default, "object");
  assert.strictEqual(mod.default.id, "@cheaprouter/opencode-plugin");
  assert.strictEqual(typeof mod.default.server, "function");
});
