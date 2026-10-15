import type { RegistryEntry } from "../../shared.ts";

export const kilocodeProvider: RegistryEntry = {
  id: "kilocode",
  alias: "kc",
  // #DUAL-AUTH: kilocode is OAuth-primary (device-code) but also accepts a
  // direct Bearer API key from app.kilo.ai. Both paths use the same authPrefix
  // and baseUrl. Direct API keys are stored as authType:"apikey" connections
  // and rotated automatically. See DUAL_AUTH_PROVIDER_IDS in providers.ts.
  format: "openai",
  executor: "default",
  baseUrl: "https://api.kilo.ai/api/openrouter/chat/completions",
  modelsUrl: "https://api.kilo.ai/api/openrouter/models",
  authType: "oauth",
  authHeader: "Authorization",
  authPrefix: "Bearer ",
  // #4019: Kilo's gateway serves its free models anonymously when no account is
  // connected. Paired with `anonymousFallback: true` on the dashboard provider
  // entry, a request with no OAuth credential falls back to `Bearer anonymous`
  // (see DefaultExecutor) so the free tier works without signup. The editor-name
  // header is required by the gateway and is harmless on the authenticated path.
  anonymousApiKey: "anonymous",
  headers: {
    "X-KILOCODE-EDITORNAME": "CheapRoute",
  },
  oauth: {
    initiateUrl: "https://api.kilo.ai/api/device-auth/codes",
    pollUrlBase: "https://api.kilo.ai/api/device-auth/codes",
  },
  models: [
    { id: "kilo-auto/free", name: "Auto Free" },
    { id: "kilo-auto/efficient", name: "Auto Efficient" },
    { id: "kilo-auto/balanced", name: "Auto Balanced" },
    { id: "kilo-auto/frontier", name: "Auto Frontier" },
    { id: "stepfun/step-5-preview-free", name: "StepFun Step 5 Preview (free)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA Nemotron 3 Ultra (free)" },
    { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6" },
    { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
    { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5" },
    { id: "openai/gpt-5.2-chat", name: "GPT-5.2 Chat" },
    { id: "openai/gpt-5.1-codex", name: "GPT-5.1 Codex" },
    { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "deepseek/deepseek-v3.2", name: "DeepSeek V3.2", supportsReasoning: true },
    { id: "qwen/qwen3-max", name: "Qwen3 Max" },
    { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5" },
  ],
  passthroughModels: true,
};
