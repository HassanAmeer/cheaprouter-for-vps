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
    const originalMessages = [{ role: "user", content: "hello" }];
    const originalTools = [{ type: "function", function: { name: "my_tool", description: "test" } }];
    const body: Record<string, unknown> = {
      model: "opencode-bypass/deepseek-v4.1-flash-free",
      tool_choice: "none",
      messages: originalMessages,
      tools: originalTools,
    };
    const transformed = executor.transformRequest(
      "opencode-bypass/deepseek-v4.1-flash-free",
      body,
      true,
      null
    ) as Record<string, unknown>;

    // Immutability: input body must not be mutated in place
    assert.equal(body.tool_choice, "none");
    assert.equal(body.messages, originalMessages);
    assert.equal(body.tools, originalTools);

    assert.equal(transformed.model, "deepseek-v4.1-flash-free");
    assert.equal(transformed.tool_choice, undefined);
    assert.ok(Array.isArray(transformed.tools));
    const tools = transformed.tools as Array<{ function?: { name: string } }>;
    assert.ok(tools.some((t) => t.function?.name === "read"));
    assert.ok(tools.some((t) => t.function?.name === "shell"));
  });

  it("buildHeaders normalizes duplicate Accept casing", () => {
    const executor = new OpencodeBypassExecutor("opencode-bypass");
    const headers = executor.buildHeaders(
      { apiKey: "test-key" } as any,
      true,
      null
    );
    assert.equal("accept" in headers, false);
    assert.equal("Accept" in headers, true);
  });

  it("execute does not leak dispatcher to unrelated provider URLs", async () => {
    const executor = new OpencodeBypassExecutor("opencode-bypass");
    let interceptedOptions: any = null;
    let interceptedUrl: string = "";

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (url: any, init: any) => {
        interceptedUrl = String(url);
        interceptedOptions = init;
        return new Response(JSON.stringify({ id: "mock", choices: [{ message: { content: "ok" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof globalThis.fetch;

      // Executing against opencode URL
      await executor.execute({
        model: "deepseek-v4.1-flash-free",
        body: { messages: [{ role: "user", content: "test" }] },
        stream: false,
        credentials: {
          connectionId: "test-conn",
          providerSpecificData: { proxyUrl: "socks5://127.0.0.1:40000" },
        } as any,
      });

      assert.ok(interceptedUrl.includes("opencode.ai"));
      assert.ok(interceptedOptions?.dispatcher, "Dispatcher should be attached to opencode.ai URL");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
