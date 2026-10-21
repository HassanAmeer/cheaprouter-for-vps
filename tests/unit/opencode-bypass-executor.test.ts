import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpencodeBypassExecutor } from "../../open-sse/executors/opencode-bypass.ts";
import type { ProviderCredentials } from "../../open-sse/executors/base.ts";
import { mintSession } from "../../src/lib/providers/opencode-bypass/index.ts";

describe("OpencodeBypassExecutor", () => {
  it("correctly builds URL, headers and transforms request", () => {
    const executor = new OpencodeBypassExecutor("opencode-bypass");

    // Default URL
    const url = executor.buildUrl("deepseek-v4.1-flash-free", false, 0, null);
    assert.equal(url, "https://opencode.ai/inference/v1/chat/completions");

    // Custom URL via credentials
    const credentialsWithBaseUrl = {
      providerSpecificData: { baseUrl: "https://custom-gateway.local/v1" },
    } as unknown as ProviderCredentials;
    const customUrl = executor.buildUrl("deepseek-v4.1-flash-free", false, 0, credentialsWithBaseUrl);
    assert.equal(customUrl, "https://custom-gateway.local/v1/chat/completions");

    // Headers with valid session
    const validSession = mintSession();
    const credentialsWithKey = { apiKey: "test-key" } as unknown as ProviderCredentials;
    const headers = executor.buildHeaders(credentialsWithKey, true, {
      "x-opencode-session": validSession,
    });
    assert.equal(headers["user-agent"] || headers["User-Agent"], "opencode/latest/2.0.26/cli");
    assert.equal(headers["x-opencode-session"], validSession);
    assert.equal(headers["authorization"] || headers["Authorization"], "Bearer test-key");

    // Request transformation
    const body: Record<string, unknown> = {
      model: "opencode-bypass/deepseek-v4.1-flash-free",
      tool_choice: "none",
      messages: [{ role: "user", content: "hello" }],
    };
    const transformed = executor.transformRequest(
      "opencode-bypass/deepseek-v4.1-flash-free",
      body,
      true,
      null
    ) as Record<string, unknown>;

    assert.equal(transformed.model, "deepseek-v4.1-flash-free");
    assert.equal(transformed.tool_choice, undefined);
    assert.ok(Array.isArray(transformed.tools));
    const tools = transformed.tools as Array<{ function?: { name: string } }>;
    assert.ok(tools.some((t) => t.function?.name === "read"));
    assert.ok(tools.some((t) => t.function?.name === "shell"));
  });
});
