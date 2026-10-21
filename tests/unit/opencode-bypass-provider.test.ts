import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mintSession,
  canonicalizeSession,
  isCanonicalSession,
  buildBypassHeaders,
  injectFingerprintTools,
  resolveChatCompletionsUrl,
} from "../../src/lib/providers/opencode-bypass/index.ts";
import {
  CLI_PROVIDER_IDS,
  isCliProvider,
  providerAllowsOptionalApiKey,
} from "../../src/shared/constants/providers.ts";
import { NOAUTH_PROVIDERS } from "../../src/shared/constants/providers/noauth.ts";
import {
  isBaseUrlConfigurableProvider,
  DEFAULT_PROVIDER_BASE_URLS,
  getProviderBaseUrlPlaceholder,
} from "../../src/app/(dashboard)/dashboard/providers/[id]/providerPageHelpers.ts";

describe("OpenCode Bypass Provider & Constants", () => {
  it("mints valid descending session IDs that satisfy OpenCode v2 gate", () => {
    const session = mintSession();
    assert.strictEqual(session.startsWith("ses_"), true);
    assert.strictEqual(isCanonicalSession(session), true);
  });

  it("canonicalizes session properly", () => {
    const valid = mintSession();
    assert.strictEqual(canonicalizeSession(valid), valid);
    assert.strictEqual(isCanonicalSession(canonicalizeSession("invalid-session")), true);
  });

  it("builds exact bypass headers without x-opencode-request", () => {
    const session = mintSession();
    const headers = buildBypassHeaders(session);
    assert.strictEqual(headers["user-agent"] || headers["User-Agent"], "opencode/latest/2.0.26/cli");
    assert.strictEqual(headers["authorization"] || headers["Authorization"], "Bearer public");
    assert.strictEqual(headers["x-opencode-session"], session);
    assert.strictEqual(headers["x-opencode-session-id"], session);
    assert.strictEqual(headers["x-session-affinity"], session);
    assert.strictEqual(headers["content-type"] || headers["Content-Type"], "application/json");
    assert.strictEqual(headers["x-opencode-request"], undefined);
  });

  it("injects fingerprint tools (read & shell) without clobbering existing tools", () => {
    const existing = [{ name: "my_custom_tool", description: "custom", parameters: {} }];
    const { tools, injectedNames } = injectFingerprintTools(existing);
    assert.strictEqual(tools.some((t) => t.name === "read"), true);
    assert.strictEqual(tools.some((t) => t.name === "shell"), true);
    assert.strictEqual(tools.some((t) => t.name === "my_custom_tool"), true);
    assert.strictEqual(injectedNames.includes("read"), true);
    assert.strictEqual(injectedNames.includes("shell"), true);
  });

  it("resolves chat completions URLs correctly", () => {
    assert.strictEqual(
      resolveChatCompletionsUrl("https://opencode.ai/inference/v1"),
      "https://opencode.ai/inference/v1/chat/completions"
    );
    assert.strictEqual(
      resolveChatCompletionsUrl("https://my-proxy.com/v1"),
      "https://my-proxy.com/v1/chat/completions"
    );
    assert.strictEqual(
      resolveChatCompletionsUrl("https://my-proxy.com/v1/chat/completions"),
      "https://my-proxy.com/v1/chat/completions"
    );
  });

  it("is registered as CLI provider and no-auth catalog entry", () => {
    assert.strictEqual(CLI_PROVIDER_IDS.has("opencode-bypass"), true);
    assert.strictEqual(isCliProvider("opencode-bypass"), true);
    assert.strictEqual("opencode-bypass" in NOAUTH_PROVIDERS, true);
    assert.strictEqual(NOAUTH_PROVIDERS["opencode-bypass"].name, "OpenCode API (Bypass)");
    assert.strictEqual(providerAllowsOptionalApiKey("opencode-bypass"), true);
    assert.strictEqual(isBaseUrlConfigurableProvider("opencode-bypass"), true);
    assert.strictEqual(
      DEFAULT_PROVIDER_BASE_URLS["opencode-bypass"],
      "https://opencode.ai/inference/v1"
    );
    assert.strictEqual(
      getProviderBaseUrlPlaceholder("opencode-bypass"),
      "https://opencode.ai/inference/v1"
    );
  });
});
