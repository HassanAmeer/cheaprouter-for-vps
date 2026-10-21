import type { RegistryEntry } from "../../shared.ts";

export const opencodeBypassProvider: RegistryEntry = {
  id: "opencode-bypass",
  alias: "oc-bypass",
  format: "openai",
  executor: "opencode-bypass",
  baseUrl: "https://opencode.ai/inference/v1",
  modelsUrl: "https://opencode.ai/inference/v1/models",
  authType: "apikey",
  authHeader: "Authorization",
  authPrefix: "Bearer",
  passthroughModels: true,
  defaultContextLength: 200000,
  models: [
    {
      id: "deepseek-v4.1-flash-free",
      name: "DeepSeek V4.1 Flash Free",
      supportsReasoning: true,
      interleavedField: "reasoning_content",
    },
    {
      id: "glm-5.3-flash-free",
      name: "GLM 5.3 Flash Free",
      supportsReasoning: true,
    },
    {
      id: "minimax-m3.1-flash-free",
      name: "MiniMax M3.1 Flash Free",
      supportsReasoning: true,
    },
    {
      id: "beam-free",
      name: "Beam Free",
    },
    {
      id: "big-pickle",
      name: "Big Pickle",
      supportsReasoning: true,
      interleavedField: "reasoning_content",
    },
    {
      id: "mimo-v2.6-flash-free",
      name: "MiMo V2.6 Flash Free",
    },
    {
      id: "nemotron-3.5-super-vl-free",
      name: "Nemotron 3.5 Super VL Free",
    },
    {
      id: "nemotron-3.5-lightning-free",
      name: "Nemotron 3.5 Lightning Free",
    },
    {
      id: "deepseek-v4-1-flash-free",
      name: "DeepSeek V4.1 Flash Free (Alias)",
      supportsReasoning: true,
    },
    {
      id: "kimi-k3-free",
      name: "Kimi K3 Free",
      supportsReasoning: true,
    },
  ],
};
