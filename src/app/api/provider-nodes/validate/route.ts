import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { getAuditRequestContext, logAuditEvent } from "@/lib/compliance/index";
import { validateClaudeCodeCompatibleProvider } from "@/lib/providers/validation";
import {
  SAFE_OUTBOUND_FETCH_PRESETS,
  SafeOutboundFetchError,
  getSafeOutboundFetchErrorStatus,
  safeOutboundFetch,
} from "@/shared/network/safeOutboundFetch";
import { getProviderValidationGuard } from "@/shared/network/outboundUrlGuardPolicy";
import { isCcCompatibleProviderEnabled } from "@/shared/utils/featureFlags";
import { providerNodeValidateSchema } from "@/shared/validation/schemas";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";

// Matches a base URL whose host is localhost / 127.0.0.1 (with an optional port).
const LOCALHOST_BASE_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:[/?#]|$)/i;

// Extract the underlying network error code from a SafeOutboundFetchError chain.
// safeOutboundFetch wraps fetch failures and preserves the original error as `cause`,
// so a connection-refused surfaces as cause.code === "ECONNREFUSED".
function getOutboundCauseCode(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown })?.cause;
  if (cause && typeof cause === "object") {
    const direct = (cause as { code?: unknown }).code;
    if (typeof direct === "string") return direct;
    const nested = (cause as { cause?: { code?: unknown } }).cause?.code;
    if (typeof nested === "string") return nested;
  }
  return undefined;
}

// When a connection error happens against a localhost base URL, the most common
// cause is running CheapRoute in Docker — `localhost` then points at the container,
// not the host. Augment the surfaced message with an actionable hint in that case.
// Ported from decolua/9router#642.
export function augmentDockerLocalhostHint(
  error: unknown,
  baseUrl: string | undefined,
  fallbackMessage: string
): string {
  if (!baseUrl || !LOCALHOST_BASE_URL_RE.test(baseUrl)) return fallbackMessage;

  const code =
    error instanceof SafeOutboundFetchError && error.code === "TIMEOUT"
      ? "ETIMEDOUT"
      : getOutboundCauseCode(error);

  if (code === "ECONNREFUSED") {
    return "Connection refused — are you running CheapRoute in Docker? localhost points to the container, not your host. Use your host IP (e.g. http://192.168.x.x:11434) or http://host.docker.internal:11434 on Linux/Mac.";
  }
  if (code === "ETIMEDOUT") {
    return "Connection timeout — are you running CheapRoute in Docker? Use your host IP (e.g. http://192.168.x.x:11434) or http://host.docker.internal:11434 on Linux/Mac.";
  }
  return fallbackMessage;
}

function sanitizeAnthropicBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/messages(?:\?[^#]*)?$/i, "");
}

function sanitizeClaudeCodeCompatibleBaseUrl(baseUrl: string) {
  return (baseUrl || "")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/(?:v\d+\/)?messages(?:\?[^#]*)?$/i, "");
}

function extractUpstreamErrorMessage(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
    if (typeof parsed?.message === "string") return parsed.message;
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
  } catch {
    // not JSON
  }
  if (
    trimmed.length > 0 &&
    trimmed.length <= 300 &&
    !trimmed.startsWith("<!DOCTYPE") &&
    !trimmed.startsWith("<html")
  ) {
    return trimmed;
  }
  return null;
}

// Status-specific error message for /models probe failures.
function getModelsErrorMessage(status: number) {
  if (status === 401 || status === 403) return "API key unauthorized";
  if (status === 404) {
    return "/models endpoint not found - enter a Model ID to validate via chat/completions instead";
  }
  if (status >= 500) return "Server error - try again later";
  return `Unexpected response (${status})`;
}

// Status-specific error message for the /chat/completions fallback probe.
function getChatErrorMessage(status: number) {
  if (status === 401 || status === 403) return "API key unauthorized";
  if (status === 400) return "Invalid model or bad request";
  if (status === 404) return "Chat endpoint not found";
  if (status >= 500) return "Server error - try again later";
  return `Chat request failed (${status})`;
}

// Status-specific error message for the /audio/transcriptions fallback probe.
function getAudioTranscriptionErrorMessage(status: number) {
  if (status === 401 || status === 403) return "API key unauthorized";
  if (status === 400) return "Invalid transcription model or bad audio request";
  if (status === 404) return "Audio transcriptions endpoint not found";
  if (status >= 500) return "Server error - try again later";
  return `Audio transcription request failed (${status})`;
}

function buildTinyWavFile(): File {
  return new File(
    [
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74,
        0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e,
        0x00, 0x00, 0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
      ]),
    ],
    "cheaprouter-validation.wav",
    { type: "audio/wav" }
  );
}

