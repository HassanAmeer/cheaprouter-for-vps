/**
 * Customizable status code error message resolver.
 *
 * Reads STATUS_CODE_MESSAGE_<CODE> (or ERROR_MESSAGE_<CODE>) from process.env.
 * Supports dynamic template placeholders:
 *   {error}    - The underlying sanitized error message from upstream / router
 *   {provider} - The provider name (e.g. OpenAI, Anthropic, Groq) if available
 *   {model}    - The model name requested (e.g. gpt-4o, claude-3-7-sonnet) if available
 *   {code}     - The HTTP status code number (e.g. 429, 500)
 *   {status}   - Alias for {code}
 *
 * If the environment variable for a status code is unset, null, or empty,
 * this returns null so callers can fall back via the nullish coalescing operator (??).
 */

export interface ErrorTemplateContext {
  error?: string | null;
  provider?: string | null;
  model?: string | null;
  code?: number | string | null;
  reason?: string | null;
  [key: string]: unknown;
}

/**
 * Extract provider / model hints if present in the error message or details.
 */
export function extractErrorContextHints(
  message?: string | null,
  details?: unknown
): { provider?: string; model?: string } {
  let provider: string | undefined;
  let model: string | undefined;

  if (details && typeof details === "object" && !Array.isArray(details)) {
    const obj = details as Record<string, unknown>;
    if (typeof obj.provider === "string" && obj.provider.trim()) {
      provider = obj.provider.trim();
    }
    if (typeof obj.model === "string" && obj.model.trim()) {
      model = obj.model.trim();
    } else if (typeof obj.modelId === "string" && obj.modelId.trim()) {
      model = obj.modelId.trim();
    }
  }

  const text = message || "";
  if (!provider && text) {
    const provMatch =
      text.match(/\bprovider\s*[:=]\s*["']?([a-zA-Z0-9_-]+)["']?/i) ||
      text.match(/upstream\s+provider\s+["']?([a-zA-Z0-9_-]+)["']?/i) ||
      text.match(/\[([a-zA-Z0-9_-]+)\/[a-zA-Z0-9._-]+\]/);
    if (provMatch) provider = provMatch[1];
  }

  if (!model && text) {
    const modelMatch =
      text.match(/\bmodel\s*[:=]\s*["']?([a-zA-Z0-9._:-]+)["']?/i) ||
      text.match(/\[[a-zA-Z0-9_-]+\/([a-zA-Z0-9._-]+)\]/);
    if (modelMatch) model = modelMatch[1];
  }

  return { provider, model };
}

/**
 * Format an error message template with provided context.
 */
export function formatErrorTemplate(
  template: string,
  statusCode: number,
  errorText?: string | null,
  context?: ErrorTemplateContext
): string {
  const codeStr = String(statusCode);
  const errorStr = (errorText || context?.error || "").trim();
  const providerStr = (context?.provider || "").trim();
  const modelStr = (context?.model || "").trim();

  let formatted = template
    .replace(/\{code\}/gi, codeStr)
    .replace(/\{status\}/gi, codeStr)
    .replace(/\{provider\}/gi, providerStr)
    .replace(/\{model\}/gi, modelStr)
    .replace(/\{error\}/gi, errorStr);

  // Clean up punctuation / formatting artifacts when placeholders were empty
  if (!errorStr) {
    formatted = formatted
      .replace(/:\s*$/g, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\[\s*\]/g, "");
  }
  if (!providerStr) {
    formatted = formatted
      .replace(/upstream provider\s+encountered/gi, "Upstream provider encountered")
      .replace(/provider\s+\(/gi, "(")
      .replace(/\(\s*\)/g, "");
  }
  if (!modelStr) {
    formatted = formatted.replace(/\(\s*\)/g, "");
  }

  // Normalize duplicate whitespace and trim
  return formatted.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

/**
 * Resolve custom status code message from process.env with fallback to null.
 */
export function resolveCustomStatusCodeMessage(
  statusCode: number,
  rawMessage?: string | null,
  context?: ErrorTemplateContext
): string | null {
  const envKey = `STATUS_CODE_MESSAGE_${statusCode}`;
  const envVal =
    process.env[envKey] ??
    process.env[`ERROR_MESSAGE_${statusCode}`] ??
    process.env[`CHEAPROUTE_ERROR_MESSAGE_${statusCode}`];

  if (typeof envVal !== "string" || !envVal.trim()) {
    return null;
  }

  const hints = extractErrorContextHints(rawMessage, context);
  const mergedContext: ErrorTemplateContext = {
    ...context,
    provider: context?.provider || hints.provider,
    model: context?.model || hints.model,
  };

  return formatErrorTemplate(envVal.trim(), statusCode, rawMessage, mergedContext);
}
