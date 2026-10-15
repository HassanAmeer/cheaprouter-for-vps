import type { RegistryEntry } from "../../shared.ts";
import {
  ANTHROPIC_BETA_API_KEY,
  ANTHROPIC_VERSION_HEADER,
  buildOpenAiCompatibleRegistryEntry,
} from "../../shared.ts";

// ── ap_* multi-provider gateway catalog ─────────────────────────────────────
// OpenAI-compatible routing (default executor, SSE byte passthrough, per-model
// failure isolation via passthroughModels). Multiple API keys per provider with
// rotation/fallback are handled generically by the auth layer.

export const apOpenaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_openai",
  alias: "ap_openai",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  modelsUrl: "https://api.openai.com/v1/models",
  passthroughModels: true,
  models: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "o1-preview", name: "o1 Preview" },
    { id: "o1-mini", name: "o1 Mini" },
  ],
});

export const apAnthropicProvider: RegistryEntry = {
  id: "ap_anthropic",
  alias: "ap_anthropic",
  format: "claude",
  executor: "default",
  baseUrl: "https://api.anthropic.com/v1/messages",
  urlSuffix: "?beta=true",
  authType: "apikey",
  authHeader: "x-api-key",
  defaultContextLength: 200000,
  headers: {
    "Anthropic-Version": ANTHROPIC_VERSION_HEADER,
    "Anthropic-Beta": ANTHROPIC_BETA_API_KEY,
  },
  passthroughModels: true,
  models: [
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2" },
    { id: "claude-3-haiku", name: "Claude 3 Haiku" },
  ],
};

export const apGoogleProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_google",
  alias: "ap_google",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  modelsUrl: "https://generativelanguage.googleapis.com/v1beta/openai/models",
  passthroughModels: true,
  models: [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
});

export const apMetaProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_meta",
  alias: "ap_meta",
  baseUrl: "https://api.meta.ai/v1/chat/completions",
  modelsUrl: "https://api.meta.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "llama-3-70b", name: "Llama 3 70B" },
    { id: "llama-3-8b", name: "Llama 3 8B" },
  ],
});

export const apDeepseekProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_deepseek",
  alias: "ap_deepseek",
  baseUrl: "https://api.deepseek.com/v1/chat/completions",
  modelsUrl: "https://api.deepseek.com/v1/models",
  passthroughModels: true,
  models: [
    { id: "deepseek-chat", name: "DeepSeek Chat" },
    { id: "deepseek-coder", name: "DeepSeek Coder" },
    { id: "deepseek-coder-v2", name: "DeepSeek Coder V2" },
    { id: "deepseek-reasoner", name: "DeepSeek R1 Reasoner" },
  ],
});

export const apOpenrouterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_openrouter",
  alias: "ap_openrouter",
  baseUrl: "https://openrouter.ai/api/v1/chat/completions",
  modelsUrl: "https://openrouter.ai/api/v1/models",
  testKeyModelsUrl: "https://openrouter.ai/api/v1/auth/key",
  headers: {
    "HTTP-Referer": "https://endpoint-proxy.local",
    "X-Title": "Endpoint Proxy",
  },
  passthroughModels: true,
  models: [
    { id: "deepseek/deepseek-v4-flash:free", name: "DeepSeek V4 Flash Free" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA Nemotron 3 Ultra Free" },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super Free" },
    {
      id: "nvidia/nemotron-3.5-content-safety:free",
      name: "NVIDIA Nemotron 3.5 Content Safety Free",
    },
    { id: "poolside/laguna-s-2.1:free", name: "Poolside Laguna S 2.1 Free" },
    { id: "inclusionai/ling-3.0-tiny:free", name: "Ling 3.0 Tiny Free" },
    { id: "openrouter/free", name: "Free Models Router" },
  ],
});

export const apOpencodeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_opencode",
  alias: "ap_opencode",
  baseUrl: "https://opencode.ai/zen/v1/chat/completions",
  modelsUrl: "https://opencode.ai/zen/v1/models",
  passthroughModels: true,
  models: [
    { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" },
    { id: "mimo-v2.5-free", name: "MiMo-V2.5 Free" },
    { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free" },
    { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free" },
    { id: "hy3-free", name: "HY3 Free" },
    { id: "big-pickle", name: "Big Pickle" },
  ],
});

export const apCohereProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_cohere",
  alias: "ap_cohere",
  baseUrl: "https://api.cohere.com/compatibility/v1/chat/completions",
  modelsUrl: "https://api.cohere.com/compatibility/v1/models",
  passthroughModels: true,
  models: [
    { id: "command-a-03-2025", name: "Command A" },
    { id: "command-a-reasoning-08-2025", name: "Command A Reasoning" },
    { id: "command-r7b-12-2024", name: "Command R7B" },
  ],
});

