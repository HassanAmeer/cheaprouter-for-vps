import type { RegistryEntry } from "../shared.ts";
import { buildOpenAiCompatibleRegistryEntry, getKiroServiceHeaders } from "../shared.ts";
import { kiroProvider } from "./kiro/index.ts";

export const piapiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "piapi",
  alias: "pi",
  baseUrl: "https://api.piapi.ai/v1/chat/completions",
  modelsUrl: "https://api.piapi.ai/v1/models",
  models: [],
  passthroughModels: true,
});

export const getgoapiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "getgoapi",
  alias: "ggo",
  baseUrl: "https://api.getgoapi.com/v1/chat/completions",
  modelsUrl: "https://api.getgoapi.com/v1/models",
  models: [],
  passthroughModels: true,
});

export const laozhangProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "laozhang",
  alias: "lz",
  baseUrl: "https://api.laozhang.ai/v1/chat/completions",
  modelsUrl: "https://api.laozhang.ai/v1/models",
  models: [],
  passthroughModels: true,
});

export const thebaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "thebai",
  alias: "thebai",
  baseUrl: "https://api.theb.ai/v1/chat/completions",
  modelsUrl: "https://api.theb.ai/v1/models",
  models: [],
  passthroughModels: true,
});

export const fenayaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "fenayai",
  alias: "fenayai",
  baseUrl: "https://api.fenayai.com/v1/chat/completions",
  modelsUrl: "https://api.fenayai.com/v1/models",
  models: [],
  passthroughModels: true,
});

export const empowerProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "empower",
  alias: "empower",
  baseUrl: "https://app.empower.dev/api/v1/chat/completions",
  modelsUrl: "https://app.empower.dev/api/v1/models",
  models: [],
  passthroughModels: true,
});

export const threeSixtyAiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "360ai",
  alias: "360ai",
  baseUrl: "https://api.360.cn/v1/chat/completions",
  modelsUrl: "https://api.360.cn/v1/models",
  models: [],
  passthroughModels: true,
});

export const clarifaiProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "clarifai",
  alias: "clarifai",
  baseUrl: "https://api.clarifai.com/v2/ext/openai/v1/chat/completions",
  modelsUrl: "https://api.clarifai.com/v2/ext/openai/v1/models",
  models: [],
  passthroughModels: true,
});

export const amazonQProvider: RegistryEntry = {
  id: "amazon-q",
  alias: "aq",
  format: "kiro",
  executor: "kiro",
  baseUrl: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse",
  authType: "oauth",
  authHeader: "bearer",
  defaultContextLength: 200000,
  headers: getKiroServiceHeaders(),
  oauth: {
    tokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
    authUrl: "https://prod.us-east-1.auth.desktop.kiro.dev",
  },
  models: kiroProvider.models,
};

export const ollamaLocalProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "ollama-local",
  alias: "ollama",
  baseUrl: "http://localhost:11434/v1/chat/completions",
  modelsUrl: "http://localhost:11434/v1/models",
  models: [],
  passthroughModels: true,
});

export const lmStudioProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "lm-studio",
  alias: "lmstudio",
  baseUrl: "http://localhost:1234/v1/chat/completions",
  modelsUrl: "http://localhost:1234/v1/models",
  models: [],
  passthroughModels: true,
});

export const vllmProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "vllm",
  alias: "vllm",
  baseUrl: "http://localhost:8000/v1/chat/completions",
  modelsUrl: "http://localhost:8000/v1/models",
  models: [],
  passthroughModels: true,
});

export const lemonadeProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "lemonade",
  alias: "lemonade",
  baseUrl: "http://localhost:13305/api/v1/chat/completions",
  modelsUrl: "http://localhost:13305/api/v1/models",
  models: [],
  passthroughModels: true,
});

export const opencodeCliProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "opencode-cli",
  alias: "opencode-cli",
  baseUrl: "http://localhost:4096/v1/chat/completions",
  modelsUrl: "http://localhost:4096/v1/models",
  models: [],
  passthroughModels: true,
});

export const kiloCodeCliProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "kilo-code-cli",
  alias: "kilo-code-cli",
  baseUrl: "http://localhost:4098/v1/chat/completions",
  modelsUrl: "http://localhost:4098/config/providers",
  models: [],
  passthroughModels: true,
});

export const llamafileProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "llamafile",
  alias: "llamafile",
  baseUrl: "http://127.0.0.1:8080/v1/chat/completions",
  modelsUrl: "http://127.0.0.1:8080/v1/models",
  models: [],
  passthroughModels: true,
});

export const llamaCppProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "llama-cpp",
  alias: "llamacpp",
  baseUrl: "http://127.0.0.1:8080/v1/chat/completions",
  modelsUrl: "http://127.0.0.1:8080/v1/models",
  models: [],
  passthroughModels: true,
});

