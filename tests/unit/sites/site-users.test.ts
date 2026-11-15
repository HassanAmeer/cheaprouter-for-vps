import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-users-"));
process.env.DATA_DIR = dir;
process.env.SQLITE_FILE = path.join(dir, "storage.sqlite");
process.env.API_KEY_SECRET = "site-users-isolated-test-secret";
const { createApiKey } = await import("../../../src/lib/db/apiKeys.ts");
const { associateCreatedResellerKey, upsertResellerUser } =
  await import("../../../src/lib/db/resellerUsers.ts");
const { GET } = await import("../../../src/app/api/v1/reseller/users/route.ts");
const { POST } = await import("../../../src/app/api/v1/reseller/users/route.ts");
after(async () => {
  const { resetDbInstance } = await import("../../../src/lib/db/core.ts");
  resetDbInstance();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a scoped user without a key remains visible only in its own site", async () => {
  const response = await POST(
    new Request("http://localhost/api/v1/reseller/users?site=keyless", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "upsertUser",
        userId: "no-key",
        email: "no-key@example.test",
      }),
    })
  );
  assert.equal(response.status, 200);
  const own = await (
    await GET(new Request("http://localhost/api/v1/reseller/users?site=keyless&userId=no-key"))
  ).json();
  assert.equal(own.user?.id, "no-key");
  const foreign = await GET(
    new Request("http://localhost/api/v1/reseller/users?site=b&userId=no-key")
  );
  assert.equal(foreign.status, 404);
});

test("site user lists exclude foreign users and keys, including unknown site filters", async () => {
  for (const site of ["a", "b"]) {
    const userId = `audit-${site}`;
    upsertResellerUser({ id: userId, email: `${userId}@example.test` });
    const key = await createApiKey(userId, "audit-machine", [], { siteId: site });
    associateCreatedResellerKey({
      userId,
      userName: userId,
      apiKey: key.key,
      apiKeyId: key.id,
      allowedModels: [],
    });
  }
  for (const site of ["a", "b", "missing"]) {
    const response = await GET(new Request(`http://localhost/api/v1/reseller/users?site=${site}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    const expected = site === "missing" ? [] : [`audit-${site}`];
    assert.deepEqual(
      body.users.map((u: { id: string }) => u.id),
      expected
    );
    assert.deepEqual(
      body.userKeys.map((k: { userId: string }) => k.userId),
      expected
    );
  }
});
