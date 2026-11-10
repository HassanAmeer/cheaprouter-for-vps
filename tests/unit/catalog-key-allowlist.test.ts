import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Regression guard: a per-API-key model allow-list (`modelAccessMode:
 * "restricted"` + `allowedModels`) must restrict the `GET /v1/models` catalog,
 * not only dispatch.
 *
 * The catalog builder re-adds the operator's "piped" models (provider model
 * customizations) AFTER the per-key filter has run. When that re-add skipped
 * the key policy, a restricted key still saw every piped model of every
 * provider in `/v1/models`, even though dispatch answered
 * "Model X is not allowed for this API key" for the very same ids.
 *
 * The listing must never contradict dispatch: a key may only be offered the
 * models it is actually allowed to use.
 */

// The SQLite path is resolved from DATA_DIR when the db module is first
// imported, so the throwaway data dir has to be configured BEFORE anything
// pulls in `src/lib/db/core.ts` — hence the dynamic imports below.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cheaproute-catalog-key-"));
process.env.DATA_DIR = dataDir;
process.env.SQLITE_FILE = path.join(dataDir, "storage.sqlite");
process.env.API_KEY_SECRET = "0123456789abcdef0123456789abcdef";

const ALLOWED_MODEL = "duckduckgo-web/claude-3-haiku";
const FOREIGN_MODEL = "cloudflare-playground/zai-org/glm-5.2";

type CatalogRow = { id?: string; owned_by?: string };

async function listCatalogIds(apiKey: string): Promise<string[]> {
  const { getUnifiedModelsResponse } = await import("@/app/api/v1/models/catalog");
  const res = await getUnifiedModelsResponse(
    new Request("http://localhost:20128/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data?: CatalogRow[] };
  return (body.data ?? []).map((row) => String(row.id ?? ""));
}

describe("per-API-key model allow-list in the /v1/models catalog", () => {
  let restrictedKey = "";
  let unrestrictedKey = "";

  before(async () => {
    const { createApiKey } = await import("@/lib/db/apiKeys");
    const { upsertCustomization } = await import("@/lib/db/providerModelCustomizations");

    // Two piped models owned by two different providers.
    upsertCustomization({
      providerId: "duckduckgo-web",
      originalModelId: "claude-3-haiku",
      isActive: true,
    });
    upsertCustomization({
      providerId: "cloudflare-playground",
      originalModelId: "zai-org/glm-5.2",
      isActive: true,
    });

    const restricted = await createApiKey("catalog-allowlist-restricted", "unit-test-machine", [], {
      modelAccessMode: "restricted",
      allowedModels: [ALLOWED_MODEL],
    });
    restrictedKey = restricted.key;

    const unrestricted = await createApiKey("catalog-allowlist-open", "unit-test-machine", []);
    unrestrictedKey = unrestricted.key;
  });

  after(async () => {
    const { closeDbInstance, resetDbInstance } = await import("@/lib/db/core");
    closeDbInstance();
    resetDbInstance();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("does not list another provider's models to a restricted key", async () => {
    const ids = await listCatalogIds(restrictedKey);
    assert.ok(
      ids.includes(ALLOWED_MODEL),
      `the allowed model must stay listed, got: ${ids.join(", ")}`
    );
    assert.ok(
      !ids.includes(FOREIGN_MODEL),
      `a restricted key must not see ${FOREIGN_MODEL}, got: ${ids.join(", ")}`
    );
  });

  it("still lists every provider model for a key without model restrictions", async () => {
    const ids = await listCatalogIds(unrestrictedKey);
    assert.ok(ids.includes(ALLOWED_MODEL), `expected ${ALLOWED_MODEL}, got: ${ids.join(", ")}`);
    assert.ok(ids.includes(FOREIGN_MODEL), `expected ${FOREIGN_MODEL}, got: ${ids.join(", ")}`);
  });
});
