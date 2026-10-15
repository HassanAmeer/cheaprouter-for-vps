"use client";

import React, { useState } from "react";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  NOAUTH_PROVIDERS,
  OAUTH_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  LOCAL_PROVIDERS,
  APIKEY_PROVIDERS,
  AI_PROVIDERS,
} from "@/shared/constants/providers";

export interface ProviderGuideData {
  authTypeBadge: string;
  authTypeColor: "emerald" | "orange" | "blue" | "purple";
  isCompletelyFree: boolean;
  topSummaryText: string;

  requirements: {
    loginStatus: string;
    creditCardStatus: string;
    credentialsNeeded: string;
    connectionType: string;
    toolsSupported: string;
  };

  limits: {
    rateLimitBadge: string;
    rateLimitDetail: string;
    quotaReset?: string;
  };

  freeModels: Array<{ id: string; name: string; notes?: string }>;

  connectSteps: Array<{
    step: number;
    title: string;
    instruction: string;
  }>;
}

export const PROVIDER_GUIDES: Record<string, ProviderGuideData> = {
  // ── 1. DuckDuckGo AI Chat ──────────────────────────────────────────────
  "duckduckgo-web": {
    authTypeBadge: "100% Free • No Auth",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free without credit card • 30–60 requests/minute",
    requirements: {
      loginStatus: "Without Login (Zero Signup / No Account)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "None (Built-in & Auto-connected)",
      connectionType: "Built-in Anonymous Connector",
      toolsSupported: "CheapRouter Web Chat, /v1 API, OpenCode CLI, Kilo, Cline",
    },
    limits: {
      rateLimitBadge: "30–60 requests / minute",
      rateLimitDetail:
        "Completely anonymous and free. Dynamic rate limit of 30–60 requests per minute with unlimited daily chats. No credit deductions or token billing counters.",
      quotaReset: "Stateless sessions reset automatically every 1–2 minutes if throttled.",
    },
    freeModels: [
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", notes: "Anthropic fast reasoning" },
      { id: "gpt-5.4-mini", name: "GPT-5.4 mini", notes: "OpenAI fast intelligence" },
      { id: "gpt-6-luna", name: "GPT-6 Luna", notes: "OpenAI latest free tier" },
      { id: "mistral-small-2603", name: "Mistral Small 4", notes: "Mistral AI reasoning" },
      { id: "tinfoil/gpt-oss-120b", name: "GPT OSS 120B", notes: "Massive open weights" },
      { id: "tinfoil/gemma4-31b", name: "Gemma 4 31B", notes: "Google open model" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "No Credentials Required",
        instruction:
          "DuckDuckGo requires zero registration, email, or API key. It is pre-configured and active in CheapRouter by default.",
      },
      {
        step: 2,
        title: "Verify Connection",
        instruction:
          "Go to the Available Models list below or Web Chat, and click 'Test' on Claude Haiku 4.5 to confirm live responses.",
      },
      {
        step: 3,
        title: "Route in Chat or CLI",
        instruction:
          "Use model 'duckduckgo-web/claude-haiku-4-5' in Web Chat or your terminal CLI. CheapRouter manages all session tokens automatically.",
      },
    ],
  },

  // ── 2. Cloudflare AI Playground ────────────────────────────────────────
  "cloudflare-playground": {
    authTypeBadge: "100% Free • No Login",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free without credit card • 15–30 requests/minute",
    requirements: {
      loginStatus: "Without Login (No Account / No Token)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "None (Built-in Chromium WebSocket Session)",
      connectionType: "Headless WebSocket Session",
      toolsSupported: "CheapRouter Web Chat, /v1 API routes, CLI tools",
    },
    limits: {
      rateLimitBadge: "15–30 requests / minute",
      rateLimitDetail:
        "Free WebSocket sessions powered by Playwright Chromium. Zero signup required. If rate limited, a dynamic 1-minute cooldown applies before resuming.",
      quotaReset: "Dynamic 60-second sliding window.",
    },
    freeModels: [
      { id: "glm-5-2", name: "GLM 5.2", notes: "Zhipu AI high performance" },
      { id: "kimi-k2-7-code", name: "Kimi K2.7 Code", notes: "Moonshot coding model" },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", notes: "DeepSeek high intelligence" },
      { id: "gpt-oss-120b", name: "GPT-OSS 120B", notes: "Massive open model" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Automatic Built-in Connector",
        instruction:
          "Cloudflare AI Playground uses an automated WebSocket protocol. No account, API token, or credit card is needed.",
      },
      {
        step: 2,
        title: "Verify in CheapRouter",
        instruction:
          "Click the 'Test' button on 'cloudflare-playground/glm-5-2' to spin up the session and verify live response.",
      },
      {
        step: 3,
        title: "Start Routing",
        instruction:
          "Send prompts with model 'cloudflare-playground/<model-id>' in Web Chat or via API.",
      },
    ],
  },

  // ── 3. Cloudflare Workers AI ───────────────────────────────────────────
  cloudflare: {
    authTypeBadge: "Free Tier (10k Neurons/Day)",
    authTypeColor: "orange",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 10,000 Neurons/day",
    requirements: {
      loginStatus: "Free Cloudflare Account (dash.cloudflare.com)",
      creditCardStatus: "No Credit Card Required (0% Cost on free tier)",
      credentialsNeeded: "Account ID + API Token (Workers AI Read)",
      connectionType: "Account ID + Token Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, OpenCode CLI, Kilo",
    },
    limits: {
      rateLimitBadge: "10,000 Neurons / Day",
      rateLimitDetail:
        "10,000 free neurons daily equals roughly 100,000 words or 200+ complete reasoning chats every single day on Llama 3.3 70B and DeepSeek R1.",
      quotaReset: "Resets every day at 00:00 UTC.",
    },
    freeModels: [
      { id: "llama-3.3-70b-instruct", name: "Llama 3.3 70B", notes: "Meta flagship open model" },
      { id: "deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 32B", notes: "High reasoning coding" },
      { id: "qwen2.5-coder-32b-instruct", name: "Qwen 2.5 Coder", notes: "Specialized for coding" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Cloudflare Account ID & Token",
        instruction:
          "Sign in to dash.cloudflare.com. In Workers & Pages → Overview, copy your 'Account ID'. Then go to My Profile → API Tokens → Create Token with 'Workers AI Read' permissions.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Cloudflare provider card, click 'Add Connection'. Enter your Account ID and API Token into the respective fields and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click the 'Test' button on Llama 3.3 70B to confirm CheapRouter can reach Workers AI successfully.",
      },
    ],
  },

  // ── 4. Groq Cloud ──────────────────────────────────────────────────────
  groq: {
    authTypeBadge: "Free API Tier (14.4k RPD)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free API Tier • No credit card required • 14,400 chats/day",
    requirements: {
      loginStatus: "Free Account Required (console.groq.com)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "API Key (starts with gsk_...)",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, /v1 API routes, OpenCode, Cline",
    },
    limits: {
      rateLimitBadge: "30 req/min & 14,400 req/day",
      rateLimitDetail:
        "Official generous free tier with zero card required. You get 30 requests every minute and up to 14,400 chats per day at ultra-fast 300+ tokens/second for Llama 3.3 70B (6,000 tokens/minute on 70B).",
      quotaReset: "Sliding 1-minute window for RPM; daily requests reset at 00:00 UTC.",
    },
    freeModels: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", notes: "Fastest 70B reasoning (300+ tok/s)" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", notes: "Ultra low latency (500 tok/s)" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", notes: "Long context window" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Generate Groq API Key",
        instruction:
          "Sign in to console.groq.com with email or GitHub. Go to 'API Keys' and click 'Create API Key'. Copy your key (gsk_...).",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Groq provider card in CheapRouter, click 'Add Connection'. Paste your API Key and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'groq/llama-3.3-70b-versatile'. A green checkmark confirms ready for routing.",
      },
    ],
  },

  // ── 5. Google Gemini / AI Studio ───────────────────────────────────────
  google: {
    authTypeBadge: "Free Tier (1,500 RPD)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 1,500 chats/day",
    requirements: {
      loginStatus: "Free Google Account (aistudio.google.com)",
      creditCardStatus: "No Credit Card Required (0% Cost)",
      credentialsNeeded: "API Key (starts with AIza...)",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, /v1 API routes, all CLIs",
    },
    limits: {
      rateLimitBadge: "15 req/min & 1,500 req/day",
      rateLimitDetail:
        "Google AI Studio gives 15 requests per minute and 1,500 free requests per day for Gemini 2.5 Flash and Pro without entering a credit card (1,000,000 tokens/minute on Flash).",
      quotaReset: "Resets daily at midnight Pacific Time.",
    },
    freeModels: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", notes: "Ultra fast multimodal" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", notes: "State of the art reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Free Google API Key",
        instruction:
          "Visit aistudio.google.com with any standard Google account. Click 'Get API key' → 'Create API key'.",
      },
      {
        step: 2,
        title: "Paste into CheapRouter",
        instruction:
          "On the Google provider card, click 'Add Connection'. Paste your AIza... key and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'google/gemini-2.5-flash' to verify instant multimodal inference.",
      },
    ],
  },

  // ── 6. Cerebras ────────────────────────────────────────────────────────
  cerebras: {
    authTypeBadge: "Free Tier (1M Tokens/Day)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 1,000,000 tokens/day",
    requirements: {
      loginStatus: "Free Account Required (cloud.cerebras.ai)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "API Key (starts with csk-...)",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, OpenCode CLI",
    },
    limits: {
      rateLimitBadge: "30 req/min & 1,000,000 tokens/day",
      rateLimitDetail:
        "1,000,000 free tokens per day equals about 750,000 words (or 1,500 full pages of text) every day at 1,000+ tokens/second without any credit card.",
      quotaReset: "Resets daily at 00:00 UTC.",
    },
    freeModels: [
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", notes: "1,000+ tokens/sec Wafer-Scale chip" },
      { id: "llama-3.1-8b", name: "Llama 3.1 8B", notes: "Instantaneous responses" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Sign Up at Cerebras",
        instruction:
          "Sign up at cloud.cerebras.ai (no credit card needed). Go to 'API Keys' and generate a key.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Cerebras card, click 'Add Connection'. Paste your key and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'cerebras/llama-3.3-70b' to see ultra-fast 1,000+ tokens/sec output.",
      },
    ],
  },

  // ── 7. SambaNova ───────────────────────────────────────────────────────
  sambanova: {
    authTypeBadge: "Free Tier (200k tok/min)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 10 req/min & 200k tok/min",
    requirements: {
      loginStatus: "Free Account Required (cloud.sambanova.ai)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "API Key",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, coding CLIs",
    },
    limits: {
      rateLimitBadge: "10 req/min & 200k tok/min",
      rateLimitDetail:
        "SambaNova provides 10 requests per minute and 200,000 tokens per minute for Llama 3.3 70B, Qwen 2.5 72B, and DeepSeek R1 with zero card required.",
      quotaReset: "Sliding 1-minute window.",
    },
    freeModels: [
      { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", notes: "Full capability 70B" },
      { id: "Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B", notes: "Flagship open coding model" },
      { id: "DeepSeek-R1", name: "DeepSeek R1", notes: "Chain of thought reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get SambaNova API Key",
        instruction:
          "Create a free account at cloud.sambanova.ai. Navigate to API Keys and copy your key.",
      },
      {
        step: 2,
        title: "Paste into CheapRouter",
        instruction:
          "Click 'Add Connection' on the SambaNova provider card and paste your API key.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'sambanova/Meta-Llama-3.3-70B-Instruct' to verify connectivity.",
      },
    ],
  },

  // ── 8. GitHub Models ───────────────────────────────────────────────────
  github: {
    authTypeBadge: "Free Tier (150 RPD)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 150 chats/day",
    requirements: {
      loginStatus: "Free GitHub Account",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "Personal Access Token (PAT with model permissions)",
      connectionType: "GitHub PAT Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, IDEs",
    },
    limits: {
      rateLimitBadge: "15 req/min & 150 req/day",
      rateLimitDetail:
        "15 requests per minute and 150 chats per day on Azure AI infrastructure for GPT-4o, Claude 3.5 Sonnet, and Llama 3.3 70B.",
      quotaReset: "Resets daily at 00:00 UTC.",
    },
    freeModels: [
      { id: "gpt-4o", name: "OpenAI GPT-4o", notes: "Frontier multimodal" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", notes: "Anthropic premier coding" },
      { id: "meta-llama-3.3-70b-instruct", name: "Llama 3.3 70B", notes: "Meta open weights" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create GitHub PAT",
        instruction:
          "Visit github.com/settings/tokens. Create a Personal Access Token with model permissions.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on GitHub Models in CheapRouter and paste your PAT token.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'github/gpt-4o' to verify Azure AI inference.",
      },
    ],
  },

  // ── 9. OpenRouter (:free models) ───────────────────────────────────────
  openrouter: {
    authTypeBadge: "Free Models Tier ($0.00)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Models • $0.00 Cost on 20+ ':free' models",
    requirements: {
      loginStatus: "Free Account Required (openrouter.ai)",
      creditCardStatus: "No Credit Card Required for ':free' models",
      credentialsNeeded: "API Key (starts with sk-or-...)",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, all CLIs",
    },
    limits: {
      rateLimitBadge: "20 req/min on ':free' models",
      rateLimitDetail:
        "OpenRouter hosts 20+ models ending with ':free' that are 100% free with $0.00 credit balance.",
      quotaReset: "Sliding 1-minute window.",
    },
    freeModels: [
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Free", notes: "Free tier" },
      { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash Free", notes: "Free tier" },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 Free", notes: "Free reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create OpenRouter Key",
        instruction:
          "Sign up at openrouter.ai and generate a key under 'Keys' (sk-or-...).",
      },
      {
        step: 2,
        title: "Connect in CheapRouter",
        instruction:
          "On the OpenRouter card, click 'Add Connection', paste your key, and save.",
      },
      {
        step: 3,
        title: "Test Free Model",
        instruction:
          "Test with any model ending in ':free' (e.g. meta-llama/llama-3.3-70b-instruct:free).",
      },
    ],
  },

  // ── 10. CheapRouter CLI / Antseed (Local) ─────────────────────────────
  antseed: {
    authTypeBadge: "Local P2P Service",
    authTypeColor: "purple",
    isCompletelyFree: true,
    topSummaryText: "Local P2P Daemon • Port 8377 • Zero network cost",
    requirements: {
      loginStatus: "No Internet Account (Local Machine / VPS Daemon)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "None (Runs locally on 127.0.0.1:8377)",
      connectionType: "Local P2P Service",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints, local CLI commands",
    },
    limits: {
      rateLimitBadge: "Unlimited Local Speed",
      rateLimitDetail:
        "Runs directly on your machine or VPS port 8377 as an ultra-fast local daemon. Zero network latency, no rate limit, no token charges.",
      quotaReset: "Unlimited continuous local speed.",
    },
    freeModels: [
      { id: "glm-5.3-flash", name: "GLM 5.3 Flash", notes: "Ultra fast local coding assistant" },
      { id: "abliterated-large-v2", name: "Abliterated Large V2", notes: "Uncensored assistant" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Verify Local Daemon Status",
        instruction:
          "In your terminal, run 'systemctl status cheaprouter-cli' or 'cheaprouter-cli status' to ensure port 8377 is active.",
      },
      {
        step: 2,
        title: "Automatic Local Connection",
        instruction:
          "CheapRouter connects directly to http://127.0.0.1:8377 without needing an API key or internet credentials.",
      },
      {
        step: 3,
        title: "Test Local Model",
        instruction:
          "Click 'Test' on 'antseed/glm-5.3-flash' to verify instant local execution.",
      },
    ],
  },

  // ── 11. OpenCode Free ──────────────────────────────────────────────────
  opencode: {
    authTypeBadge: "100% Free • Public Endpoint",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free without credit card • ~20 requests/minute",
    requirements: {
      loginStatus: "Without Login (Public Endpoint)",
      creditCardStatus: "No Credit Card Required (0% Cost)",
      credentialsNeeded: "None (Built-in Public Endpoint)",
      connectionType: "Built-in / No Auth",
      toolsSupported: "CheapRouter Web Chat, OpenCode CLI, API routes",
    },
    limits: {
      rateLimitBadge: "~20 requests / minute",
      rateLimitDetail:
        "Public endpoint at https://opencode.ai/zen/v1. No account, signup, or card needed. Requests matching OpenCode contracts run directly.",
      quotaReset: "Sliding 1-minute window.",
    },
    freeModels: [
      { id: "kimi-k2.5", name: "Kimi K2.5", notes: "Free coding & reasoning" },
      { id: "qwen-2.5-coder", name: "Qwen 2.5 Coder", notes: "Specialized for programming" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Pre-Configured Endpoint",
        instruction:
          "OpenCode endpoint is pre-configured in CheapRouter. No account or key registration is needed.",
      },
      {
        step: 2,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'opencode/kimi-k2.5' to verify live responses.",
      },
      {
        step: 3,
        title: "Use in Web Chat or CLI",
        instruction:
          "Use 'opencode/<model-id>' in Web Chat or run via terminal with 'opencode run'.",
      },
    ],
  },

  // ── 12. Pollinations AI ────────────────────────────────────────────────
  pollinations: {
    authTypeBadge: "100% Free • Keyless",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free without credit card • 10–20 requests/minute",
    requirements: {
      loginStatus: "Without Login (Zero Signup / Keyless)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "None (Enter 'unused' if prompted)",
      connectionType: "Built-in / No Auth",
      toolsSupported: "CheapRouter Web Chat, text & image generation routes",
    },
    limits: {
      rateLimitBadge: "10–20 req/min (Dynamic Free Queue)",
      rateLimitDetail:
        "Pollinations AI offers keyless open access for text and image generations. Free models include OpenAI, Mistral, Qwen Coder, DeepSeek, and Flux image generation. Dynamic community queue with no token balance deductions.",
      quotaReset: "Dynamic community queue.",
    },
    freeModels: [
      { id: "openai-fast", name: "OpenAI Fast", notes: "High speed chat" },
      { id: "qwen-coder", name: "Qwen Coder", notes: "Coding assistant" },
      { id: "mistral", name: "Mistral", notes: "Reasoning and general text" },
      { id: "deepseek", name: "DeepSeek", notes: "Open intelligence" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Keyless Public Endpoint",
        instruction:
          "Connects to https://text.pollinations.ai/v1 directly without registration.",
      },
      {
        step: 2,
        title: "Configure in CheapRouter",
        instruction:
          "If a connection modal asks for an API key, enter any dummy text like 'unused'.",
      },
      {
        step: 3,
        title: "Test & Use",
        instruction:
          "Click 'Test' on 'pollinations/openai-fast' to verify live text output.",
      },
    ],
  },

  // ── 13. SiliconFlow ────────────────────────────────────────────────────
  siliconflow: {
    authTypeBadge: "20M Free Tokens ($0.00 Models)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 20 Million Free Tokens",
    requirements: {
      loginStatus: "Free Account Required (cloud.siliconflow.com)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "API Key (starts with sk-...)",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, CLIs",
    },
    limits: {
      rateLimitBadge: "10–30 req/min & 20M Free Tokens",
      rateLimitDetail:
        "SiliconFlow gives 20,000,000 free tokens on registration (roughly 15 million words or 40,000 full chat messages). They also host permanent 100% free ($0.00) models like Qwen 2.5 7B and DeepSeek V3/R1 free tier.",
      quotaReset: "Free tokens valid on account; sliding 1-minute rate limits.",
    },
    freeModels: [
      { id: "Qwen/Qwen2.5-7B-Instruct", name: "Qwen 2.5 7B", notes: "Permanent $0.00 free tier" },
      { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3", notes: "Top open weights" },
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", notes: "Reasoning model" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Register Free Account",
        instruction:
          "Sign up at cloud.siliconflow.com. Go to API Keys and copy your API key.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on SiliconFlow card, paste your API key, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'siliconflow/Qwen/Qwen2.5-7B-Instruct' to verify $0.00 free inference.",
      },
    ],
  },

  // ── 14. Hugging Face ───────────────────────────────────────────────────
  huggingface: {
    authTypeBadge: "Free Community Tier (1k req/hr)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • ~1,000 req/hour",
    requirements: {
      loginStatus: "Free Account Required (huggingface.co)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "Read Token (starts with hf_...)",
      connectionType: "API Key / Read Token",
      toolsSupported: "CheapRouter Web Chat, API routes, CLIs",
    },
    limits: {
      rateLimitBadge: "15–30 req/min & ~1,000 req/hour",
      rateLimitDetail:
        "Hugging Face provides free Serverless Inference API for open-weights models. You get approximately 1,000 requests per hour (~15 to 30 requests per minute) with zero credit card or billing setup required.",
      quotaReset: "Sliding hourly rate limit.",
    },
    freeModels: [
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen 2.5 Coder 32B", notes: "High performance coding" },
      { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", notes: "Flagship general intelligence" },
      { id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", name: "DeepSeek R1 32B", notes: "Math & reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create Free Read Token",
        instruction:
          "Sign up at huggingface.co. Go to Settings → Access Tokens → Create 'Read' Token (hf_...).",
      },
      {
        step: 2,
        title: "Paste in CheapRouter",
        instruction:
          "Click 'Add Connection' on Hugging Face card, paste your token, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on any supported model to verify serverless inference.",
      },
    ],
  },

  // ── 15. Cohere ─────────────────────────────────────────────────────────
  cohere: {
    authTypeBadge: "Free Trial Tier (1k calls/mo)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Trial • No credit card required • 1,000 calls/month",
    requirements: {
      loginStatus: "Free Account Required (dashboard.cohere.com)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "Trial API Key",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes",
    },
    limits: {
      rateLimitBadge: "20 req/min & 1,000 calls/month",
      rateLimitDetail:
        "Cohere provides an official free Trial Key with 20 requests per minute and 1,000 complete API calls per month for testing Command R+ and Embed models without adding a credit card.",
      quotaReset: "Monthly quota reset.",
    },
    freeModels: [
      { id: "command-r-plus", name: "Command R+", notes: "State of the art multilingual & tools" },
      { id: "command-r", name: "Command R", notes: "Fast retrieval & chat" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Cohere Trial Key",
        instruction:
          "Sign up at dashboard.cohere.com. Navigate to API Keys and copy your Trial Key.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on Cohere card, paste your Trial Key, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'cohere/command-r-plus' to confirm live output.",
      },
    ],
  },

  // ── 16. Mistral AI ─────────────────────────────────────────────────────
  mistral: {
    authTypeBadge: "Free Tier (60 RPM)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 1 req/sec (60 RPM)",
    requirements: {
      loginStatus: "Free Account Required (console.mistral.ai)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "API Key",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, OpenCode, Cline",
    },
    limits: {
      rateLimitBadge: "1 req/sec (60 RPM) & 500k tok/min",
      rateLimitDetail:
        "Mistral provides a free Experimentation tier with 1 request per second (60 requests per minute) and 500,000 tokens per minute for Mistral Small 3, Codestral, and Mistral NeMo without entering credit card information.",
      quotaReset: "Sliding 1-second and 1-minute windows.",
    },
    freeModels: [
      { id: "mistral-small-latest", name: "Mistral Small 3", notes: "Fast reasoning & general chat" },
      { id: "codestral-latest", name: "Codestral", notes: "Dedicated 80+ language coding model" },
      { id: "open-mistral-nemo", name: "Mistral NeMo 12B", notes: "Compact open-weights" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Generate Mistral API Key",
        instruction:
          "Sign in to console.mistral.ai. Go to API Keys → Create New Key and copy it.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on Mistral card, paste the API key, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'mistral/codestral-latest' to verify coding capabilities.",
      },
    ],
  },

  // ── 17. Gemini Web ─────────────────────────────────────────────────────
  "gemini-web": {
    authTypeBadge: "Browser Session Cookies",
    authTypeColor: "blue",
    isCompletelyFree: true,
    topSummaryText: "Browser Cookies • No credit card required • ~60 req/hour",
    requirements: {
      loginStatus: "Free Google Account (Logged in via Browser)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "Session Cookie (__Secure-1PSID)",
      connectionType: "Browser Session Cookies",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints",
    },
    limits: {
      rateLimitBadge: "~60 requests / hour",
      rateLimitDetail:
        "Standard Google web session allowance for gemini.google.com. No credit card required.",
      quotaReset: "Rolling hourly browser session window.",
    },
    freeModels: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", notes: "High speed multimodal" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", notes: "Deep reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Extract Browser Cookies",
        instruction:
          "Open gemini.google.com in Chrome/Firefox and log in. Press F12 → Application → Cookies → https://gemini.google.com. Copy '__Secure-1PSID'.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On Gemini Web card, click 'Add Connection'. Paste the cookie string into the Cookie input and click Save.",
      },
      {
        step: 3,
        title: "Test Session",
        instruction:
          "Click 'Test' to ensure CheapRouter can communicate with your active web session.",
      },
    ],
  },

  // ── 18. Claude Web ─────────────────────────────────────────────────────
  "claude-web": {
    authTypeBadge: "Browser Session Cookies",
    authTypeColor: "orange",
    isCompletelyFree: false,
    topSummaryText: "Browser Cookies • No credit card required • ~30–45 msgs/5h",
    requirements: {
      loginStatus: "claude.ai Browser Account",
      creditCardStatus: "No Credit Card Required on free tier",
      credentialsNeeded: "sessionKey Cookie (sk-ant-sid01-...)",
      connectionType: "Browser Session Cookies",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints",
    },
    limits: {
      rateLimitBadge: "~30–45 messages / 5 hours",
      rateLimitDetail:
        "Standard claude.ai rolling window. Resets every 5 hours without payment.",
      quotaReset: "Rolling 5-hour window.",
    },
    freeModels: [
      { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", notes: "Hybrid reasoning" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", notes: "Premier coding" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Extract sessionKey Cookie",
        instruction:
          "Log in to claude.ai in your browser. Press F12 → Application → Cookies → https://claude.ai. Copy the value of 'sessionKey' (starts with sk-ant-sid01-...).",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On Claude Web card, click 'Add Connection', paste the sessionKey into the Cookie input, and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on Claude 3.5 Sonnet to confirm web session proxy is working.",
      },
    ],
  },

  // ── 19. ChatGPT Web ────────────────────────────────────────────────────
  "chatgpt-web": {
    authTypeBadge: "Browser Storage State",
    authTypeColor: "emerald",
    isCompletelyFree: false,
    topSummaryText: "Browser Session • No credit card required • ~10 GPT-4o / 3h",
    requirements: {
      loginStatus: "chatgpt.com Browser Login",
      creditCardStatus: "No Credit Card Required on free tier",
      credentialsNeeded: "Playwright storageState JSON",
      connectionType: "Browser Session Cookies / Storage JSON",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints",
    },
    limits: {
      rateLimitBadge: "~10 GPT-4o / 3h (Unlimited Mini)",
      rateLimitDetail:
        "Standard chatgpt.com free allowance: limited GPT-4o requests every 3 hours, then automatically continues on GPT-4o mini.",
      quotaReset: "Rolling 3-hour window.",
    },
    freeModels: [
      { id: "gpt-4o", name: "GPT-4o", notes: "Flagship multimodal" },
      { id: "gpt-4o-mini", name: "GPT-4o mini", notes: "Fast intelligence" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Export Browser Storage State",
        instruction:
          "Log in to chatgpt.com in a dedicated browser profile. Export the storageState JSON object containing session tokens.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on ChatGPT Web, paste the JSON into the storage state box, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' to verify headless browser session connectivity.",
      },
    ],
  },

  // ── 20. Grok Web ───────────────────────────────────────────────────────
  "grok-web": {
    authTypeBadge: "Browser Session Cookies",
    authTypeColor: "blue",
    isCompletelyFree: false,
    topSummaryText: "Browser Cookies • No credit card required • ~20–50 msgs/2h",
    requirements: {
      loginStatus: "grok.com Web Account",
      creditCardStatus: "No Credit Card Required on free tier",
      credentialsNeeded: "sso & sso-rw Cookies + Matched User-Agent",
      connectionType: "Browser Session Cookies",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints",
    },
    limits: {
      rateLimitBadge: "~20–50 messages / 2 hours",
      rateLimitDetail:
        "Standard grok.com web tier allowance. Make sure to paste your browser's exact User-Agent in Advanced Settings to avoid Cloudflare challenge blocks.",
      quotaReset: "Rolling 2-hour window.",
    },
    freeModels: [
      { id: "grok-3", name: "Grok 3", notes: "xAI powerhouse" },
      { id: "grok-3-mini", name: "Grok 3 Mini", notes: "Fast reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Extract sso & sso-rw Cookies",
        instruction:
          "Log in to grok.com. Press F12 → Application → Cookies. Copy 'sso' and 'sso-rw'. Also copy your browser's User-Agent string from the Console ('navigator.userAgent').",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On Grok Web card, click 'Add Connection'. Paste 'sso=...; sso-rw=...' into Cookies, and paste your User-Agent into Advanced Settings.",
      },
      {
        step: 3,
        title: "Save & Test",
        instruction:
          "Click Save, then click 'Test' on Grok 3 to verify session validation.",
      },
    ],
  },

  // ── 21. DeepSeek Web ───────────────────────────────────────────────────
  "deepseek-web": {
    authTypeBadge: "Browser LocalStorage Token",
    authTypeColor: "blue",
    isCompletelyFree: true,
    topSummaryText: "Browser Token • No credit card required • ~50 requests/day",
    requirements: {
      loginStatus: "chat.deepseek.com Account",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "userToken from LocalStorage",
      connectionType: "Browser Session Cookies / Token",
      toolsSupported: "CheapRouter Web Chat, /v1 endpoints",
    },
    limits: {
      rateLimitBadge: "~50 requests / day (Web Tier)",
      rateLimitDetail:
        "DeepSeek Web chat session daily usage allowance. Free access to DeepSeek V3 and DeepSeek R1 reasoning without billing.",
      quotaReset: "Resets daily.",
    },
    freeModels: [
      { id: "deepseek-chat", name: "DeepSeek V3", notes: "General chat & coding" },
      { id: "deepseek-reasoner", name: "DeepSeek R1", notes: "Chain of thought reasoning" },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Copy userToken from DevTools",
        instruction:
          "Log in to chat.deepseek.com. Press F12 → Application → Local Storage → https://chat.deepseek.com. Copy the value of 'userToken'.",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "Click 'Add Connection' on DeepSeek Web, paste the userToken value, and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on DeepSeek V3 to verify response.",
      },
    ],
  },
};