export const xinferenceProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "xinference",
  alias: "xinference",
  baseUrl: "http://localhost:9997/v1/chat/completions",
  modelsUrl: "http://localhost:9997/v1/models",
  models: [],
  passthroughModels: true,
});

export const oobaboogaProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "oobabooga",
  alias: "oobabooga",
  baseUrl: "http://localhost:5000/v1/chat/completions",
  modelsUrl: "http://localhost:5000/v1/models",
  models: [],
  passthroughModels: true,
});

export const cheaprouterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "cheaprouter",
  alias: "cheaprouter",
  baseUrl: "http://localhost:20128/v1/chat/completions",
  modelsUrl: "http://localhost:20128/v1/models",
  models: [],
  passthroughModels: true,
});

export const githubModelsProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "github-models",
  alias: "ghm",
  baseUrl: "https://models.github.ai/inference/chat/completions",
  modelsUrl: "https://models.github.ai/inference/models",
  models: [
    { id: "gpt-4o", name: "GPT-4o (GitHub Free)", contextLength: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (GitHub Free)", contextLength: 128000 },
    { id: "o1", name: "OpenAI o1 (GitHub Free)", contextLength: 128000 },
    { id: "o3-mini", name: "OpenAI o3-mini (GitHub Free)", contextLength: 128000 },
    { id: "DeepSeek-R1", name: "DeepSeek-R1 (GitHub Free)", contextLength: 64000 },
    { id: "Llama-3.3-70B-Instruct", name: "Llama 3.3 70B (GitHub Free)", contextLength: 64000 },
    { id: "Mistral-large-2411", name: "Mistral Large (GitHub Free)", contextLength: 128000 },
    { id: "Phi-4", name: "Microsoft Phi-4 (GitHub Free)", contextLength: 16000 },
  ],
  passthroughModels: true,
});

export const pollinationsTextProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "pollinations-text",
  alias: "pol-text",
  baseUrl: "https://text.pollinations.ai/openai/chat/completions",
  modelsUrl: "https://text.pollinations.ai/models",
  models: [
    { id: "openai-fast", name: "GPT-OSS 20B Reasoning (🆓 Free)", contextLength: 32768 },
    { id: "openai", name: "OpenAI Fast (🆓 Free)", contextLength: 32768 },
    { id: "qwen-coder", name: "Qwen 2.5 Coder (🆓 Free)", contextLength: 32768 },
    { id: "mistral", name: "Mistral (🆓 Free)", contextLength: 32768 },
    { id: "deepseek", name: "DeepSeek (🆓 Free)", contextLength: 64000 },
  ],
  passthroughModels: true,
});

export const puterProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "puter",
  alias: "puter",
  baseUrl: "https://api.puter.com/puterai/openai/v1/chat/completions",
  modelsUrl: "https://api.puter.com/puterai/openai/v1/models",
  models: [
    { id: "gpt-4o", name: "GPT-4o (Puter)", contextLength: 128000 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Puter)", contextLength: 128000 },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet (Puter)", contextLength: 200000 },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku (Puter)", contextLength: 200000 },
    { id: "deepseek-chat", name: "DeepSeek V3 (Puter)", contextLength: 64000 },
    { id: "deepseek-reasoner", name: "DeepSeek R1 (Puter)", contextLength: 64000 },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Puter)", contextLength: 1000000 },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Puter)", contextLength: 1000000 },
  ],
  passthroughModels: true,
});

export const hunyuanProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "hunyuan",
  alias: "hunyuan",
  baseUrl: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  modelsUrl: "https://api.hunyuan.cloud.tencent.com/v1/models",
  models: [
    { id: "hunyuan-lite", name: "Hunyuan Lite (🆓 Free Forever)", contextLength: 256000 },
    { id: "hunyuan-standard", name: "Hunyuan Standard", contextLength: 256000 },
    { id: "hunyuan-pro", name: "Hunyuan Pro", contextLength: 256000 },
    { id: "hunyuan-code", name: "Hunyuan Code", contextLength: 64000 },
  ],
  passthroughModels: true,
});

export const leptonProvider: RegistryEntry = buildOpenAiCompatibleRegistryEntry({
  id: "lepton",
  alias: "lepton",
  baseUrl: "https://api.lepton.ai/v1/chat/completions",
  modelsUrl: "https://api.lepton.ai/v1/models",
  models: [
    { id: "llama3-3-70b", name: "Llama 3.3 70B (Lepton)", contextLength: 128000 },
    { id: "deepseek-r1", name: "DeepSeek R1 (Lepton)", contextLength: 64000 },
    { id: "deepseek-v3", name: "DeepSeek V3 (Lepton)", contextLength: 64000 },
  ],
  passthroughModels: true,
});
