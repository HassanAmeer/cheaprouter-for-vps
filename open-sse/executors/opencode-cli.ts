import { BaseExecutor, type ExecuteInput, type ExecutorExecuteResult } from "./base.ts";
import { makeExecutorErrorResult as makeErrorResult } from "../utils/error.ts";
import { randomUUID } from "node:crypto";

export class OpenCodeCliExecutor extends BaseExecutor {
  constructor(providerId: string = "opencode-cli") {
    super(providerId, {
      id: providerId,
      baseUrl: providerId === "kilo-code-cli" ? "http://127.0.0.1:4098" : "http://127.0.0.1:4099",
    });
  }

  async execute(input: ExecuteInput): Promise<ExecutorExecuteResult> {
    const { body, signal, credentials, stream } = input;
    const bodyObj = (body || {}) as Record<string, unknown>;
    const rawModel =
      (bodyObj.model as string) ||
      (this.provider === "kilo-code-cli" ? "kilo-auto/free" : "big-pickle");

    // Resolve base URL from connection credentials or default
    const psd = credentials?.providerSpecificData as Record<string, unknown> | undefined;
    const configuredBase =
      (typeof psd?.baseUrl === "string" && psd.baseUrl.trim()) ||
      (this.provider === "kilo-code-cli" ? "http://127.0.0.1:4098" : "http://127.0.0.1:4099");
    const baseUrl = configuredBase.replace(/\/+$/, "").replace(/\/v1$/, "");

    // Flatten prompt from messages
    const messages = Array.isArray(bodyObj.messages)
      ? (bodyObj.messages as Array<{ role?: string; content?: unknown }>)
      : [];
    const promptParts: string[] = [];
    for (const m of messages) {
      const role = m.role || "user";
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      if (messages.length === 1 && role === "user") {
        promptParts.push(content);
      } else {
        promptParts.push(`${role.toUpperCase()}: ${content}`);
      }
    }
    const promptText = promptParts.join("\n\n") || "Hello";

    // Normalize providerID and modelID for OpenCode/Kilo native RPC
    let providerID = this.provider === "kilo-code-cli" ? "kilo" : "opencode";
    let modelID = rawModel;
    if (modelID.startsWith(`${this.provider}/`)) {
      modelID = modelID.slice(this.provider.length + 1);
    }
    if (modelID.includes("/")) {
      const [p, ...rest] = modelID.split("/");
      if (p === "opencode" || p === "kilo") {
        providerID = p;
        modelID = rest.join("/");
      }
    }

    try {
      // 1. Create a session on the headless CLI server
      const sessionRes = await fetch(`${baseUrl}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
      });
      if (!sessionRes.ok) {
        return makeErrorResult(
          sessionRes.status,
          `Failed to create session on ${this.provider} server at ${baseUrl}`,
          body,
          baseUrl
        );
      }
      const session = (await sessionRes.json()) as { id: string };

      // 2. Post message to session
      const messageRes = await fetch(`${baseUrl}/session/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: { providerID, modelID },
          parts: [{ type: "text", text: promptText }],
        }),
        signal,
      });

      if (!messageRes.ok) {
        const errText = await messageRes.text().catch(() => "");
        return makeErrorResult(
          messageRes.status,
          `${this.provider} server error: ${errText.slice(0, 300) || messageRes.statusText}`,
          body,
          baseUrl
        );
      }

      const resData = (await messageRes.json()) as any;
      if (resData.info?.error) {
        const errObj = resData.info.error;
        const msg = errObj.data?.message || errObj.message || JSON.stringify(errObj);
        return makeErrorResult(400, msg, body, baseUrl);
      }

      const textParts = (resData.parts || [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("");
      const reasoningParts = (resData.parts || [])
        .filter((p: any) => p.type === "reasoning")
        .map((p: any) => p.text)
        .join("");
      const totalTokens = resData.info?.tokens?.total || 0;
      const inputTokens = resData.info?.tokens?.input || 0;
      const outputTokens = resData.info?.tokens?.output || 0;
      const chatId = `chatcmpl-${this.provider}-${randomUUID().slice(0, 12)}`;
      const created = Math.floor(Date.now() / 1000);

      const messagePayload: Record<string, unknown> = {
        role: "assistant",
        content: textParts,
      };
      if (reasoningParts) {
        messagePayload.reasoning_content = reasoningParts;
      }

      if (stream) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            const firstChunk = {
              id: chatId,
              object: "chat.completion.chunk",
              created,
              model: rawModel,
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: textParts },
                  finish_reason: null,
                },
              ],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(firstChunk)}\n\n`));

            const finalChunk = {
              id: chatId,
              object: "chat.completion.chunk",
              created,
              model: rawModel,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                },
              ],
              usage: {
                prompt_tokens: inputTokens,
                completion_tokens: outputTokens,
                total_tokens: totalTokens,
              },
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return {
          response: new Response(readable, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          }),
        };
      }

      const responseBody = {
        id: chatId,
        object: "chat.completion",
        created,
        model: rawModel,
        choices: [
          {
            index: 0,
            message: messagePayload,
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
        },
      };

      return {
        response: new Response(JSON.stringify(responseBody), {
          headers: { "Content-Type": "application/json" },
        }),
      };
    } catch (err: unknown) {
      return makeErrorResult(
        500,
        `Failed to reach ${this.provider} server: ${err instanceof Error ? err.message : String(err)}`,
        body,
        baseUrl
      );
    }
  }
}
