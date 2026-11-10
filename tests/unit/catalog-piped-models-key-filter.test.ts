import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CatalogModelRow } from "../../src/app/api/v1/models/catalogPipedModels.ts";
import {
  buildPipedModelRow,
  ensurePipedModelRows,
  isPipedModelRowPresent,
  pipedModelRowId,
} from "../../src/app/api/v1/models/catalogPipedModels.ts";

// Regression guard (live incident 2026-11-10): the "Pipe Models" rows
// (provider_model_customizations) are re-added to the /v1/models catalog AFTER
// the per-API-key filter ran, so a key with modelAccessMode="restricted" and an
// empty allowedModels list still saw every piped model — while dispatch answered
// 403 for the same ids. The catalog contradicted the key.
describe("piped model rows honour the per-key model authorizer", () => {
  const cust = {
    providerId: "pollinations-text",
    originalModelId: "openai-fast",
    customAlias: null,
    customName: "OpenAI Fast",
    contextWindow: 8192,
  };

  it("publishes the customization under <provider>/<model> (or its custom alias)", () => {
    assert.equal(pipedModelRowId(cust), "pollinations-text/openai-fast");
    assert.equal(pipedModelRowId({ ...cust, customAlias: "fast" }), "fast");
    const row = buildPipedModelRow(cust, 1700000000);
    assert.equal(row.id, "pollinations-text/openai-fast");
    assert.equal(row.owned_by, "pollinations-text");
    assert.equal(row.root, "openai-fast");
    assert.equal(row.name, "OpenAI Fast");
    assert.equal(row.context_length, 8192);
  });

  it("detects an already-present row (by provider/model or by custom alias)", () => {
    const models = [
      { id: "pollinations-text/openai-fast", owned_by: "pollinations-text", root: "openai-fast" },
    ];
    // provider/model match — a customization with a custom alias is still
    // "present" when the underlying provider/model row is listed.
    assert.equal(isPipedModelRowPresent(models, cust), true);
    assert.equal(isPipedModelRowPresent(models, { ...cust, customAlias: "fast" }), true);
    assert.equal(
      isPipedModelRowPresent([{ id: "fast", owned_by: "pollinations-text" }], {
        ...cust,
        customAlias: "fast",
      }),
      true
    );
    assert.equal(isPipedModelRowPresent(models, { ...cust, originalModelId: "other" }), false);
  });

  it("re-adds the row when the key has no model restrictions", async () => {
    const models: CatalogModelRow[] = [];
    await ensurePipedModelRows(models, [cust], { timestamp: 1700000000 });
    assert.equal(models.length, 1);
    assert.equal(models[0].id, "pollinations-text/openai-fast");
  });

  it("does NOT re-add the row when the key authorizer rejects it", async () => {
    const models: CatalogModelRow[] = [];
    const seen: string[] = [];
    await ensurePipedModelRows(models, [cust], {
      timestamp: 1700000000,
      authorize: async (row) => {
        seen.push(String(row.id));
        return false;
      },
    });
    assert.deepEqual(seen, ["pollinations-text/openai-fast"]);
    assert.equal(models.length, 0);
  });

  it("re-adds the row when the key authorizer accepts it", async () => {
    const models: CatalogModelRow[] = [];
    await ensurePipedModelRows(models, [cust], {
      timestamp: 1700000000,
      authorize: async () => true,
    });
    assert.equal(models.length, 1);
  });

  it("never duplicates a row that is already listed", async () => {
    const models: CatalogModelRow[] = [
      { id: "pollinations-text/openai-fast", owned_by: "pollinations-text", root: "openai-fast" },
    ];
    await ensurePipedModelRows(models, [cust], { timestamp: 1700000000 });
    assert.equal(models.length, 1);
  });

  it("does NOT re-add a row of a blocked provider", async () => {
    const models: CatalogModelRow[] = [];
    await ensurePipedModelRows(models, [cust], {
      timestamp: 1700000000,
      isBlockedProvider: (providerId) => providerId === "pollinations-text",
    });
    assert.equal(models.length, 0);
  });

  it("re-adds a row of a provider that is not blocked", async () => {
    const models: CatalogModelRow[] = [];
    await ensurePipedModelRows(models, [cust], {
      timestamp: 1700000000,
      isBlockedProvider: () => false,
    });
    assert.equal(models.length, 1);
  });
});
