import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Multi-tenant site scope — resolution order and per-site exposure.
 *
 * Two things are pinned here, because both are easy to break silently:
 *
 *   1. Resolution order: Host header → X-CheapRoute-Site → the API key's own
 *      site → global. A request MUST resolve to the same site the operator
 *      configured, or its logs/usage land in the wrong website's dashboard.
 *   2. Exposure semantics: a site with NO `site_providers` rows inherits the
 *      global pool (nothing is hidden); once rows exist, only those providers
 *      (and their model allowlists) are exposed.
 *
 * The throwaway data dir has to be configured BEFORE anything pulls in
 * `src/lib/db/core.ts`, hence the dynamic imports below.
 */
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cheaproute-site-scope-"));
process.env.DATA_DIR = dataDir;
process.env.SQLITE_FILE = path.join(dataDir, "storage.sqlite");
process.env.API_KEY_SECRET = "0123456789abcdef0123456789abcdef";

const sitesFile = path.join(dataDir, "sites.json");
process.env.CHEAPROUTE_SITES_FILE = sitesFile;
fs.writeFileSync(
  sitesFile,
  JSON.stringify({
    sites: [
      {
        id: "site-a",
        name: "Site A — blog",
        subdomains: ["site-a.myapp.com", "www.site-a.myapp.com"],
      },
      { id: "site-b", name: "Site B — docs", subdomains: ["site-b.myapp.com"] },
    ],
  }),
  "utf8"
);

const { reloadSiteRegistry } = await import("../../../src/lib/sites/siteRegistry.ts");
const {
  resolveSiteIdForRequest,
  getSiteProviderScope,
  isProviderAllowedForSite,
  invalidateSiteScopeCache,
} = await import("../../../src/lib/sites/siteScope.ts");
const { setSiteProviders, listSiteProviders } = await import("../../../src/lib/db/sites.ts");
const { filterCatalogEntriesForSite } = await import("../../../src/lib/sites/siteModelFilter.ts");

