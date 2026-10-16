import type { RegistryEntry } from "../../shared.ts";

export const antseedProvider: RegistryEntry = {
  id: "antseed",
  alias: "ant",
  format: "openai",
  executor: "default",
  baseUrl: "http://127.0.0.1:8377/v1/chat/completions",
  authType: "none",
  authHeader: "none",
  defaultContextLength: 200000,
  models: [
    { id: "glm-5.1", name: "GLM 5.1", contextLength: 200000, supportsReasoning: true },
    { id: "glm-5.3-flash", name: "GLM 5.3 Flash", contextLength: 200000, supportsReasoning: true },
    { id: "deepseek-v4", name: "DeepSeek V4", contextLength: 128000, supportsReasoning: true },
    { id: "qwen-2.5-coder-32b", name: "Qwen 2.5 Coder 32B", contextLength: 128000 },
    { id: "abliterated-large-v2", name: "Abliterated Large V2", contextLength: 128000 },
  ],
};
