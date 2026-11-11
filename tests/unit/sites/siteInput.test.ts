import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseNewSite } from "../../../src/lib/sites/siteInput";

describe("parseNewSite", () => {
  it("accepts a name + subdomains and normalizes them", () => {
    const result = parseNewSite({
      name: "  My   Site ",
      subdomains: ["Router.Example.com", "*.example.com"],
    });

    assert.deepEqual(result, {
      ok: true,
      name: "My Site",
      subdomains: ["router.example.com", "*.example.com"],
    });
  });

  it("splits a comma/space separated subdomain string", () => {
    const result = parseNewSite({
      name: "Tokendeal",
      subdomains: "router.tokendeal.cloud, api.tokendeal.cloud localhost:20128",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok ? result.subdomains : null, [
      "router.tokendeal.cloud",
      "api.tokendeal.cloud",
      "localhost:20128",
    ]);
  });

  it("rejects an empty name", () => {
    const result = parseNewSite({ name: "   ", subdomains: ["example.com"] });
    assert.equal(result.ok, false);
  });

  it("rejects an empty subdomain list", () => {
    const result = parseNewSite({ name: "Site", subdomains: [] });
    assert.equal(result.ok, false);
  });

  it("rejects a URL instead of a host", () => {
    const result = parseNewSite({ name: "Site", subdomains: ["https://example.com/path"] });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /host like/i);
  });

  it("rejects a bare host without a dot unless it has a port", () => {
    assert.equal(parseNewSite({ name: "Site", subdomains: ["localhost"] }).ok, false);
    assert.equal(parseNewSite({ name: "Site", subdomains: ["localhost:20128"] }).ok, true);
  });

  it("rejects a scheme-only value", () => {
    assert.equal(parseNewSite({ name: "Site", subdomains: ["ftp://example.com"] }).ok, false);
  });
});