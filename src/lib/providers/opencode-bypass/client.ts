/**
 * OpenCode Free Lane — Main Bypass Client
 *
 * Yeh lightweight fetch-based client hai jo OpenCode ke upstream free gate ko
 * directly hit karta hai — bina heavy OpenCode CLI ke, bina login ke, bina
 * API key ke.
 *
 * Features:
 * - Enable/Disable sirf ek flag se (`OPENCODE_BYPASS_ENABLED`)
 * - RAM: ~0 MB extra (website ke existing Node.js process me chalega)
 * - Zero dependencies (sirf native `fetch` + `crypto`)
 * - OpenAI-compatible request/response format
 * - Streaming support (SSE)
 *
 * Reference: https://github.com/Ebony-Vinyl/dsh-our-free-model
 *
 * @module provider-opencode/opencode-bypass-setup/client
 */

import { buildBypassHeaders, injectFingerprintTools, UPSTREAM_BASE } from "./fingerprint.ts";
import { mintSession } from "./session.ts";

// ============================================================
//  🔴 MASTER SWITCH — enable/disable flag
// ============================================================
export const OPENCODE_BYPASS_ENABLED: boolean = process.env.OPENCODE_BYPASS_ENABLED !== "false";

/** Free lane me available models */
export const FREE_MODELS = [
  "deepseek-v4.1-flash-free",
  "glm-5.3-flash-free",
  "minimax-m3.1-flash-free",
  "beam-free",
  "big-pickle",
  "nemotron-3.5-super-vl-free",
  "nemotron-3.5-lightning-free",
  "mimo-v2.6-flash-free",
  "deepseek-v4-1-flash-free",
  "kimi-k3-free",
] as const;

export type FreeModel = (typeof FREE_MODELS)[number] | string;

export interface BypassChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface BypassRequestOptions {
  model: FreeModel;
  messages: BypassChatMessage[];
  /** Default: false */
  stream?: boolean;
  /** Default: 8192 */
  maxTokens?: number;
  sessionId?: string;
  baseUrl?: string;
}

export interface BypassResponse {
  id: string;
  model: string;
  content: string;
  sessionId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function resolveChatCompletionsUrl(baseUrl?: string): string {
  const base = (baseUrl?.trim() || UPSTREAM_BASE).replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  if (base.endsWith("/inference/v1") || base.endsWith("/v1") || base.endsWith("/zen/v1")) {
    return `${base}/chat/completions`;
  }
  return `${base}/inference/v1/chat/completions`;
}

/**
 * OpenCode free lane se chat completion lao (non-streaming).
 * Free lane streaming expect karti hai, isliye stream karke content collect karte hain.
 */
export async function bypassChat(options: BypassRequestOptions): Promise<BypassResponse> {
  const sessionId = options.sessionId ?? mintSession();
  let content = "";
  await bypassChatStream(
    { ...options, sessionId },
    (chunk) => {
      content += chunk;
    }
  );
  return {
    id: `chatcmpl-${sessionId}`,
    model: options.model,
    content,
    sessionId,
  };
}

/**
 * OpenCode free lane se streaming chat completion lao (SSE).
 * Har chunk callback me milega.
 */
export async function bypassChatStream(
  options: BypassRequestOptions,
  onChunk: (text: string, reasoning?: string) => void,
  onDone?: (sessionId: string) => void
): Promise<void> {
  if (!OPENCODE_BYPASS_ENABLED) {
    throw new Error(
      "[opencode-bypass] Bypass disabled hai. OPENCODE_BYPASS_ENABLED=true set karo."
    );
  }

  const sessionId = options.sessionId ?? mintSession();
  const headers = buildBypassHeaders(sessionId, { stream: true });
  const { tools, placeholderNote } = injectFingerprintTools([]);

  const messages = [...options.messages];
  if (placeholderNote) {
    const first = messages[0];
    if (first?.role === "system") {
      messages[0] = {
        role: "system",
        content: `${first.content}\n\n${placeholderNote}`,
      };
    } else {
      messages.unshift({
        role: "system",
        content: placeholderNote,
      });
    }
  }

  const body = {
    model: options.model,
    max_tokens: options.maxTokens ?? 8192,
    messages,
    stream: true,
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  };

  const url = resolveChatCompletionsUrl(options.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[opencode-bypass] HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("[opencode-bypass] No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") {
        onDone?.(sessionId);
        return;
      }
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
              reasoning?: string;
              thought?: string;
            };
            text?: string;
          }>;
        };
        const delta = chunk.choices?.[0]?.delta;
        const text = delta?.content ?? chunk.choices?.[0]?.text ?? "";
        const reasoning = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thought;
        if (text || reasoning) {
          onChunk(text, reasoning);
        }
      } catch {
        // malformed chunk — skip
      }
    }
  }

  onDone?.(sessionId);
}