export const apGroqProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_groq",
  alias: "ap_groq",
  baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  modelsUrl: "https://api.groq.com/openai/v1/models",
  passthroughModels: true,
  models: [
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B" },
    { id: "openai/gpt-oss-20b", name: "GPT OSS 20B" },
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "openai/gpt-oss-safeguard-20b", name: "GPT OSS Safeguard 20B" },
    { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  ],
});

export const apCerebrasProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_cerebras",
  alias: "ap_cerebras",
  baseUrl: "https://api.cerebras.ai/v1/chat/completions",
  modelsUrl: "https://api.cerebras.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "gpt-oss-120b", name: "GPT OSS 120B" },
    { id: "zai-glm-4.7", name: "ZAI GLM 4.7" },
    { id: "gemma-4-31b", name: "Gemma 4 31B" },
  ],
});

export const apSambanovaProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_sambanova",
  alias: "ap_sambanova",
  baseUrl: "https://api.sambanova.ai/v1/chat/completions",
  modelsUrl: "https://api.sambanova.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "DeepSeek-V3.1", name: "DeepSeek V3.1" },
    { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct" },
    { id: "gpt-oss-120b", name: "GPT OSS 120B" },
  ],
});

export const apMistralaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_mistralai",
  alias: "ap_mistralai",
  baseUrl: "https://api.mistral.ai/v1/chat/completions",
  modelsUrl: "https://api.mistral.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "mistral-small-2506", name: "Mistral Small 3.2" },
    { id: "codestral-2501", name: "Codestral" },
    { id: "devstral-small-2505", name: "Devstral Small" },
  ],
});

export const apNvidianimProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_nvidianim",
  alias: "ap_nvidianim",
  baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
  modelsUrl: "https://integrate.api.nvidia.com/v1/models",
  passthroughModels: true,
  models: [
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra" },
    { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super" },
    { id: "nvidia/nemotron-3-nano-30b-a3b", name: "Nemotron 3 Nano 30B A3B" },
    { id: "nvidia/nemotron-nano-9b-v2", name: "Nemotron Nano 9B V2" },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B" },
    { id: "openai/gpt-oss-20b", name: "GPT OSS 20B" },
  ],
});

export const apXaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_xai",
  alias: "ap_xai",
  baseUrl: "https://api.x.ai/v1/chat/completions",
  modelsUrl: "https://api.x.ai/v1/models",
  passthroughModels: true,
  models: [],
});

export const apBytezProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_bytez",
  alias: "ap_bytez",
  baseUrl: "https://api.bytez.com/v1/chat/completions",
  modelsUrl: "https://api.bytez.com/v1/models",
  passthroughModels: true,
  models: [
    { id: "Qwen/Qwen2.5-7B-Instruct", name: "Qwen 2.5 7B Instruct" },
    { id: "meta-llama/Llama-3.1-8B-Instruct", name: "Llama 3.1 8B Instruct" },
  ],
});

export const apTokenharborProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_tokenharbor",
  alias: "ap_tokenharbor",
  baseUrl: "https://api.tokenharbor.ai/v1/chat/completions",
  modelsUrl: "https://api.tokenharbor.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
    { id: "mimo-v2.5", name: "MiMo V2.5" },
    { id: "kimi-k3", name: "Kimi K3" },
  ],
});

export const apTogetherProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_together",
  alias: "ap_together",
  baseUrl: "https://api.together.xyz/v1/chat/completions",
  modelsUrl: "https://api.together.xyz/v1/models",
  passthroughModels: true,
  models: [],
});

export const apFireworksProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_fireworks",
  alias: "ap_fireworks",
  baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
  modelsUrl: "https://api.fireworks.ai/inference/v1/models",
  passthroughModels: true,
  models: [],
});

export const apPerplexityProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_perplexity",
  alias: "ap_perplexity",
  baseUrl: "https://api.perplexity.ai/chat/completions",
  testKeyModelsUrl: "https://api.perplexity.ai/v1/models",
  passthroughModels: true,
  models: [],
});

export const apNovitaProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_novita",
  alias: "ap_novita",
  baseUrl: "https://api.novita.ai/v3/openai/chat/completions",
  modelsUrl: "https://api.novita.ai/v3/openai/models",
  passthroughModels: true,
  models: [],
});

export const apAimlapiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_aimlapi",
  alias: "ap_aimlapi",
  baseUrl: "https://api.aimlapi.com/v1/chat/completions",
  modelsUrl: "https://api.aimlapi.com/v1/models",
  passthroughModels: true,
  models: [],
});

