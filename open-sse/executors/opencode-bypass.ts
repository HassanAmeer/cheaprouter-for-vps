import { BaseExecutor, type ProviderCredentials } from "./base.ts";
import { PROVIDERS } from "../config/constants.ts";
import {
  buildBypassHeaders,
  injectFingerprintTools,
  resolveChatCompletionsUrl,
} from "../../src/lib/providers/opencode-bypass/index.ts";

export class OpencodeBypassExecutor extends BaseExecutor {
  constructor(providerId = "opencode-bypass") {
    super(
      providerId,
      PROVIDERS[providerId] || {
        id: providerId,
        format: "openai",
        baseUrl: "https://opencode.ai/inference/v1",
      }
    );
  }

  buildUrl(
    _model: string,
    _stream: boolean,
    _urlIndex = 0,
    credentials: ProviderCredentials | null = null
  ): string {
    const psd = credentials?.providerSpecificData as Record<string, unknown> | undefined;
    const configuredBase =
      (typeof psd?.baseUrl === "string" && psd.baseUrl.trim()) ||
      this.config.baseUrl ||
      "https://opencode.ai/inference/v1";
    return resolveChatCompletionsUrl(configuredBase);
  }

  buildHeaders(
    credentials: ProviderCredentials,
    stream = true,
    clientHeaders?: Record<string, string> | null,
    _model?: string,
    _health?: Record<string, unknown>,
    _body?: unknown
  ): Record<string, string> {
    const existingSession =
      clientHeaders?.["x-opencode-session"] ||
      clientHeaders?.["x-opencode-session-id"] ||
      clientHeaders?.["x-session-affinity"] ||
      ((credentials?.providerSpecificData as Record<string, unknown> | undefined)?.sessionId as
        string | undefined);

    const bypassHeaders = buildBypassHeaders(existingSession, { stream });

    const headers: Record<string, string> = {
      ...bypassHeaders,
      Accept: stream ? "text/event-stream" : "application/json, text/event-stream, */*",
    };

    // If custom API key is provided, attach it (overriding default Bearer public)
    const key = credentials?.apiKey || credentials?.accessToken;
    if (key && key !== "anonymous") {
      headers["authorization"] = `Bearer ${key}`;
      headers["Authorization"] = `Bearer ${key}`;
    }

    return headers;
  }

  transformRequest(
    model: string,
    body: Record<string, unknown>,
    stream: boolean,
    _credentials: ProviderCredentials | null = null
  ): unknown {
    if (typeof body !== "object" || body === null) return body;

    // Normalize model: strip provider prefix if present
    let effectiveModel = model;
    if (effectiveModel.startsWith("opencode-bypass/")) {
      effectiveModel = effectiveModel.slice("opencode-bypass/".length);
    } else if (effectiveModel.startsWith("oc-bypass/")) {
      effectiveModel = effectiveModel.slice("oc-bypass/".length);
    }

    body.model = effectiveModel;
    body.stream = stream;

    // tool_choice: "none" triggers 403 FreeTierError upstream — remove it
    if (body.tool_choice === "none") {
      delete body.tool_choice;
    }

    // Inject fingerprint tools (read & shell)
    const rawTools = Array.isArray(body.tools)
      ? (body.tools as Array<Record<string, unknown>>)
      : [];
    const simpleTools = rawTools.map((t) => {
      const fn = t?.function as Record<string, unknown> | undefined;
      if (t?.type === "function" && fn && typeof fn.name === "string") {
        return { name: fn.name, ...fn };
      }
      return typeof t.name === "string" ? { name: t.name, ...t } : { name: "" };
    });

    const { tools, placeholderNote } = injectFingerprintTools(simpleTools);
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    if (placeholderNote && Array.isArray(body.messages)) {
      const messages = [...body.messages] as Array<{ role?: string; content?: unknown }>;
      const first = messages[0];
      if (first?.role === "system" && typeof first.content === "string") {
        messages[0] = {
          ...first,
          content: `${first.content}\n\n${placeholderNote}`,
        };
      } else {
        messages.unshift({
          role: "system",
          content: placeholderNote,
        });
      }
      body.messages = messages;
    }

    return body;
  }
}
