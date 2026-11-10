import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NOAUTH_PROVIDERS } from "../../src/shared/constants/providers/noauth.ts";
import {
  FREE_APIKEY_PROVIDER_IDS,
  supportsApiKeyOnFreeProvider,
} from "../../src/shared/constants/providers.ts";
import { isManagedProviderConnectionId } from "../../src/lib/providers/catalog.ts";

// Regression guard: every credential-less provider must be connectable through
// POST /api/providers (no apiKey required). Without the flag the create call
// answers "Invalid provider" and the provider can never get a connection row,
// so it stays invisible in /v1/models and in the dashboard connection counts.
//
// duckduckgo-web is exempt: it authenticates with a stored cookie session
// (web-session credential flow), not with an optional API key.
describe("no-auth providers accept an optional connection", () => {
  const SESSION_CREDENTIAL_PROVIDER_IDS = new Set(["duckduckgo-web"]);

  it("every no-auth provider id is admitted by FREE_APIKEY_PROVIDER_IDS", () => {
    const missing = Object.keys(NOAUTH_PROVIDERS).filter(
      (id) => !SESSION_CREDENTIAL_PROVIDER_IDS.has(id) && !FREE_APIKEY_PROVIDER_IDS.has(id)
    );
    assert.deepEqual(missing, [], `no-auth providers without a connectable id: ${missing.join(", ")}`);
  });

  it("every no-auth provider id is a managed connection id", () => {
    for (const id of Object.keys(NOAUTH_PROVIDERS)) {
      if (SESSION_CREDENTIAL_PROVIDER_IDS.has(id)) continue;
      assert.equal(supportsApiKeyOnFreeProvider(id), true, `${id} is not an optional-key provider`);
      assert.equal(isManagedProviderConnectionId(id), true, `${id} cannot get a connection row`);
    }
  });
});
