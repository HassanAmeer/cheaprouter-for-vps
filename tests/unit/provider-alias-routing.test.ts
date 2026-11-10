import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NOAUTH_PROVIDERS } from "../../src/shared/constants/providers/noauth.ts";
import { WEB_COOKIE_PROVIDERS } from "../../src/shared/constants/providers/web-cookie.ts";
import { ALIAS_TO_PROVIDER_ID, resolveProviderAlias } from "../../open-sse/services/providerAlias.ts";
import { parseModel } from "../../open-sse/services/model.ts";

// Regression guard: /v1/models advertises catalog ids under the provider's
// display alias (e.g. `horde/aphrodite/TheDrummer/Cydonia-24B-v4.3` for the
// no-auth aihorde provider). parseModel() must resolve that prefix back to a
// real provider id — otherwise the request fell through to the default
// OpenAI upstream with the anonymous Horde key and returned 401.
describe("providerAlias manual overrides", () => {
  it("resolves horde/... to the aihorde provider", () => {
    assert.equal(resolveProviderAlias("horde"), "aihorde");
    assert.equal(ALIAS_TO_PROVIDER_ID["horde"], "aihorde");
  });

  it("parseModel('horde/<model>') routes to aihorde (not OpenAI)", () => {
    const parsed = parseModel("horde/aphrodite/TheDrummer/Cydonia-24B-v4.3");
    assert.equal(parsed.provider, "aihorde");
    assert.equal(parsed.model, "aphrodite/TheDrummer/Cydonia-24B-v4.3");
  });

  it("no no-auth/web-cookie display alias resolves to itself (unrouted identity fallback)", () => {
    const table = { ...NOAUTH_PROVIDERS, ...WEB_COOKIE_PROVIDERS };
    const unrouted: string[] = [];
    for (const [id, provider] of Object.entries(table) as Array<[string, { alias?: string }]>) {
      const alias = provider?.alias;
      if (!alias || alias === id) continue;
      if (resolveProviderAlias(alias) === alias) unrouted.push(`${id}(alias=${alias})`);
    }
    assert.deepEqual(unrouted, [], `aliases falling through to the identity fallback: ${unrouted.join(", ")}`);
  });
});