function headersOf(entries: Record<string, string>): { get(name: string): string | null } {
  const lower = new Map(Object.entries(entries).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

describe("site scope", () => {
  before(() => {
    reloadSiteRegistry();
  });

  after(async () => {
    const { closeDbInstance, resetDbInstance } = await import("../../../src/lib/db/core.ts");
    closeDbInstance();
    resetDbInstance();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("resolves the site from the Host header first", () => {
    assert.equal(resolveSiteIdForRequest({ host: "site-a.myapp.com" }), "site-a");
    // Case and port are normalized away; the www alias resolves to its site.
    assert.equal(resolveSiteIdForRequest({ host: "WWW.Site-A.MyApp.com:443" }), "site-a");
    assert.equal(resolveSiteIdForRequest({ host: "Site-B.MyApp.com:8443" }), "site-b");
  });

  it("falls back to X-CheapRoute-Site, then the API key's site, then global", () => {
    assert.equal(
      resolveSiteIdForRequest({
        host: "router.myapp.com",
        headers: headersOf({ "x-cheaproute-site": "site-b" }),
      }),
      "site-b"
    );

    assert.equal(
      resolveSiteIdForRequest({
        host: "router.myapp.com",
        apiKeyInfo: { siteId: "site-a", id: "key-1" },
      }),
      "site-a"
    );

    assert.equal(resolveSiteIdForRequest({ host: "router.myapp.com" }), null);
  });

  it("ignores a spoofed site that is not in the registry", () => {
    assert.equal(
      resolveSiteIdForRequest({
        host: "router.myapp.com",
        headers: headersOf({ "x-cheaproute-site": "does-not-exist" }),
      }),
      null
    );
  });

  it("inherits the global pool while the site has no provider rows", () => {
    const scope = getSiteProviderScope("site-a");
    assert.equal(scope.inheritsGlobal, true);
    assert.equal(isProviderAllowedForSite("site-a", "openai"), true);
  });

  it("restricts providers once the site has an allowlist", () => {
    setSiteProviders("site-a", [{ provider: "openai" }, { provider: "anthropic" }]);
    invalidateSiteScopeCache();

    const scope = getSiteProviderScope("site-a");
    assert.equal(scope.inheritsGlobal, false);
    assert.equal(isProviderAllowedForSite("site-a", "openai"), true);
    assert.equal(isProviderAllowedForSite("site-a", "anthropic"), true);
    assert.equal(isProviderAllowedForSite("site-a", "groq"), false);

    // A site without rows is untouched by another site's allowlist.
    assert.equal(isProviderAllowedForSite("site-b", "groq"), true);
    assert.equal(listSiteProviders("site-b").length, 0);
  });

  it("filters the catalog payload down to the exposed providers", () => {
    invalidateSiteScopeCache();
    setSiteProviders("site-a", [{ provider: "openai", models: ["gpt-4o"] }]);
    invalidateSiteScopeCache();

    const entries = [
      { id: "openai/gpt-4o", owned_by: "openai" },
      { id: "openai/gpt-4o-mini", owned_by: "openai" },
      { id: "groq/llama-3.1-70b", owned_by: "groq" },
    ];

    const filtered = filterCatalogEntriesForSite("site-a", entries);
    assert.deepEqual(
      filtered.map((entry) => entry.id),
      ["openai/gpt-4o"]
    );

    // No site (or an inheriting site) returns the input untouched.
    assert.equal(filterCatalogEntriesForSite(null, entries).length, 3);
    assert.equal(filterCatalogEntriesForSite("site-b", entries).length, 3);
  });

  it("does not reopen the global pool when every configured provider is disabled", () => {
    setSiteProviders("site-a", [{ provider: "openai", isEnabled: false }]);
    invalidateSiteScopeCache();
    assert.equal(isProviderAllowedForSite("site-a", "groq"), false);
    assert.equal(isProviderAllowedForSite("site-a", "openai"), false);
  });

  it("retains combo catalog entries while filtering direct provider models", () => {
    setSiteProviders("site-a", [{ provider: "openai" }]);
    invalidateSiteScopeCache();
    const entries = [
      { id: "my-combo", owned_by: "combo" },
      { id: "auto/best", owned_by: "combo" },
      { id: "groq/model", owned_by: "groq" },
    ];
    assert.deepEqual(
      filterCatalogEntriesForSite("site-a", entries).map((e) => e.id),
      ["my-combo", "auto/best"]
    );
  });

  it("enforces canonical provider model allowlists for aliases and nested model ids", async () => {
    const { isModelAllowedForSite } = await import("../../../src/lib/sites/siteScope.ts");
    setSiteProviders("site-a", [{ provider: "openai", models: ["gpt-4o"] }]);
    invalidateSiteScopeCache();
    assert.equal(isModelAllowedForSite("site-a", "openai", "gpt-4o"), true);
    assert.equal(isModelAllowedForSite("site-a", "openai", "gpt-4o-mini"), false);
    assert.equal(isModelAllowedForSite("site-a", "groq", "gpt-4o"), false);
  });

  it("filters keys before pagination and reports the full site total", async () => {
    const { createApiKey, getApiKeys, getApiKeysCount } =
      await import("../../../src/lib/db/apiKeys.ts");
    await createApiKey("other", "test-machine", [], { siteId: "site-b" });
    await createApiKey("first", "test-machine", [], { siteId: "site-a" });
    await createApiKey("second", "test-machine", [], { siteId: "site-a" });
    assert.equal(getApiKeysCount("site-a"), 2);
    const page = await getApiKeys(1, 1, "site-a");
    assert.equal(page.length, 1);
    assert.equal(page[0].siteId, "site-a");
  });

  it("denies disallowed resolved targets with a sanitized 403", async () => {
    const { siteModelRejection } = await import("../../../src/lib/sites/siteRequestContext.ts");
    setSiteProviders("site-a", [{ provider: "openai", models: ["gpt-4o"] }]);
    invalidateSiteScopeCache();
    assert.equal(siteModelRejection("site-a", "openai", "gpt-4o"), null);
    const rejection = siteModelRejection("site-a", "groq", "model");
    assert.equal(rejection?.status, 403);
    assert.equal((await rejection?.json()).error.message.includes("at /"), false);
  });

  it("does not let a host or override header escape a key's assigned site", () => {
    assert.equal(
      resolveSiteIdForRequest({
        host: "site-b.myapp.com",
        headers: headersOf({ "x-cheaproute-site": "site-b" }),
        apiKeyInfo: { siteId: "site-a" },
      }),
      "site-a"
    );
  });

  it("binds site attribution through async work for non-chat handlers", async () => {
    const { withRequestSiteContext } = await import("../../../src/lib/sites/siteRequestContext.ts");
    const { getCallLogSiteId } = await import("../../../src/lib/usage/callLogApiKeyContext.ts");
    const handler = withRequestSiteContext(async () => {
      await Promise.resolve();
      return Response.json({ site: getCallLogSiteId() });
    });
    const response = await handler(
      new Request("http://site-a.myapp.com/v1/embeddings", {
        headers: { host: "site-a.myapp.com" },
      })
    );
    assert.equal((await response.json()).site, "site-a");
    assert.equal(getCallLogSiteId(), null);
  });

  it("respects combo route assignments without hiding inherited global routes", async () => {
    const { siteRouteRejection } = await import("../../../src/lib/sites/siteRequestContext.ts");
    const { setSiteRoutes } = await import("../../../src/lib/db/sites.ts");
    setSiteRoutes("site-a", ["combo-id"]);
    assert.equal(siteRouteRejection("site-a", { id: "combo-id", name: "allowed" }), null);
    assert.equal(siteRouteRejection("site-a", { id: "other", name: "denied" })?.status, 403);
    setSiteRoutes("site-a", []);
    assert.equal(siteRouteRejection("site-a", { id: "other", name: "shared" }), null);
  });

  it("preserves site attribution when a provider helper replaces key identity", async () => {
    const { runWithCallLogApiKeyContext, getCallLogSiteId } =
      await import("../../../src/lib/usage/callLogApiKeyContext.ts");
    const site = runWithCallLogApiKeyContext(
      { siteId: "site-a", apiKeyId: null, apiKeyName: null },
      () => runWithCallLogApiKeyContext({ apiKeyId: "key", apiKeyName: "name" }, getCallLogSiteId)
    );
    assert.equal(site, "site-a");
  });

  it("filters combo routes even when the provider pool is inherited", async () => {
    const { scopeModelsResponseForSite } =
      await import("../../../src/lib/sites/siteModelFilter.ts");
    const { setSiteRoutes } = await import("../../../src/lib/db/sites.ts");
    setSiteProviders("site-b", []);
    setSiteRoutes("site-b", ["allowed"]);
    invalidateSiteScopeCache();
    const response = await scopeModelsResponseForSite(
      Response.json({
        data: [
          { id: "allowed", owned_by: "combo" },
          { id: "denied", owned_by: "combo" },
          { id: "openai/gpt-4o", owned_by: "openai" },
        ],
      }),
      async () => "site-b"
    );
    assert.deepEqual(
      (await response.json()).data.map((entry: { id: string }) => entry.id),
      ["allowed", "openai/gpt-4o"]
    );
  });

  it("reuses cached empty scopes across alternating sites", () => {
    setSiteProviders("site-a", []);
    setSiteProviders("site-b", []);
    invalidateSiteScopeCache();
    const first = getSiteProviderScope("site-a");
    getSiteProviderScope("site-b");
    assert.equal(getSiteProviderScope("site-a"), first);
  });
});
