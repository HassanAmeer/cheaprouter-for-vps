import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-combos-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_FILE = path.join(dir, "storage.sqlite");
const combos = await import("../../../src/lib/db/combos.ts");
const sites = await import("../../../src/lib/db/sites.ts");
after(async () => {
  const { resetDbInstance } = await import("../../../src/lib/db/core.ts");
  resetDbInstance();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("shared combos remain visible, foreign combos stay hidden, pagination follows filtering", async () => {
  await combos.createCombo({ name: "shared", models: ["openai/gpt-4o"] });
  await combos.createCombo({ name: "foreign", siteId: "b", models: ["openai/gpt-4o"] });
  await combos.createCombo({ name: "own", siteId: "a", models: ["openai/gpt-4o"] });
  const page = await combos.getSiteCombos("a", 1, 1);
  assert.equal(page.total, 2);
  assert.equal(page.combos.length, 1);
  assert.notEqual(page.combos[0].name, "foreign");
});

test("combo rename and delete maintain site route references", async () => {
  const combo = await combos.createCombo({ name: "old", models: ["openai/gpt-4o"] });
  sites.setSiteRoutes("a", [String(combo.id), "old"]);
  await combos.updateCombo(String(combo.id), { name: "new" });
  assert.deepEqual(
    sites
      .listSiteRoutes("a")
      .map((row) => row.routeId)
      .sort(),
    [String(combo.id), "new"].sort()
  );
  await combos.deleteCombo(String(combo.id));
  assert.deepEqual(sites.listSiteRoutes("a"), []);
});
