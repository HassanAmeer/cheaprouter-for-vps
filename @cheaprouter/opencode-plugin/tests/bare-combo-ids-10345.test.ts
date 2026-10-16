import test from "node:test";
import assert from "node:assert/strict";

import { mapRawModelToModelV2 } from "../src/index.ts";

test("mapRawModelToModelV2: bare combo ids stay unprefixed (#10345)", () => {
  const combo = mapRawModelToModelV2(
    {
      id: "gpt-5.6-sol",
      owned_by: "combo",
      context_length: 272000,
      max_output_tokens: 8192,
    },
    { providerId: "cheaprouter", baseURL: "https://or.example.com/v1" }
  );
  assert.equal(combo.id, "gpt-5.6-sol");
  assert.equal(combo.providerID, "cheaprouter");

  const slashed = mapRawModelToModelV2(
    {
      id: "cx/gpt-5.6-sol",
      owned_by: "combo",
      context_length: 272000,
    },
    { providerId: "cheaprouter", baseURL: "https://or.example.com/v1" }
  );
  assert.equal(slashed.id, "cx/gpt-5.6-sol");

  const ordinary = mapRawModelToModelV2(
    { id: "claude-primary", context_length: 200000 },
    { providerId: "cheaprouter", baseURL: "https://or.example.com/v1" }
  );
  assert.equal(ordinary.id, "cheaprouter/claude-primary");
});
