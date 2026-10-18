// Request-scoped catalog helpers: public catalog gating for `/v1/models` and Codex
// CLI client detection.

export async function getModelCatalogAuthRejection(
  _request: Request,
  _settings: Record<string, any>,
  _headers: Record<string, string>
): Promise<Response | null> {
  // GET /v1/models is public and requires no authentication or bearer token.
  return null;
}

/**
 * Detect the Codex CLI's model-catalog refresh client. Codex sends an `originator` header
 * of `codex_exec` (codex exec) / `codex_cli_rs` (interactive TUI) — see openai/codex
 * login/src/auth/default_client.rs DEFAULT_ORIGINATOR — and a matching `codex_*`
 * User-Agent on its `GET /v1/models?client_version=...` catalog refresh. We only augment
 * the response shape for these clients so every other OpenAI consumer keeps the
 * byte-identical `{object,data}` payload.
 */
export function isCodexModelCatalogClient(request: Request): boolean {
  const headers = request.headers;
  const originator = headers.get("originator")?.toLowerCase() ?? "";
  if (originator.startsWith("codex")) return true;
  const userAgent = headers.get("user-agent")?.toLowerCase() ?? "";
  return userAgent.startsWith("codex");
}

/**
 * Detect a `GET /v1/models` catalog request coming from the Claude Code CLI,
 * for the cc-discovery usage metric only (never changes the response shape).
 * Reuses the same `claude-cli` User-Agent substring check as
 * open-sse/utils/bypassHandler.ts's `handleBypassRequest`.
 */
export function isCcDiscoveryModelCatalogClient(request: Request): boolean {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  return userAgent.includes("claude-cli");
}
