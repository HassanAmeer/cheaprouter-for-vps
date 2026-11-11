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
});
