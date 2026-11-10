/**
 * Provider guide model rows — accuracy regression guard.
 *
 * The guide sheet ("Free / Limits" tab) used to render a hand-written model
 * list per provider. Those rows drifted out of sync with the router: retired
 * model ids were still offered for copy+route, context windows were wrong, and
 * ~92% of providers showed no models at all.
 *
 * These tests pin the fixed contract:
 *  - only models the router can actually serve are listed (registry / free
 *    catalog / live discovery — never a retired hand-written id),
 *  - the context window comes from a catalog source when one knows it,
 *  - every row says whether it is free or paid, and paid rows carry the price,
 *  - providers without a hand-written guide now show their real models.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildGuideModelRows } from "../../../src/lib/providers/guideModelRows.ts";

/** Ids that the retired hand-written guide still advertised. */
const RETIRED_IDS = [
  "llama-3.3-70b", // Cerebras — retired upstream (real window is 128k, not 8k)
  "llama-3.1-8b", // Cerebras — retired upstream
  "llama-3.1-8b-instant", // Groq — not in the Groq catalog any more
  "mixtral-8x7b-32768", // Groq — not in the Groq catalog any more
  "@cf/meta/llama-3.1-8b-instruct", // Cloudflare — dead id (400/403/410 upstream)
  "@cf/qwen/qwen2.5-72b-instruct", // Cloudflare — dead id
  "glm-5-2", // Cloudflare Playground — real id is zai-org/glm-5.2
  "kimi-k2-7-code", // Cloudflare Playground — real id is moonshotai/kimi-k2.7-code
  "gpt-4o-mini", // ChatGPT web — retired
];

describe("buildGuideModelRows — accuracy", () => {
  it("drops hand-written rows whose model id no longer exists", () => {
    const cerebras = buildGuideModelRows({
      providerId: "cerebras",
      providerName: "Cerebras",
      curated: [
        {
          id: "llama-3.3-70b",
          name: "Llama 3.3 70B",
          pricing: "Free Tier ($0.00)",
          contextWindow: "8k",
        },
        {
          id: "llama-3.1-8b",
          name: "Llama 3.1 8B",
          pricing: "Free Tier ($0.00)",
          contextWindow: "8k",
        },
      ],
    });

    const ids = cerebras.rows.map((row) => row.id);
    assert.ok(!ids.includes("llama-3.3-70b"), "retired Cerebras model must not be listed");
    assert.ok(!ids.includes("llama-3.1-8b"), "retired Cerebras model must not be listed");
    assert.ok(ids.length > 0, "Cerebras must still list its live models");
  });

  it("never lists a retired id for any provider", () => {
    for (const providerId of [
      "groq",
      "cloudflare-ai",
      "cloudflare-playground",
      "chatgpt-web",
      "cerebras",
    ]) {
      const built = buildGuideModelRows({ providerId, providerName: providerId });
      const ids = built.rows.map((row) => row.id);
      for (const retired of RETIRED_IDS) {
        assert.ok(
          !ids.includes(retired),
          `${providerId} must not advertise the retired id "${retired}"`
        );
      }
    }
  });

  it("takes the context window from the catalog, not from a hand-written claim", () => {
    const uncloseai = buildGuideModelRows({
      providerId: "uncloseai",
      providerName: "UncloseAI",
      pricingMode: "always-free",
    });
    const qwen = uncloseai.rows.find((row) => row.id === "turboderp/Qwen3.8-27B-exl3");
    assert.ok(qwen, "the live UncloseAI model must be listed");
    assert.equal(qwen.contextWindow, "64k ctx");
    assert.ok(qwen.isFree, "a keyless provider's models are free");
  });

  it("marks paid models as paid and shows their price", () => {
    const openai = buildGuideModelRows({ providerId: "openai", providerName: "OpenAI" });
    const gpt4o = openai.rows.find((row) => row.id === "gpt-4o");
    assert.ok(gpt4o, "gpt-4o must be listed for OpenAI");
    assert.equal(gpt4o.isFree, false);
    assert.equal(gpt4o.pricing, "Paid");
    assert.match(gpt4o.notes ?? "", /per 1M tokens/);
  });

  it("lists the documented free models with their real quota", () => {
    const groq = buildGuideModelRows({ providerId: "groq", providerName: "Groq" });
    const free = groq.rows.filter((row) => row.isFree);
    assert.ok(free.length > 0, "Groq publishes a free tier — free models must be listed");
    assert.ok(
      free.some((row) => row.dailyQuota && row.dailyQuota.includes("tokens/mo")),
      "a documented free model must carry its quota"
    );
    assert.ok(groq.freeCount > 0 && groq.freeCount <= groq.total);
  });

  it("shows real models for a provider that has no hand-written guide", () => {
    // Before the fix the fallback read a `models` key no provider definition
    // had, so every provider without a hand-written guide showed an empty list.
    const built = buildGuideModelRows({ providerId: "openai", providerName: "OpenAI" });
    assert.ok(built.total >= 10, `expected the OpenAI catalog to be listed, got ${built.total}`);
  });

  it("prefers the live-discovered context window", () => {
    const built = buildGuideModelRows({
      providerId: "openai",
      providerName: "OpenAI",
      liveModels: [{ id: "gpt-4o", name: "GPT-4o", contextWindow: 123456 }],
    });
    const gpt4o = built.rows.find((row) => row.id === "gpt-4o");
    assert.ok(gpt4o);
    assert.equal(gpt4o.contextWindow, "121k ctx");
  });

  it("keeps a curated row that still matches a live model", () => {
    const built = buildGuideModelRows({
      providerId: "groq",
      providerName: "Groq",
      curated: [
        {
          id: "llama-3.3-70b-versatile",
          name: "Llama 3.3 70B",
          pricing: "Free Tier ($0.00)",
          notes: "Fastest 70B reasoning (300+ tok/s)",
        },
      ],
    });
    const row = built.rows.find((entry) => entry.id === "llama-3.3-70b-versatile");
    assert.ok(row, "a curated row whose model is still live must survive");
    assert.equal(row.notes, "Fastest 70B reasoning (300+ tok/s)");
  });
});