export const apAiandProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_aiand",
  alias: "ap_aiand",
  baseUrl: "https://api.aiand.com/v1/chat/completions",
  modelsUrl: "https://api.aiand.com/v1/models",
  passthroughModels: true,
  models: [],
});

export const apAmazonbedrockProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_amazonbedrock",
  alias: "ap_amazonbedrock",
  baseUrl: "https://bedrock.proxy/v1/chat/completions",
  modelsUrl: "https://bedrock.proxy/v1/models",
  passthroughModels: true,
  models: [],
});

export const apGithubProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_github",
  alias: "ap_github",
  baseUrl: "https://models.inference.ai.azure.com/chat/completions",
  modelsUrl: "https://models.inference.ai.azure.com/models",
  passthroughModels: true,
  models: [],
});

export const apHuggingfaceProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_huggingface",
  alias: "ap_huggingface",
  baseUrl: "https://api-inference.huggingface.co/v1/chat/completions",
  modelsUrl: "https://api-inference.huggingface.co/v1/models",
  passthroughModels: true,
  models: [
    { id: "deepseek-ai/DeepSeek-V3-0324", name: "DeepSeek V3 0324" },
    { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen3 Coder 480B A35B" },
  ],
});

export const apHyperbolicProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_hyperbolic",
  alias: "ap_hyperbolic",
  baseUrl: "https://api.hyperbolic.ai/v1/chat/completions",
  modelsUrl: "https://api.hyperbolic.ai/v1/models",
  passthroughModels: true,
  models: [],
});

export const apMoonshotProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_moonshot",
  alias: "ap_moonshot",
  baseUrl: "https://api.moonshot.cn/v1/chat/completions",
  modelsUrl: "https://api.moonshot.cn/v1/models",
  passthroughModels: true,
  models: [],
});

export const apZaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_zai",
  alias: "ap_zai",
  baseUrl: "https://api.z.ai/v1/chat/completions",
  modelsUrl: "https://api.z.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "glm-4.7-flash", name: "GLM-4.7-Flash" },
    { id: "glm-4.6v-flash", name: "GLM-4.6V-Flash" },
  ],
});

export const apKilocodeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_kilocode",
  alias: "ap_kilocode",
  baseUrl: "https://api.kilo.ai/api/openrouter/chat/completions",
  modelsUrl: "https://api.kilo.ai/api/openrouter/models",
  anonymousApiKey: "anonymous",
  headers: {
    "X-KILOCODE-EDITORNAME": "CheapRoute",
  },
  passthroughModels: true,
  models: [
    { id: "kilo-auto/free", name: "Auto Free" },
    { id: "stepfun/step-5-preview-free", name: "StepFun Step 5 Preview (free)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra Free" },
    { id: "kilo-auto/efficient", name: "Auto Efficient" },
    { id: "kilo-auto/balanced", name: "Auto Balanced" },
    { id: "kilo-auto/frontier", name: "Auto Frontier" },
  ],
});

export const apClinecodeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_clinecode",
  alias: "ap_clinecode",
  baseUrl: "https://api.clinecode.ai/v1/chat/completions",
  modelsUrl: "https://api.clinecode.ai/v1/models",
  passthroughModels: true,
  models: [],
});

export const apPoixeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_poixe",
  alias: "ap_poixe",
  baseUrl: "https://api.poixe.com/v1/chat/completions",
  modelsUrl: "https://api.poixe.com/v1/models",
  passthroughModels: true,
  models: [
    { id: "claude-3-5-haiku-20241022:free", name: "Claude 3.5 Haiku Free" },
    { id: "cli2api/claude-sonnet-4-6:free", name: "Claude Sonnet 4.6 Free" },
    { id: "cli2api/gpt-5.3-codex:free", name: "GPT 5.3 Codex Free" },
  ],
});

export const apSiliconflowProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_siliconflow",
  alias: "ap_siliconflow",
  baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
  modelsUrl: "https://api.siliconflow.cn/v1/models",
  passthroughModels: true,
  models: [
    { id: "Qwen/Qwen3.5-4B", name: "Qwen3.5 4B" },
    { id: "PaddlePaddle/PaddleOCR-VL-1.5", name: "PaddleOCR-VL 1.5" },
    { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B", name: "DeepSeek R1 Distill Qwen 7B" },
    { id: "THUDM/GLM-4.1V-9B-Thinking", name: "GLM-4.1V-9B-Thinking" },
    { id: "deepseek-ai/DeepSeek-OCR", name: "DeepSeek OCR" },
    { id: "Qwen/Qwen3-8B", name: "Qwen3 8B" },
    { id: "tencent/Hunyuan-MT-7B", name: "Hunyuan-MT 7B" },
  ],
});

