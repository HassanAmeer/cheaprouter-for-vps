/**
 * Model context-window resolution — regression guard.
 *
 * The provider detail table's CONTEXT LIMIT column used to read only
 * `contextWindowOverride` / `max_input_tokens` / `inputTokenLimit`, so every
 * STATIC catalog model showed "—" even though the registry and the model specs
 * know the window.
 *
 * These tests pin the resolution chain:
 *   override → synced row limit → registry model → registry provider default
 *   → static model spec → authoritative per-provider / per-model map.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatContextWindowLabel,
  getRegistryModelContextLength,
  getRegistryProviderContextLength,
  resolveModelContextWindow,
} from "../../../src/lib/providers/modelContextWindow.ts";

describe("resolveModelContextWindow", () => {
  it("uses the operator override first", () => {
    const resolved = resolveModelContextWindow({
      providerId: "openai",
      modelId: "gpt-4o",
      override: 42_000,
      registryContextLength: 128_000,
    });
    assert.equal(resolved, 42_000);
  });

  it("falls back to the synced row limit", () => {
    const resolved = resolveModelContextWindow({
      providerId: "openai",
      modelId: "gpt-4o",
      syncedMaxInputTokens: 64_000,
      registryContextLength: 128_000,
    });
    assert.equal(resolved, 64_000);
  });

  it("uses the registry model's own context length", () => {
    const resolved = resolveModelContextWindow({
      providerId: "uncloseai",
      modelId: "turboderp/Qwen3.8-27B-exl3",
    });
    assert.equal(resolved, 65_536);
    assert.equal(getRegistryModelContextLength("uncloseai", "turboderp/Qwen3.8-27B-exl3"), 65_536);
  });

  it("falls back to the registry provider default", () => {
    const resolved = resolveModelContextWindow({
      providerId: "antseed",
      modelId: "some-model-without-a-window",
    });
    assert.equal(resolved, getRegistryProviderContextLength("antseed"));
    assert.equal(resolved, 200_000);
  });

  it("uses the static model spec when the registry knows nothing", () => {
    // gpt-6-astra carries its window in the shared model specs.
    const resolved = resolveModelContextWindow({
      providerId: "openai",
      modelId: "gpt-6-astra",
    });
    assert.equal(typeof resolved, "number");
    assert.ok((resolved as number) > 0);
  });

  it("returns undefined when no source knows the window", () => {
    // sambanova has neither a registry default nor a spec for this id.
    const resolved = resolveModelContextWindow({
      providerId: "sambanova",
      modelId: "totally-unknown-model-id",
    });
    assert.equal(resolved, undefined);
  });

  it("falls back to the registry provider default for unknown model ids", () => {
    // openai declares defaultContextLength = 128000, so even an unknown model
    // id resolves to that (a real, sourced number — never a silent guess).
    const resolved = resolveModelContextWindow({
      providerId: "openai",
      modelId: "totally-unknown-model-id",
    });
    assert.equal(resolved, getRegistryProviderContextLength("openai"));
  });
});

describe("formatContextWindowLabel", () => {
  it("formats known windows", () => {
    assert.equal(formatContextWindowLabel(1_048_576), "1.0M");
    assert.equal(formatContextWindowLabel(131_072), "131K");
    assert.equal(formatContextWindowLabel(65_536), "66K");
  });

  it("renders an em dash for unknown windows", () => {
    assert.equal(formatContextWindowLabel(undefined), "—");
    assert.equal(formatContextWindowLabel(null), "—");
    assert.equal(formatContextWindowLabel(0), "—");
  });
});
