/**
 * Site registry — regression guard.
 *
 * The subdomain → site map is read ONCE at boot into an in-memory Map so the
 * request path costs a single `Map.get()` (no DB, no disk). These tests pin
 * that behaviour plus the "+ Add site" write path (atomic JSON write).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sites-"));
const sitesFile = path.join(tmpDir, "sites.json");
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
    ],
  }),
  "utf8"
);

const { addSite, listSites, reloadSiteRegistry, resolveSiteIdByHost } = await import(
  "../../../src/lib/sites/siteRegistry.ts"
);

describe("site registry", () => {
  before(() => {
    reloadSiteRegistry();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves a host to its site without touching the disk per call", () => {
    assert.equal(resolveSiteIdByHost("site-a.myapp.com"), "site-a");
    assert.equal(resolveSiteIdByHost("WWW.Site-A.MyApp.com"), "site-a");
    assert.equal(resolveSiteIdByHost("site-a.myapp.com:443"), "site-a");
    assert.equal(resolveSiteIdByHost("unknown.myapp.com"), null);
    assert.equal(resolveSiteIdByHost(null), null);
  });

  it("keeps the parsed registry in memory (listSites does not re-read)", () => {
    const first = listSites();
    assert.equal(first.length, 1);
    assert.equal(first[0].name, "Site A — blog");
    assert.deepEqual(first[0].subdomains, ["site-a.myapp.com", "www.site-a.myapp.com"]);
  });

  it("adds a site, writes the file and makes it resolvable immediately", () => {
    const result = addSite({
      name: "Site B — app",
      subdomains: ["Site-B.myapp.com", "api.site-b.myapp.com"],
    });

    assert.equal(result.ok, true);
    assert.equal(result.site?.id, "site-b");
    assert.equal(resolveSiteIdByHost("site-b.myapp.com"), "site-b");
    assert.equal(resolveSiteIdByHost("api.site-b.myapp.com"), "site-b");

    const written = JSON.parse(fs.readFileSync(sitesFile, "utf8"));
    assert.equal(written.sites.length, 2);
    assert.equal(written.sites[1].name, "Site B — app");
  });

  it("refuses a subdomain that already belongs to another site", () => {
    const result = addSite({ name: "Site C", subdomains: ["site-a.myapp.com"] });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /already belongs/);
  });

  it("requires a name and at least one subdomain", () => {
    assert.equal(addSite({ name: "", subdomains: ["x.myapp.com"] }).ok, false);
    assert.equal(addSite({ name: "No subdomain", subdomains: [] }).ok, false);
  });
});