export const apZenmuxProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_zenmux",
  alias: "ap_zenmux",
  baseUrl: "https://api.zenmux.ai/v1/chat/completions",
  modelsUrl: "https://api.zenmux.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "z-ai/glm-4.7-flash-free", name: "GLM 4.7 Flash Free" },
    { id: "z-ai/glm-4.6v-flash-free", name: "GLM 4.6V Flash Free" },
    { id: "stepfun/step-3.5-flash-free", name: "Step 3.5 Flash Free" },
    { id: "xiaomi/mimo-v2-flash-free", name: "MiMo V2 Flash Free" },
    { id: "kuaishou/kat-coder-pro-v1-free", name: "KAT Coder Pro V1 Free" },
  ],
});

export const apUnorouterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_unorouter",
  alias: "ap_unorouter",
  baseUrl: "https://api.unorouter.com/v1/chat/completions",
  modelsUrl: "https://api.unorouter.com/v1/models",
  passthroughModels: true,
  models: [{ id: "free", name: "Free Model Pool" }],
});

export const apRoutewayProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_routeway",
  alias: "ap_routeway",
  baseUrl: "https://api.routeway.ai/v1/chat/completions",
  modelsUrl: "https://api.routeway.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "step-3-7-flash:free", name: "Step 3.7 Flash" },
    { id: "gemma-4-31b:free", name: "Gemma 4 31B" },
    { id: "gpt-oss-120b:free", name: "GPT OSS 120B" },
    { id: "ling-3.0-flash:free", name: "Ling 3.0 Flash" },
    { id: "nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B V2" },
    { id: "nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B A3B" },
    { id: "llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct" },
  ],
});

export const apStepfunProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_stepfun",
  alias: "ap_stepfun",
  baseUrl: "https://api.stepfun.com/v1/chat/completions",
  modelsUrl: "https://api.stepfun.com/v1/models",
  passthroughModels: true,
  models: [],
});

export const apLlm7Provider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_llm7",
  alias: "ap_llm7",
  baseUrl: "https://api.llm7.io/v1/chat/completions",
  modelsUrl: "https://api.llm7.io/v1/models",
  passthroughModels: true,
  models: [{ id: "free", name: "Free Model Pool" }],
});

export const apModelscopeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_modelscope",
  alias: "ap_modelscope",
  baseUrl: "https://api-inference.modelscope.cn/v1/chat/completions",
  modelsUrl: "https://api-inference.modelscope.cn/v1/models",
  passthroughModels: true,
  models: [
    { id: "Qwen/Qwen3-32B", name: "Qwen3 32B" },
    { id: "Qwen/Qwen3-235B-A22B-Instruct-2507", name: "Qwen3 235B A22B Instruct 2507" },
    { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", name: "Qwen3 Coder 480B A35B" },
  ],
});

export const apAihordeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_aihorde",
  alias: "ap_aihorde",
  baseUrl: "https://aihorde.net/api/v2/chat/completions",
  modelsUrl: "https://aihorde.net/api/v2/models",
  passthroughModels: true,
  models: [{ id: "meta-llama/Llama-3.1-8B-Instruct", name: "Llama 3.1 8B Instruct" }],
});

export const apPollinationsProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_pollinations",
  alias: "ap_pollinations",
  baseUrl: "https://text.pollinations.ai/v1/chat/completions",
  modelsUrl: "https://text.pollinations.ai/v1/models",
  passthroughModels: true,
  models: [
    { id: "gemini-3-flash", name: "Gemini 3 Flash" },
    { id: "gemini-flash-lite-3.1", name: "Gemini Flash Lite 3.1" },
    { id: "mistral-small-3.2", name: "Mistral Small 3.2" },
    { id: "qwen-coder", name: "Qwen Coder" },
    { id: "deepseek", name: "DeepSeek" },
  ],
});

export const apAnyrouterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_anyrouter",
  alias: "ap_anyrouter",
  baseUrl: "https://api.anyrouter.dev/v1/chat/completions",
  modelsUrl: "https://api.anyrouter.dev/v1/models",
  passthroughModels: true,
  models: [],
});

export const apAgnesaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_agnesai",
  alias: "ap_agnesai",
  baseUrl: "https://api.agnes-ai.com/v1/chat/completions",
  modelsUrl: "https://api.agnes-ai.com/v1/models",
  passthroughModels: true,
  models: [],
});

export const apTokenrouterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ap_tokenrouter",
  alias: "ap_tokenrouter",
  baseUrl: "https://api.tokenrouter.com/v1/chat/completions",
  modelsUrl: "https://api.tokenrouter.com/v1/models",
  passthroughModels: true,
  models: [],
});