/**
 * Universal Fallback Resolver:
 * Produces accurate Requirements, Human-Readable Limits, and Step 1/2/3 How to Connect
 * for ANY of the 370 providers in CheapRouter that does not have an explicit manual override.
 */
export function resolveProviderGuide(
  providerId: string,
  providerName: string,
  providerData?: any
): ProviderGuideData {
  if (PROVIDER_GUIDES[providerId]) {
    return PROVIDER_GUIDES[providerId];
  }

  // Look up catalog metadata
  const catalogEntry =
    providerData ||
    (AI_PROVIDERS as Record<string, any>)[providerId] ||
    (NOAUTH_PROVIDERS as Record<string, any>)[providerId] ||
    (WEB_COOKIE_PROVIDERS as Record<string, any>)[providerId] ||
    (OAUTH_PROVIDERS as Record<string, any>)[providerId] ||
    (LOCAL_PROVIDERS as Record<string, any>)[providerId] ||
    (APIKEY_PROVIDERS as Record<string, any>)[providerId] ||
    {};

  const isNoAuth =
    catalogEntry.authType === "no-auth" ||
    catalogEntry.authType === "free" ||
    Boolean((NOAUTH_PROVIDERS as Record<string, any>)[providerId]);
  const isWebCookie =
    catalogEntry.authType === "web-cookie" ||
    Boolean((WEB_COOKIE_PROVIDERS as Record<string, any>)[providerId]);
  const isOAuth =
    catalogEntry.authType === "oauth" ||
    Boolean((OAUTH_PROVIDERS as Record<string, any>)[providerId]);
  const isLocal =
    catalogEntry.authType === "local" ||
    Boolean((LOCAL_PROVIDERS as Record<string, any>)[providerId]);
  const hasFree = catalogEntry.hasFree === true || isNoAuth;
  const apiKeyUrl = catalogEntry.apiKeyUrl || catalogEntry.website || "";

  if (isNoAuth) {
    return {
      authTypeBadge: "100% Free • No Auth",
      authTypeColor: "emerald",
      isCompletelyFree: true,
      topSummaryText: "Free without credit card • Anonymous & Keyless",
      requirements: {
        loginStatus: "Without Login (Zero Signup / No Account)",
        creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
        credentialsNeeded: "None (Built-in & Auto-connected)",
        connectionType: "Built-in Anonymous Connector",
        toolsSupported: "CheapRouter Web Chat, /v1 API routes, OpenCode CLI, Kilo",
      },
      limits: {
        rateLimitBadge: "Dynamic Free Tier (~20–30 req/min)",
        rateLimitDetail:
          "Keyless anonymous tier. Throughput is governed by dynamic community rate limits (typically 20 to 30 requests per minute with automatic sliding resets). No token deductions or billing counters.",
        quotaReset: "Sliding dynamic window.",
      },
      freeModels: [
        { id: `${providerId}/default`, name: `${providerName} Model`, notes: "Default open endpoint" },
      ],
      connectSteps: [
        {
          step: 1,
          title: "Pre-Configured & Enabled",
          instruction: `${providerName} is keyless and already enabled by default in CheapRouter. Zero registration or setup is needed.`,
        },
        {
          step: 2,
          title: "Select in Chat or CLI",
          instruction: `Select this provider in CheapRouter Web Chat or call it through the /v1/chat/completions endpoint with model '${providerId}/...'.`,
        },
        {
          step: 3,
          title: "Test Connection",
          instruction: `Click the 'Test' button on this card or on any model in the provider detail page to confirm active status.`,
        },
      ],
    };
  }

  if (isWebCookie) {
    return {
      authTypeBadge: "Browser Session Cookies",
      authTypeColor: "blue",
      isCompletelyFree: hasFree,
      topSummaryText: "Browser Cookies • No credit card required on free tier",
      requirements: {
        loginStatus: "Browser Login Required on Official Website",
        creditCardStatus: hasFree
          ? "No Credit Card Required (Free Web Tier)"
          : "Depends on user's subscription tier",
        credentialsNeeded: "Browser Session Cookie (F12 DevTools)",
        connectionType: "Browser Session Cookies",
        toolsSupported: "CheapRouter Web Chat, /v1 API routes",
      },
      limits: {
        rateLimitBadge: "Web Session Tier Allowance",
        rateLimitDetail:
          "Governed by your web session allowance on the provider's official chat interface. No API token billing.",
        quotaReset: "Rolling browser session reset window.",
      },
      freeModels: [],
      connectSteps: [
        {
          step: 1,
          title: "Log In via Web Browser",
          instruction: `Open ${providerName}'s official web chat in Chrome or Firefox and log in to your account.`,
        },
        {
          step: 2,
          title: "Copy Session Cookie (F12)",
          instruction:
            "Press F12 → Application → Cookies. Copy the session authentication cookie required for this provider.",
        },
        {
          step: 3,
          title: "Add Connection in CheapRouter",
          instruction:
            "On this provider card, click 'Add Connection', paste the cookie string into the Cookie input, and click Save.",
        },
      ],
    };
  }

  if (isOAuth) {
    return {
      authTypeBadge: "OAuth 2.0 Auth",
      authTypeColor: "purple",
      isCompletelyFree: hasFree,
      topSummaryText: hasFree
        ? "Free OAuth Tier • Sign in with account"
        : "OAuth 2.0 • Sign in with provider account",
      requirements: {
        loginStatus: "OAuth Account Login Required",
        creditCardStatus: hasFree
          ? "No Credit Card Required for Free Tier"
          : "Card required for paid account tier",
        credentialsNeeded: "OAuth Access & Refresh Tokens (Handled via login flow)",
        connectionType: "OAuth 2.0",
        toolsSupported: "CheapRouter Web Chat, API routes, IDE extensions",
      },
      limits: {
        rateLimitBadge: hasFree ? "Free Account Quota" : "Subscription Account Quota",
        rateLimitDetail:
          catalogEntry.freeNote ||
          "Rate limits and token quotas as governed by your OAuth account tier.",
        quotaReset: "Governed by upstream provider policy.",
      },
      freeModels: [],
      connectSteps: [
        {
          step: 1,
          title: "Initiate OAuth Connection",
          instruction:
            "Click 'Connect with OAuth' / 'Add Connection' on this provider card in CheapRouter.",
        },
        {
          step: 2,
          title: "Authenticate in Popup",
          instruction: `Sign in to ${providerName} in the authorization window and grant the requested permissions.`,
        },
        {
          step: 3,
          title: "Automatic Token Storage",
          instruction:
            "CheapRouter automatically captures and refreshes your tokens. Click 'Test' to verify connectivity.",
        },
      ],
    };
  }

  if (isLocal) {
    return {
      authTypeBadge: "Local P2P Service",
      authTypeColor: "purple",
      isCompletelyFree: true,
      topSummaryText: "Local Daemon • Port Service • Zero network cost",
      requirements: {
        loginStatus: "No Internet Account (Local Machine / VPS Daemon)",
        creditCardStatus: "No Credit Card Required (100% Free)",
        credentialsNeeded: "Local Host / Port (No external API key)",
        connectionType: "Local P2P Service",
        toolsSupported: "CheapRouter Web Chat, /v1 endpoints, local CLIs",
      },
      limits: {
        rateLimitBadge: "Unlimited Local Speed",
        rateLimitDetail:
          "Runs directly on your machine or VPS. Zero network cost, no rate limit, no token charges.",
        quotaReset: "Unlimited local speed.",
      },
      freeModels: [],
      connectSteps: [
        {
          step: 1,
          title: "Ensure Local Server is Running",
          instruction: `Verify that the ${providerName} local service or CLI daemon is running on your machine or VPS port.`,
        },
        {
          step: 2,
          title: "Automatic Local Routing",
          instruction:
            "CheapRouter connects directly to the local daemon loopback address without requiring remote credentials.",
        },
        {
          step: 3,
          title: "Test Local Speed",
          instruction:
            "Click 'Test' on this provider card to measure instantaneous local latency.",
        },
      ],
    };
  }

  // Standard API Key Provider Fallback
  return {
    authTypeBadge: hasFree ? "Free / Trial Tier" : "API Key Authentication",
    authTypeColor: hasFree ? "emerald" : "blue",
    isCompletelyFree: hasFree,
    topSummaryText: hasFree
      ? "Free Tier Available • No credit card required for starter quota"
      : "API Key Required • Standard provider rates",
    requirements: {
      loginStatus: "Account Required at Provider Developer Console",
      creditCardStatus: hasFree
        ? "No Credit Card Required for Free Tier"
        : "Credit Card Required for Paid / Pay-as-you-go Usage",
      credentialsNeeded: "API Key",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, /v1 API routes, OpenCode CLI, Kilo, Cline",
    },
    limits: {
      rateLimitBadge: hasFree ? "Free Tier Quotas" : "Standard Tier Rate Limits",
      rateLimitDetail:
        catalogEntry.freeNote ||
        "Limits typically scale from 15 to 60 requests per minute depending on provider account tier. 1,000,000 tokens ≈ roughly 750,000 words or 2,000 chat messages.",
      quotaReset: "Resets dynamically or daily according to upstream dashboard.",
    },
    freeModels: [],
    connectSteps: [
      {
        step: 1,
        title: "Get Your API Key",
        instruction: apiKeyUrl
          ? `Visit the developer dashboard at ${apiKeyUrl} and create an API Key.`
          : `Sign in to ${providerName}'s official developer console and copy your API Key.`,
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On this provider card, click 'Add Connection' / 'Connect'. Paste your API Key and click Save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click the 'Test' button to verify CheapRouter can reach the provider. Once green, the provider is ready for chat and combo routing.",
      },
    ],
  };
}