async function probeChatFallback({
  baseUrl,
  apiKey,
  modelId,
  extraHeaders = {},
}: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  extraHeaders?: Record<string, string>;
}) {
  const chatUrl = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  return safeOutboundFetch(chatUrl, {
    ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
    guard: getProviderValidationGuard(),
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  });
}

async function probeAudioTranscriptionFallback({
  baseUrl,
  apiKey,
  modelId,
}: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
}) {
  const formData = new FormData();
  formData.set("model", modelId);
  formData.set("file", buildTinyWavFile());
  const transcriptionUrl = `${baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
  return safeOutboundFetch(transcriptionUrl, {
    ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
    guard: getProviderValidationGuard(),
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
}

function sanitizeAuditBaseUrl(baseUrl: string) {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "") || parsed.origin;
  } catch {
    return baseUrl;
  }
}

// POST /api/provider-nodes/validate - Validate API key against base URL
export async function POST(request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const auditContext = getAuditRequestContext(request);
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  try {
    const validation = validateBody(providerNodeValidateSchema, rawBody);
    if (isValidationFailure(validation)) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      baseUrl,
      apiKey,
      type,
      compatMode,
      apiType,
      chatPath,
      modelsPath,
      modelId,
      customHeaders: rawCustomHeaders,
    } = validation.data;
    const trimmedModelId = typeof modelId === "string" ? modelId.trim() : "";
    const customHeaders = (rawCustomHeaders || {}) as Record<string, string>;
    const startTime = Date.now();

    // Anthropic Compatible Validation
    if (type === "anthropic-compatible") {
      if (compatMode === "cc") {
        if (!isCcCompatibleProviderEnabled()) {
          return NextResponse.json(
            { valid: false, error: "CC Compatible provider is disabled" },
            { status: 403 }
          );
        }

        const result = await validateClaudeCodeCompatibleProvider({
          apiKey: apiKey || "",
          providerSpecificData: {
            baseUrl: sanitizeClaudeCodeCompatibleBaseUrl(baseUrl),
            chatPath: chatPath || undefined,
          },
        });

        const resData = result as {
          valid?: boolean;
          error?: string | null;
          warning?: string | null;
          method?: string | null;
        };
        return NextResponse.json({
          valid: !!resData.valid,
          error: resData.valid ? null : resData.error || "Invalid API key",
          warning: resData.warning || null,
          method: resData.method || null,
          latencyMs: Date.now() - startTime,
        });
      }

      // Robustly construct URL: remove trailing slash, and remove trailing /messages if user added it
      const normalizedBase = sanitizeAnthropicBaseUrl(baseUrl);
      const modelsUrl = `${normalizedBase}${modelsPath || "/models"}`;

      const probeHeaders: Record<string, string> = {
        "anthropic-version": "2023-06-01",
        ...customHeaders,
      };
      if (apiKey) {
        probeHeaders["x-api-key"] = apiKey;
        probeHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      let res: Response | null = null;
      let rawError = "";
      try {
        res = await safeOutboundFetch(modelsUrl, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
          guard: getProviderValidationGuard(),
          method: "GET",
          headers: probeHeaders,
        });
      } catch {
        // probe might fail, handle below
      }

      if (res && res.ok) {
        let discoveredModels: Array<{ id: string; name?: string }> = [];
        try {
          const data = await res.json();
          const rawModels = data?.data || data?.models || (Array.isArray(data) ? data : []);
          if (Array.isArray(rawModels)) {
            discoveredModels = rawModels
              .map((m: any) => ({
                id: typeof m === "string" ? m : m.id || m.name || m.model,
                name: typeof m === "string" ? m : m.display_name || m.name || m.id || m.model,
              }))
              .filter((m: any) => typeof m.id === "string" && m.id.length > 0);
          }
        } catch {
          // ignore
        }
        return NextResponse.json({
          valid: true,
          error: null,
          models: discoveredModels,
          totalModels: discoveredModels.length,
          probeUrl: modelsUrl,
          latencyMs: Date.now() - startTime,
        });
      }

      if (res) {
        try {
          rawError = await res.text();
        } catch {
          // ignore
        }
      }

      if (trimmedModelId) {
        const chatRes = await probeChatFallback({
          baseUrl: normalizedBase,
          apiKey: apiKey ?? "",
          modelId: trimmedModelId,
          extraHeaders: probeHeaders,
        });
        if (chatRes.ok) {
          return NextResponse.json({
            valid: true,
            error: null,
            method: "chat",
            latencyMs: Date.now() - startTime,
          });
        }
        let chatErrorText = "";
        try {
          chatErrorText = await chatRes.text();
        } catch {
          // ignore
        }
        return NextResponse.json({
          valid: false,
          statusCode: chatRes.status,
          error: extractUpstreamErrorMessage(chatErrorText) || getChatErrorMessage(chatRes.status),
          rawResponse: chatErrorText || null,
          method: "chat",
          latencyMs: Date.now() - startTime,
        });
      }

      const status = res ? res.status : 404;
      const parsedError = extractUpstreamErrorMessage(rawError);
      return NextResponse.json({
        valid: false,
        statusCode: status,
        error: parsedError || getModelsErrorMessage(status),
        rawResponse: rawError || null,
        latencyMs: Date.now() - startTime,
      });
    }

    // OpenAI Compatible / Gemini / Local Self-Hosted / Aggregator Router Validation
    let openAiBase = baseUrl.trim().replace(/\/$/, "");
    if (openAiBase.endsWith("/models")) {
      openAiBase = openAiBase.slice(0, -7).replace(/\/$/, "");
    }
    if (openAiBase.endsWith("/chat/completions")) {
      openAiBase = openAiBase.slice(0, -17).replace(/\/$/, "");
    } else if (openAiBase.endsWith("/completions")) {
      openAiBase = openAiBase.slice(0, -12).replace(/\/$/, "");
    }
    if (openAiBase.endsWith("/v1") && !openAiBase.endsWith("://v1")) {
      openAiBase = openAiBase.slice(0, -3).replace(/\/$/, "");
    }

    if (apiType === "audio-transcriptions") {
      if (!trimmedModelId) {
        return NextResponse.json({
          valid: false,
          error: "Model ID required to validate audio transcriptions",
          method: "audio-transcriptions",
        });
      }
      const transcriptionRes = await probeAudioTranscriptionFallback({
        baseUrl: openAiBase,
        apiKey: apiKey ?? "",
        modelId: trimmedModelId,
      });
      if (transcriptionRes.ok) {
        return NextResponse.json({
          valid: true,
          error: null,
          method: "audio-transcriptions",
          latencyMs: Date.now() - startTime,
        });
      }
      let transErrorText = "";
      try {
        transErrorText = await transcriptionRes.text();
      } catch {
        // ignore
      }
      return NextResponse.json({
        valid: false,
        statusCode: transcriptionRes.status,
        error:
          extractUpstreamErrorMessage(transErrorText) ||
          getAudioTranscriptionErrorMessage(transcriptionRes.status),
        rawResponse: transErrorText || null,
        method: "audio-transcriptions",
        latencyMs: Date.now() - startTime,
      });
    }

    const cleanRaw = baseUrl.trim().replace(/\/$/, "");
    const candidateUrls: string[] = [];

    if (modelsPath) {
      candidateUrls.push(`${openAiBase}${modelsPath}`);
    }

    // Provider-specific probe URL candidates
    if (type === "gemini-native" || cleanRaw.includes("googleapis.com")) {
      const geminiKeyParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : "";
      candidateUrls.push(
        `${cleanRaw}/v1beta/models${geminiKeyParam}`,
        `${cleanRaw.replace(/\/v1beta\/openai$/, "")}/v1beta/models${geminiKeyParam}`,
        `${cleanRaw}/v1beta/openai/models`,
        `${openAiBase}/models`
      );
    } else if (type === "local-self-hosted" || cleanRaw.includes("11434")) {
      // Ollama tags + standard models
      candidateUrls.push(
        `${cleanRaw}/api/tags`,
        `${cleanRaw.replace(/\/v1$/, "")}/api/tags`,
        `${openAiBase}/v1/models`,
        `${openAiBase}/models`,
        `${cleanRaw}/models`
      );
    } else {
      // Standard OpenAI / Aggregator / Generic
      if (cleanRaw.endsWith("/models")) candidateUrls.push(cleanRaw);
      candidateUrls.push(
        `${openAiBase}/v1/models`,
        `${openAiBase}/models`,
        `${cleanRaw}/models`,
        `${cleanRaw}/api/tags`
      );
    }

    const uniqueCandidateUrls = [...new Set(candidateUrls)];

    // Setup headers for probe
    const probeHeaders: Record<string, string> = { ...customHeaders };
    if (apiKey) {
      probeHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    if (type === "gemini-native" && apiKey) {
      probeHeaders["x-goog-api-key"] = apiKey;
    }
    if (type === "aggregator-router" || cleanRaw.includes("openrouter.ai")) {
      probeHeaders["HTTP-Referer"] = probeHeaders["HTTP-Referer"] || "https://cheaproute.ai";
      probeHeaders["X-Title"] = probeHeaders["X-Title"] || "CheapRoute";
    }

    let res: Response | null = null;
    let lastStatus = 0;
    let lastErrorBody = "";
    let discoveredModels: Array<{ id: string; name?: string }> = [];
    let successfulProbeUrl: string | null = null;

    for (const testUrl of uniqueCandidateUrls) {
      try {
        const response = await safeOutboundFetch(testUrl, {
          ...SAFE_OUTBOUND_FETCH_PRESETS.validationRead,
          guard: getProviderValidationGuard(),
          headers: probeHeaders,
        });
        if (response.ok) {
          res = response;
          successfulProbeUrl = testUrl;
          try {
            const data = await response.json();
            const rawModels = data?.data || data?.models || (Array.isArray(data) ? data : []);
            if (Array.isArray(rawModels)) {
              discoveredModels = rawModels
                .map((m: any) => {
                  let id = typeof m === "string" ? m : m.id || m.name || m.model || "";
                  if (typeof id === "string" && id.startsWith("models/")) {
                    id = id.slice(7);
                  }
                  const name =
                    typeof m === "string" ? m : m.displayName || m.name || m.id || m.model || id;
                  return {
                    id: String(id).trim(),
                    name: String(name).trim(),
                  };
                })
                .filter((m: any) => typeof m.id === "string" && m.id.length > 0);
            }
          } catch {
            // ignore JSON parse error on probe
          }
          break;
        }
        res = response;
        lastStatus = response.status;
        try {
          lastErrorBody = await response.text();
        } catch {
          // ignore
        }
      } catch {
        // Probe next candidate
      }
    }

    if (res && res.ok) {
      return NextResponse.json({
        valid: true,
        error: null,
        models: discoveredModels,
        totalModels: discoveredModels.length,
        probeUrl: successfulProbeUrl,
        latencyMs: Date.now() - startTime,
      });
    }

    if (trimmedModelId) {
      const chatRes = await probeChatFallback({
        baseUrl: openAiBase,
        apiKey: apiKey ?? "",
        modelId: trimmedModelId,
        extraHeaders: probeHeaders,
      });
      if (chatRes.ok) {
        return NextResponse.json({
          valid: true,
          error: null,
          method: "chat",
          latencyMs: Date.now() - startTime,
        });
      }
      let chatErrorText = "";
      try {
        chatErrorText = await chatRes.text();
      } catch {
        // ignore
      }
      return NextResponse.json({
        valid: false,
        statusCode: chatRes.status,
        error: extractUpstreamErrorMessage(chatErrorText) || getChatErrorMessage(chatRes.status),
        rawResponse: chatErrorText || null,
        method: "chat",
        latencyMs: Date.now() - startTime,
      });
    }

    const parsedError = extractUpstreamErrorMessage(lastErrorBody);
    return NextResponse.json({
      valid: false,
      statusCode: lastStatus || (res ? res.status : 404),
      error: parsedError || getModelsErrorMessage(lastStatus || (res ? res.status : 404)),
      rawResponse: lastErrorBody || null,
      latencyMs: Date.now() - startTime,
    });
  } catch (error) {
    const attemptedBaseUrl =
      rawBody && typeof rawBody === "object" && "baseUrl" in rawBody
        ? String((rawBody as { baseUrl?: unknown }).baseUrl || "")
        : "";
    const status = getSafeOutboundFetchErrorStatus(error);
    if (status) {
      const rawMessage =
        error instanceof SafeOutboundFetchError && error.code === "INVALID_URL"
          ? "Invalid provider base URL format"
          : error instanceof Error
            ? error.message
            : "Validation failed";
      const message = augmentDockerLocalhostHint(error, attemptedBaseUrl, rawMessage);
      if (error instanceof SafeOutboundFetchError && error.code === "URL_GUARD_BLOCKED") {
        logAuditEvent({
          action: "provider.validation.ssrf_blocked",
          actor: "admin",
          target: "provider-node",
          resourceType: "provider_validation",
          status: "blocked",
          ipAddress: auditContext.ipAddress || undefined,
          requestId: auditContext.requestId,
          metadata: {
            route: "/api/provider-nodes/validate",
            reason: message,
            baseUrl: sanitizeAuditBaseUrl(attemptedBaseUrl),
          },
        });
      }
      return NextResponse.json({ error: message }, { status });
    }
    console.log("Error validating provider node:", error);
    const message = augmentDockerLocalhostHint(error, attemptedBaseUrl, "Validation failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