interface CupertinoProviderGuideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  providerName: string;
  provider?: any;
  authType?: string;
}

export function CupertinoProviderGuideSheet({
  isOpen,
  onClose,
  providerId,
  providerName,
  provider,
}: CupertinoProviderGuideSheetProps) {
  const { copied, copy } = useCopyToClipboard();
  // EXACTLY 3 Tabs as requested:
  // 1: requirements ("Requirements")
  // 2: limits ("Free / Limits")
  // 3: connect ("How to Connect")
  const [activeTab, setActiveTab] = useState<"requirements" | "limits" | "connect">("requirements");

  if (!isOpen) return null;

  const guide = resolveProviderGuide(providerId, providerName, provider);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Frosted Glass Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-Over Sheet (Clean Inset Style, Minimal Gaps) */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#141416]/95 text-white shadow-2xl backdrop-blur-2xl sm:max-w-md md:max-w-lg animate-in slide-in-from-right duration-250 ease-out">
        {/* Top Drag Pill Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-[#141416]/80 sticky top-0 z-20">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold tracking-tight text-white truncate">
                {providerName}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase border ${
                  guide.authTypeColor === "emerald"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : guide.authTypeColor === "orange"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : guide.authTypeColor === "purple"
                    ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                    : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                }`}
              >
                {guide.authTypeBadge}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center size-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all shrink-0"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>

        {/* Compact Single-Line Top Highlight Banner */}
        <div className="px-4 py-1.5 bg-white/[0.03] border-b border-white/5 flex items-center gap-1.5 text-[11px] text-white/80">
          <span className="material-symbols-outlined text-[14px] text-emerald-400 shrink-0">
            check_circle
          </span>
          <span className="truncate">{guide.topSummaryText}</span>
        </div>

        {/* Segmented Control (EXACTLY 3 Tabs, Compact, Minimal Gaps) */}
        <div className="px-4 pt-2.5 pb-1.5 bg-[#141416]">
          <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("requirements")}
              className={`flex-1 py-1 px-2 rounded-md font-medium text-[11px] sm:text-xs transition-all ${
                activeTab === "requirements"
                  ? "bg-white/15 text-white shadow-xs"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Requirements
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("limits")}
              className={`flex-1 py-1 px-2 rounded-md font-medium text-[11px] sm:text-xs transition-all ${
                activeTab === "limits"
                  ? "bg-white/15 text-white shadow-xs"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Free / Limits {guide.freeModels?.length > 0 && `(${guide.freeModels.length})`}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("connect")}
              className={`flex-1 py-1 px-2 rounded-md font-medium text-[11px] sm:text-xs transition-all ${
                activeTab === "connect"
                  ? "bg-white/15 text-white shadow-xs"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              How to Connect
            </button>
          </div>
        </div>

        {/* Sheet Content Area (Tight Padding, Minimal Gaps) */}
        <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2">
          {/* ═══════════ TAB 1: REQUIREMENTS ═══════════ */}
          {activeTab === "requirements" && (
            <div className="space-y-2 animate-in fade-in duration-150">
              {/* Row 1: Login Status */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  <span className="material-symbols-outlined text-[13px] text-sky-400">
                    lock_open
                  </span>
                  Login & Account Status
                </div>
                <p className="text-xs font-medium text-white/95">
                  {guide.requirements.loginStatus}
                </p>
              </div>

              {/* Row 2: Credit Card Requirement */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">
                    credit_card_off
                  </span>
                  Credit Card Status
                </div>
                <p className="text-xs font-medium text-white/95">
                  {guide.requirements.creditCardStatus}
                </p>
              </div>

              {/* Row 3: Credentials Needed */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  <span className="material-symbols-outlined text-[13px] text-amber-400">key</span>
                  Credentials Needed
                </div>
                <p className="text-xs font-medium text-white/95">
                  {guide.requirements.credentialsNeeded}
                </p>
                <div className="inline-block mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/70 font-mono">
                    Type: {guide.requirements.connectionType}
                  </span>
                </div>
              </div>

              {/* Row 4: CLI & Environment Support */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  <span className="material-symbols-outlined text-[13px] text-purple-400">
                    terminal
                  </span>
                  Supported Tools & Environments
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {guide.requirements.toolsSupported}
                </p>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 2: FREE / LIMITS ═══════════ */}
          {activeTab === "limits" && (
            <div className="space-y-2 animate-in fade-in duration-150">
              {/* Exact Limits Card */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    <span className="material-symbols-outlined text-[13px] text-amber-400">
                      speed
                    </span>
                    Exact Limits (Human-Readable)
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    {guide.limits.rateLimitBadge}
                  </span>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">
                  {guide.limits.rateLimitDetail}
                </p>
                {guide.limits.quotaReset && (
                  <p className="text-[10px] text-amber-300/80 pt-0.5">
                    ⏱ {guide.limits.quotaReset}
                  </p>
                )}
              </div>

              {/* Free Models List */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-sky-400">
                      smart_toy
                    </span>
                    Available Free / Trial Models
                  </div>
                  <span className="text-[10px] text-white/40">
                    {guide.freeModels?.length || 0} models
                  </span>
                </div>

                {guide.freeModels && guide.freeModels.length > 0 ? (
                  <div className="space-y-1.5">
                    {guide.freeModels.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-black/30 border border-white/5 hover:border-white/15 transition-all text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white truncate text-xs">{m.name}</div>
                          <div className="font-mono text-[10px] text-white/50 truncate flex items-center gap-1">
                            <span>{m.id}</span>
                            {m.notes && <span className="text-white/30">• {m.notes}</span>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => copy(m.id)}
                          className="size-6 shrink-0 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                          title="Copy model ID"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {copied ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/60 py-2">
                    Models for this provider are synced dynamically once connected. Click 'Test' on
                    any model to verify.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: HOW TO CONNECT (NOT "How to Use"!) ═══════════ */}
          {activeTab === "connect" && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">
                    checklist
                  </span>
                  How to Connect in CheapRouter (Step-by-Step)
                </div>

                <div className="space-y-2">
                  {guide.connectSteps.map((step) => (
                    <div key={step.step} className="flex items-start gap-2.5 text-xs">
                      <span className="size-4 shrink-0 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center justify-center mt-0.5 border border-emerald-500/30">
                        {step.step}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-xs">{step.title}</div>
                        <p className="text-[11px] text-white/75 leading-relaxed mt-0.5">
                          {step.instruction}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Admin Tip Card */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] text-white/70 space-y-1">
                <div className="font-semibold text-white/90 text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-sky-400">tips_and_updates</span>
                  Admin Verification Tip
                </div>
                <p className="leading-relaxed">
                  After saving credentials, always click the <strong className="text-white">Test</strong> button on the provider card. A green latency response confirms the provider is ready for automated fallback and combo routing.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
