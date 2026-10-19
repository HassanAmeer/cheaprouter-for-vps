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
  apiKeyUrl?: string;

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
    rpm?: string;
    rpd?: string;
    tpm?: string;
    dailyLimit?: string;
  };

  freeModels: Array<{
    id: string;
    name: string;
    notes?: string;
    rpm?: string;
    dailyQuota?: string;
    contextWindow?: string;
    pricing?: string;
  }>;

  connectSteps: Array<{
    step: number;
    title: string;
    instruction: string;
    linkUrl?: string;
    linkLabel?: string;
  }>;
}

export const PROVIDER_GUIDES: Record<string, ProviderGuideData> = {
  // ── UncloseAI (Free LLM & Free TTS) ──────────────────────────────────
  uncloseai: {
    authTypeBadge: "100% Free • Keyless",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free public domain AI • Chat (RTX 4090) & TTS Voice Cloning • Zero API keys",
    requirements: {
      loginStatus: "Without Login (Zero Signup / No Account)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "None (Accepts any string or blank for identification)",
      connectionType: "Direct OpenAI-compatible HTTP facade",
      toolsSupported: "CheapRouter Web Chat, /v1/chat/completions, /v1/audio/speech, CLI tools",
    },
    limits: {
      rateLimitBadge: "Unlimited / Community GPU Queue",
      rateLimitDetail:
        "Public domain community GPUs (RTX 4090 for Hermes & RTX 3090 for Qwen, plus TTS cluster). Unlimited requests with zero billing. If a model returns 404, upstream has rotated the model ID — auto-discovery syncs the live model automatically.",
      quotaReset: "Immediate / Continuous streaming without daily caps.",
      rpm: "30–60 req/min",
      rpd: "Unlimited",
      dailyLimit: "Unlimited ($0.00 Cost)",
    },
    freeModels: [
      {
        id: "turboderp/Qwen3.8-27B-exl3",
        name: "Qwen3.8 27B exl3 (Live Chat)",
        pricing: "100% Free",
        contextWindow: "65,536",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "65,536 context length on RTX 4090",
      },
      {
        id: "tts-1-f5",
        name: "F5-TTS Voice Cloning (Audio)",
        pricing: "100% Free",
        contextWindow: "Audio / TTS",
        rpm: "30 RPM",
        dailyQuota: "Unlimited",
        notes: "42 human cloned voices, 10 languages",
      },
      {
        id: "tts-1-qwen",
        name: "Qwen3-TTS (Audio)",
        pricing: "100% Free",
        contextWindow: "Audio / TTS",
        rpm: "30 RPM",
        dailyQuota: "Unlimited",
        notes: "1.7B parameter voice cloning",
      },
      {
        id: "tts-1",
        name: "UncloseAI Default TTS",
        pricing: "100% Free",
        contextWindow: "Audio / TTS",
        rpm: "30 RPM",
        dailyQuota: "Unlimited",
        notes: "OpenAI-compatible speech endpoint",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "No Credentials or Signup Required",
        instruction:
          "UncloseAI is completely public domain (free as in beer & free as in freedom). No registration, email, or API key is required.",
      },
      {
        step: 2,
        title: "Fetch Live Models",
        instruction:
          "Click 'Fetch All Models' on the provider card or detail page to dynamically load the current live model (turboderp/Qwen3.8-27B-exl3) straight from hermes.ai.unturf.com.",
      },
      {
        step: 3,
        title: "Chat & Speech Endpoints",
        instruction:
          "CheapRouter routes chat completions to https://hermes.ai.unturf.com/v1 and text-to-speech to https://speech.ai.unturf.com/v1 automatically.",
      },
      {
        step: 4,
        title: "Route in Chat, CLI, or TTS",
        instruction:
          "Use 'uncloseai/turboderp/Qwen3.8-27B-exl3' for chat completions or send TTS requests to /v1/audio/speech with model 'uncloseai/tts-1-f5' and voice 'aria', 'atlas', or 'foxhop'.",
      },
    ],
  },

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
      rpm: "30–60 req/min",
      rpd: "Unlimited",
      dailyLimit: "Unlimited ($0.00 Free)",
    },
    freeModels: [
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        pricing: "100% Free",
        contextWindow: "200k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "Anthropic fast reasoning",
      },
      {
        id: "gpt-5.4-mini",
        name: "GPT-5.4 mini",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "OpenAI fast intelligence",
      },
      {
        id: "gpt-6-luna",
        name: "GPT-6 Luna",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "OpenAI latest free tier",
      },
      {
        id: "mistral-small-2603",
        name: "Mistral Small 4",
        pricing: "100% Free",
        contextWindow: "32k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "Mistral AI reasoning",
      },
      {
        id: "tinfoil/gpt-oss-120b",
        name: "GPT OSS 120B",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "Massive open weights",
      },
      {
        id: "tinfoil/gemma4-31b",
        name: "Gemma 4 31B",
        pricing: "100% Free",
        contextWindow: "32k",
        rpm: "30–60 RPM",
        dailyQuota: "Unlimited",
        notes: "Google open model",
      },
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
        title: "Fetch All Models Live",
        instruction:
          "Click 'Fetch All Models' on the DuckDuckGo provider card to query duck.ai/duckchat/v1/models and sync all 10 live models (including GPT-6 Luna, Claude Haiku 4.5, and Mistral Small).",
      },
      {
        step: 3,
        title: "Verify & Test Connection",
        instruction:
          "Go to the Available Models list below or Web Chat, and click 'Test' on Claude Haiku 4.5 or GPT-6 Luna to confirm live responses.",
      },
      {
        step: 4,
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
      {
        id: "glm-5-2",
        name: "GLM 5.2",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited",
        notes: "Zhipu AI high performance",
      },
      {
        id: "kimi-k2-7-code",
        name: "Kimi K2.7 Code",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited",
        notes: "Moonshot coding model",
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited",
        notes: "DeepSeek high intelligence",
      },
      {
        id: "gpt-oss-120b",
        name: "GPT-OSS 120B",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited",
        notes: "Massive open model",
      },
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
    apiKeyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    requirements: {
      loginStatus: "Free Cloudflare Account (dash.cloudflare.com)",
      creditCardStatus: "No Credit Card Required (0% Cost on free tier)",
      credentialsNeeded:
        "API Token (Workers AI Read) + Account ID OR Global API Key (cfk_...) with Email",
      connectionType: "Account ID + Bearer Token OR Global API Key",
      toolsSupported: "CheapRouter Web Chat, API routes, OpenCode CLI, Kilo",
    },
    limits: {
      rateLimitBadge: "10,000 Neurons / Day ($0.00)",
      rateLimitDetail:
        "Cloudflare grants 10,000 free Neurons every 24 hours ($0.00 billable cost). In real usage, 10,000 neurons equals roughly 100,000–150,000 LLM output tokens or ~200 full chat requests on models like Llama 3.3 70B and DeepSeek R1 Distill 32B. Per-minute limit: 300 requests/minute per account.",
      quotaReset: "Resets every day at 00:00 UTC (hard reset, no rollover).",
      rpm: "300 req/min",
      rpd: "~200 full chats/day",
      dailyLimit: "10,000 Neurons/day ($0.00)",
    },
    freeModels: [
      {
        id: "@cf/meta/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "300 RPM",
        dailyQuota: "10k Neurons/day (~200 chats)",
        notes: "Flagship open weights model",
      },
      {
        id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        name: "DeepSeek R1 Distill 32B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "64k",
        rpm: "300 RPM",
        dailyQuota: "10k Neurons/day (~200 chats)",
        notes: "High reasoning & coding",
      },
      {
        id: "@cf/qwen/qwen2.5-72b-instruct",
        name: "Qwen 2.5 72B Instruct",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "300 RPM",
        dailyQuota: "10k Neurons/day (~200 chats)",
        notes: "Specialized for programming",
      },
      {
        id: "@cf/meta/llama-3.2-3b-instruct",
        name: "Llama 3.2 3B Instruct",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "300 RPM",
        dailyQuota: "10k Neurons/day (~400 chats)",
        notes: "Ultra fast low-neuron inference",
      },
      {
        id: "@cf/meta/llama-3.1-8b-instruct",
        name: "Llama 3.1 8B Instruct",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "300 RPM",
        dailyQuota: "10k Neurons/day (~350 chats)",
        notes: "Fast 8B reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Find Your Account ID or Use Global API Key",
        instruction:
          "Sign in to dash.cloudflare.com. You can either copy your 32-character Account ID from the dashboard URL, or use your Global API Key (cfk_...) with your login email — CheapRouter auto-discovers your Account ID automatically.",
        linkUrl: "https://dash.cloudflare.com",
        linkLabel: "Open Cloudflare Dashboard",
      },
      {
        step: 2,
        title: "Generate API Token with Workers AI Permission",
        instruction:
          "Go to My Profile → API Tokens. Click 'Create Token' → use the 'Workers AI' template (Account → Workers AI → Read). Copy your token immediately.",
        linkUrl: "https://dash.cloudflare.com/profile/api-tokens",
        linkLabel: "Generate API Token (Direct Link)",
      },
      {
        step: 3,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Cloudflare Workers AI card, click 'Add Connection'. Paste your API Token (or Global API Key) and Account ID (if using token). Click Save.",
      },
      {
        step: 4,
        title: "Fetch All Models Live",
        instruction:
          "Click 'Fetch All Models' on the provider card. CheapRouter queries Cloudflare's catalog endpoint and syncs all 71+ active models directly to your dashboard.",
      },
      {
        step: 5,
        title: "Test Connection",
        instruction:
          "Click the green 'Test' button on '@cf/meta/llama-3.3-70b-instruct' or '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b' to verify live latency.",
      },
    ],
  },

  // ── 4. Groq Cloud ──────────────────────────────────────────────────────
  groq: {
    authTypeBadge: "Free API Tier (14.4k RPD)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free API Tier • No credit card required • 14,400 chats/day",
    apiKeyUrl: "https://console.groq.com/keys",
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
        "Official generous free tier with zero card required. You get 30 requests every minute and up to 14,400 chats per day at ultra-fast 300+ tokens/second for Llama 3.3 70B (6,000 tokens/minute on 70B; 20,000 TPM on 8B).",
      quotaReset: "Sliding 1-minute window for RPM; daily requests reset at 00:00 UTC.",
      rpm: "30 req/min",
      rpd: "14,400 req/day",
      tpm: "6,000 (70B) / 20k (8B)",
      dailyLimit: "14,400 requests/day",
    },
    freeModels: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "30 RPM",
        dailyQuota: "14,400 RPD",
        notes: "Fastest 70B reasoning (300+ tok/s)",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "30 RPM",
        dailyQuota: "14,400 RPD",
        notes: "Ultra low latency (500 tok/s)",
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "32k",
        rpm: "30 RPM",
        dailyQuota: "14,400 RPD",
        notes: "Long context window",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Generate Groq API Key",
        instruction:
          "Sign in to console.groq.com with email or GitHub. Go to 'API Keys' and click 'Create API Key'. Copy your key (gsk_...).",
        linkUrl: "https://console.groq.com/keys",
        linkLabel: "Generate Groq API Key",
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
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
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
      rpm: "15 req/min",
      rpd: "1,500 req/day",
      tpm: "1,000,000 TPM",
      dailyLimit: "1,500 requests/day",
    },
    freeModels: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        pricing: "Free Tier ($0.00)",
        contextWindow: "1M tokens",
        rpm: "15 RPM",
        dailyQuota: "1,500 RPD",
        notes: "Ultra fast multimodal (1M context)",
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        pricing: "Free Tier ($0.00)",
        contextWindow: "1M tokens",
        rpm: "2 RPM",
        dailyQuota: "50 RPD",
        notes: "State of the art reasoning",
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        pricing: "Free Tier ($0.00)",
        contextWindow: "1M tokens",
        rpm: "15 RPM",
        dailyQuota: "1,500 RPD",
        notes: "High speed multimodal free tier",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Free Google API Key",
        instruction:
          "Visit aistudio.google.com with any standard Google account. Click 'Get API key' → 'Create API key'.",
        linkUrl: "https://aistudio.google.com/app/apikey",
        linkLabel: "Get Google AI Studio Key",
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
    apiKeyUrl: "https://cloud.cerebras.ai/platform",
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
      rpm: "30 req/min",
      tpm: "60,000 TPM",
      dailyLimit: "1,000,000 tokens/day",
    },
    freeModels: [
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "8k",
        rpm: "30 RPM",
        dailyQuota: "1,000,000 Tokens/day",
        notes: "1,000+ tokens/sec Wafer-Scale chip",
      },
      {
        id: "llama-3.1-8b",
        name: "Llama 3.1 8B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "8k",
        rpm: "30 RPM",
        dailyQuota: "1,000,000 Tokens/day",
        notes: "Instantaneous responses",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Sign Up at Cerebras",
        instruction:
          "Sign up at cloud.cerebras.ai (no credit card needed). Go to 'API Keys' and generate a key.",
        linkUrl: "https://cloud.cerebras.ai/platform",
        linkLabel: "Open Cerebras Platform",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction: "On the Cerebras card, click 'Add Connection'. Paste your key and click Save.",
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
    apiKeyUrl: "https://cloud.sambanova.ai/apis",
    requirements: {
      loginStatus: "Free Account Required (cloud.sambanova.ai)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "API Key",
      connectionType: "API Key Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, coding CLIs",
    },
    limits: {
      rateLimitBadge: "10–40 req/min & 200k tok/min",
      rateLimitDetail:
        "SambaNova provides 10 requests per minute and 200,000 tokens per minute for Llama 3.3 70B, Qwen 2.5 72B, and DeepSeek R1 with zero card required.",
      quotaReset: "Sliding 1-minute window.",
      rpm: "10–40 req/min",
      tpm: "200,000 TPM",
      dailyLimit: "Unlimited (within RPM/TPM bounds)",
    },
    freeModels: [
      {
        id: "Meta-Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "10–40 RPM",
        dailyQuota: "Unlimited (200k TPM)",
        notes: "Full capability 70B",
      },
      {
        id: "Qwen2.5-72B-Instruct",
        name: "Qwen 2.5 72B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "10–40 RPM",
        dailyQuota: "Unlimited (200k TPM)",
        notes: "Flagship open coding model",
      },
      {
        id: "DeepSeek-R1",
        name: "DeepSeek R1",
        pricing: "Free Tier ($0.00)",
        contextWindow: "64k",
        rpm: "10–20 RPM",
        dailyQuota: "Unlimited (200k TPM)",
        notes: "Chain of thought reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get SambaNova API Key",
        instruction:
          "Create a free account at cloud.sambanova.ai. Navigate to API Keys and copy your key.",
        linkUrl: "https://cloud.sambanova.ai/apis",
        linkLabel: "Get SambaNova API Key",
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
    apiKeyUrl: "https://github.com/settings/tokens",
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
      rpm: "15 req/min",
      rpd: "150 req/day (50 for 70B)",
      dailyLimit: "150 requests/day",
    },
    freeModels: [
      {
        id: "gpt-4o",
        name: "OpenAI GPT-4o",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "15 RPM",
        dailyQuota: "150 RPD",
        notes: "Frontier multimodal on Azure AI",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "15 RPM",
        dailyQuota: "50 RPD",
        notes: "Anthropic premier coding",
      },
      {
        id: "meta-llama-3.3-70b-instruct",
        name: "Llama 3.3 70B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "15 RPM",
        dailyQuota: "50 RPD",
        notes: "Meta open weights",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create GitHub PAT",
        instruction:
          "Visit github.com/settings/tokens. Create a Personal Access Token with model permissions.",
        linkUrl: "https://github.com/settings/tokens",
        linkLabel: "Generate GitHub PAT Token",
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
        instruction: "Click 'Test' on 'github/gpt-4o' to verify Azure AI inference.",
      },
    ],
  },

  // ── 9. OpenRouter (:free models) ───────────────────────────────────────
  openrouter: {
    authTypeBadge: "Free Models Tier ($0.00)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Models • $0.00 Cost on 20+ ':free' models",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
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
      rpm: "20 req/min",
      rpd: "200 req/day",
      dailyLimit: "200 free chats/day",
    },
    freeModels: [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B Free",
        pricing: "100% Free ($0.00)",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "200 RPD",
        notes: "Free tier",
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash Free",
        pricing: "100% Free ($0.00)",
        contextWindow: "1M tokens",
        rpm: "20 RPM",
        dailyQuota: "200 RPD",
        notes: "Free tier",
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 Free",
        pricing: "100% Free ($0.00)",
        contextWindow: "64k",
        rpm: "20 RPM",
        dailyQuota: "200 RPD",
        notes: "Free reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create OpenRouter Key",
        instruction: "Sign up at openrouter.ai and generate a key under 'Keys' (sk-or-...).",
        linkUrl: "https://openrouter.ai/settings/keys",
        linkLabel: "Generate OpenRouter Key",
      },
      {
        step: 2,
        title: "Connect in CheapRouter",
        instruction: "On the OpenRouter card, click 'Add Connection', paste your key, and save.",
      },
      {
        step: 3,
        title: "Test Free Model",
        instruction:
          "Test with any model ending in ':free' (e.g. meta-llama/llama-3.3-70b-instruct:free).",
      },
    ],
  },

  // ── 10. Antseed CLI (Local) ──────────────────────────────────────────
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
      toolsSupported: "Antseed CLI, CheapRouter Web Chat, /v1 endpoints, local commands",
    },
    limits: {
      rateLimitBadge: "Unlimited Local Speed",
      rateLimitDetail:
        "Runs directly on your machine or VPS port 8377 as an ultra-fast local daemon. Zero network latency, no rate limit, no token charges.",
      quotaReset: "Unlimited continuous local speed.",
    },
    freeModels: [
      {
        id: "glm-5.1",
        name: "GLM 5.1",
        pricing: "Local ($0.00)",
        contextWindow: "128k",
        rpm: "Unlimited",
        dailyQuota: "Unlimited",
        notes: "Decentralized reasoning and coding model",
      },
      {
        id: "glm-5.3-flash",
        name: "GLM 5.3 Flash",
        pricing: "Local ($0.00)",
        contextWindow: "128k",
        rpm: "Unlimited",
        dailyQuota: "Unlimited",
        notes: "Ultra fast local coding assistant",
      },
      {
        id: "abliterated-large-v2",
        name: "Abliterated Large V2",
        pricing: "Local ($0.00)",
        contextWindow: "128k",
        rpm: "Unlimited",
        dailyQuota: "Unlimited",
        notes: "Uncensored assistant",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Verify Local Daemon Status",
        instruction:
          "In your terminal, run 'antseed buyer status' or verify that port 8377 is active.",
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
        instruction: "Click 'Test' on 'antseed/glm-5.3-flash' to verify instant local execution.",
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
      rpm: "20 req/min",
      rpd: "100–300 req/day",
      dailyLimit: "OpenCode Free Client Allowance",
    },
    freeModels: [
      {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "100–300 RPD",
        notes: "Free coding & reasoning",
      },
      {
        id: "qwen-2.5-coder",
        name: "Qwen 2.5 Coder",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "100–300 RPD",
        notes: "Specialized for programming",
      },
      {
        id: "big-pickle",
        name: "Big Pickle",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "100–300 RPD",
        notes: "DeepSeek thinking mode",
      },
      {
        id: "glm-5.3-flash-free",
        name: "GLM 5.3 Flash Free",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "100–300 RPD",
        notes: "Z.ai reasoning model",
      },
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
        title: "Fetch Live OpenCode Catalog",
        instruction:
          "Click 'Fetch All Models' on the OpenCode card to live-discover all 80+ models available on opencode.ai/zen/v1/models (including big-pickle, glm-5.3-flash-free, beam-free, and muse-spark).",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'opencode/kimi-k2.5' or any free model to verify live responses.",
      },
      {
        step: 4,
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
      rpm: "10–20 req/min",
      rpd: "Unlimited",
      dailyLimit: "Unlimited (Keyless Queue)",
    },
    freeModels: [
      {
        id: "openai-fast",
        name: "OpenAI Fast",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "10–20 RPM",
        dailyQuota: "Unlimited",
        notes: "High speed GPT-OSS 20B reasoning",
      },
      {
        id: "qwen-coder",
        name: "Qwen Coder",
        pricing: "100% Free",
        contextWindow: "32k",
        rpm: "10–20 RPM",
        dailyQuota: "Unlimited",
        notes: "Coding assistant",
      },
      {
        id: "mistral",
        name: "Mistral",
        pricing: "100% Free",
        contextWindow: "32k",
        rpm: "10–20 RPM",
        dailyQuota: "Unlimited",
        notes: "Reasoning and general text",
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        pricing: "100% Free",
        contextWindow: "64k",
        rpm: "10–20 RPM",
        dailyQuota: "Unlimited",
        notes: "Open intelligence",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Keyless Public Endpoint",
        instruction:
          "Connects to https://text.pollinations.ai/openai/chat/completions directly without registration.",
      },
      {
        step: 2,
        title: "Fetch Live Models",
        instruction:
          "Click 'Fetch All Models' on the provider card to dynamically load active models from text.pollinations.ai.",
      },
      {
        step: 3,
        title: "Configure in CheapRouter",
        instruction:
          "If a connection modal asks for an API key, enter any dummy text like 'unused'.",
      },
      {
        step: 4,
        title: "Test & Use",
        instruction: "Click 'Test' on 'pollinations/openai-fast' to verify live text output.",
      },
    ],
  },

  // ── 13. SiliconFlow ────────────────────────────────────────────────────
  siliconflow: {
    authTypeBadge: "20M Free Tokens ($0.00 Models)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 20 Million Free Tokens",
    apiKeyUrl: "https://cloud.siliconflow.cn/account/ak",
    requirements: {
      loginStatus: "Free Account Required (cloud.siliconflow.cn)",
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
      rpm: "10–30 req/min",
      dailyLimit: "20 Million Tokens + $0 Models",
    },
    freeModels: [
      {
        id: "Qwen/Qwen2.5-7B-Instruct",
        name: "Qwen 2.5 7B",
        pricing: "Permanent $0.00",
        contextWindow: "32k",
        rpm: "30 RPM",
        dailyQuota: "Unlimited Free Tier",
        notes: "Permanent $0.00 free tier",
      },
      {
        id: "deepseek-ai/DeepSeek-V3",
        name: "DeepSeek V3",
        pricing: "20M Token Pool",
        contextWindow: "64k",
        rpm: "10–30 RPM",
        dailyQuota: "From 20M Free Grant",
        notes: "Top open weights 671B",
      },
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1",
        pricing: "20M Token Pool",
        contextWindow: "64k",
        rpm: "10–30 RPM",
        dailyQuota: "From 20M Free Grant",
        notes: "Reasoning model",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Register Free Account",
        instruction: "Sign up at cloud.siliconflow.cn. Go to API Keys and copy your API key.",
        linkUrl: "https://cloud.siliconflow.cn/account/ak",
        linkLabel: "Get SiliconFlow API Key",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction: "Click 'Add Connection' on SiliconFlow card, paste your API key, and save.",
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
    apiKeyUrl: "https://huggingface.co/settings/tokens",
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
      rpm: "15–30 req/min",
      rpd: "~1,000 req/hour",
      dailyLimit: "~24,000 requests/day",
    },
    freeModels: [
      {
        id: "Qwen/Qwen2.5-Coder-32B-Instruct",
        name: "Qwen 2.5 Coder 32B",
        pricing: "100% Free",
        contextWindow: "32k",
        rpm: "15–30 RPM",
        dailyQuota: "~1,000 req/hour",
        notes: "High performance coding",
      },
      {
        id: "meta-llama/Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "~1,000 req/hour",
        notes: "Flagship general intelligence",
      },
      {
        id: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
        name: "DeepSeek R1 32B",
        pricing: "100% Free",
        contextWindow: "64k",
        rpm: "15–30 RPM",
        dailyQuota: "~1,000 req/hour",
        notes: "Math & reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create Free Read Token",
        instruction:
          "Sign up at huggingface.co. Go to Settings → Access Tokens → Create 'Read' Token (hf_...).",
        linkUrl: "https://huggingface.co/settings/tokens",
        linkLabel: "Create Hugging Face Read Token",
      },
      {
        step: 2,
        title: "Paste in CheapRouter",
        instruction: "Click 'Add Connection' on Hugging Face card, paste your token, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction: "Click 'Test' on any supported model to verify serverless inference.",
      },
    ],
  },

  // ── 15. Cohere ─────────────────────────────────────────────────────────
  cohere: {
    authTypeBadge: "Free Trial Tier (1k calls/mo)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Trial • No credit card required • 1,000 calls/month",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
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
      rpm: "20 req/min",
      dailyLimit: "1,000 API calls/month",
    },
    freeModels: [
      {
        id: "command-r-plus",
        name: "Command R+",
        pricing: "Free Trial",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "1,000 calls/month",
        notes: "State of the art multilingual & tools",
      },
      {
        id: "command-r",
        name: "Command R",
        pricing: "Free Trial",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "1,000 calls/month",
        notes: "Fast retrieval & chat",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Cohere Trial Key",
        instruction:
          "Sign up at dashboard.cohere.com. Navigate to API Keys and copy your Trial Key.",
        linkUrl: "https://dashboard.cohere.com/api-keys",
        linkLabel: "Get Cohere Trial Key",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction: "Click 'Add Connection' on Cohere card, paste your Trial Key, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction: "Click 'Test' on 'cohere/command-r-plus' to confirm live output.",
      },
    ],
  },

  // ── 16. Mistral AI ─────────────────────────────────────────────────────
  mistral: {
    authTypeBadge: "Free Tier (60 RPM)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Tier • No credit card required • 1 req/sec (60 RPM)",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
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
      rpm: "60 req/min (1 RPS)",
      tpm: "500,000 TPM",
      dailyLimit: "Free Experimentation Tier",
    },
    freeModels: [
      {
        id: "mistral-small-latest",
        name: "Mistral Small 3",
        pricing: "Free Tier ($0.00)",
        contextWindow: "32k",
        rpm: "60 RPM (1 RPS)",
        dailyQuota: "Unlimited (500k TPM)",
        notes: "Fast reasoning & general chat",
      },
      {
        id: "codestral-latest",
        name: "Codestral",
        pricing: "Free Tier ($0.00)",
        contextWindow: "256k",
        rpm: "60 RPM (1 RPS)",
        dailyQuota: "Unlimited (500k TPM)",
        notes: "Dedicated 80+ language coding model",
      },
      {
        id: "open-mistral-nemo",
        name: "Mistral NeMo 12B",
        pricing: "Free Tier ($0.00)",
        contextWindow: "128k",
        rpm: "60 RPM (1 RPS)",
        dailyQuota: "Unlimited (500k TPM)",
        notes: "Compact open-weights",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Generate Mistral API Key",
        instruction: "Sign in to console.mistral.ai. Go to API Keys → Create New Key and copy it.",
        linkUrl: "https://console.mistral.ai/api-keys",
        linkLabel: "Generate Mistral API Key",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction: "Click 'Add Connection' on Mistral card, paste the API key, and save.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction: "Click 'Test' on 'mistral/codestral-latest' to verify coding capabilities.",
      },
    ],
  },

  // ── 16b. Puter.js ───────────────────────────────────────────────────────
  puter: {
    authTypeBadge: "100% Free • Zero Card",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText:
      "Free developer AI • Claude 3.5 Sonnet, GPT-4o mini, DeepSeek R1 • No credit card",
    apiKeyUrl: "https://puter.com",
    requirements: {
      loginStatus: "Optional Puter.com account (Instant key or anonymous session)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "Puter Auth Token or default anonymous connector",
      connectionType: "OpenAI-compatible HTTP /api.puter.com/puterai/openai/v1",
      toolsSupported: "CheapRouter Web Chat, /v1 API routes, CLI tools",
    },
    limits: {
      rateLimitBadge: "20–30 req/min (Developer Free Tier)",
      rateLimitDetail:
        "Free cloud computing environment with daily AI quota. Generous requests per minute (20-30 RPM) across GPT-4o mini, Claude 3.5 Sonnet, and DeepSeek R1 without credit card entry.",
      quotaReset: "Sliding window rate limit & daily replenishment at 00:00 UTC.",
      rpm: "20–30 req/min",
      dailyLimit: "Daily quota per account",
    },
    freeModels: [
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20–30 RPM",
        dailyQuota: "Developer Quota",
        notes: "OpenAI fast intelligence via Puter",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        pricing: "100% Free",
        contextWindow: "200k",
        rpm: "20–30 RPM",
        dailyQuota: "Developer Quota",
        notes: "Anthropic premier coding",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        pricing: "100% Free",
        contextWindow: "64k",
        rpm: "20–30 RPM",
        dailyQuota: "Developer Quota",
        notes: "Full chain-of-thought reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Get Puter Credentials (Optional)",
        instruction:
          "Puter runs in the cloud at puter.com. You can generate an API key from your Puter developer dashboard or use CheapRouter's built-in connector.",
        linkUrl: "https://puter.com",
        linkLabel: "Open Puter.com",
      },
      {
        step: 2,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Puter card, click 'Add Connection'. If you have a Puter user token paste it, or use the default preconfigured credentials.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'gpt-4o-mini' or 'claude-3-5-sonnet' to verify response from api.puter.com.",
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
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        pricing: "Free Web Session",
        contextWindow: "1M tokens",
        rpm: "15–30 RPM",
        dailyQuota: "~60 req/hour",
        notes: "High speed multimodal via web session",
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        pricing: "Free Web Session",
        contextWindow: "1M tokens",
        rpm: "5–10 RPM",
        dailyQuota: "~30 req/hour",
        notes: "Deep reasoning web session",
      },
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
      rateLimitDetail: "Standard claude.ai rolling window. Resets every 5 hours without payment.",
      quotaReset: "Rolling 5-hour window.",
    },
    freeModels: [
      {
        id: "claude-3-7-sonnet",
        name: "Claude 3.7 Sonnet",
        pricing: "Free Web Session",
        contextWindow: "200k",
        rpm: "10 RPM",
        dailyQuota: "~30–45 msgs/5h",
        notes: "Hybrid reasoning via claude.ai session",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        pricing: "Free Web Session",
        contextWindow: "200k",
        rpm: "10 RPM",
        dailyQuota: "~30–45 msgs/5h",
        notes: "Premier coding via claude.ai session",
      },
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
        instruction: "Click 'Test' on Claude 3.5 Sonnet to confirm web session proxy is working.",
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
      {
        id: "gpt-4o",
        name: "GPT-4o",
        pricing: "Free Web Session",
        contextWindow: "128k",
        rpm: "10 RPM",
        dailyQuota: "~10 msgs / 3h",
        notes: "Flagship multimodal via chatgpt.com session",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        pricing: "Free Web Session",
        contextWindow: "128k",
        rpm: "20 RPM",
        dailyQuota: "Unlimited turns",
        notes: "Fast intelligence fallback",
      },
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
        instruction: "Click 'Test' to verify headless browser session connectivity.",
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
      {
        id: "grok-3",
        name: "Grok 3",
        pricing: "Free Web Session",
        contextWindow: "128k",
        rpm: "10 RPM",
        dailyQuota: "~20–50 msgs / 2h",
        notes: "xAI powerhouse via grok.com session",
      },
      {
        id: "grok-3-mini",
        name: "Grok 3 Mini",
        pricing: "Free Web Session",
        contextWindow: "128k",
        rpm: "15 RPM",
        dailyQuota: "~50 msgs / 2h",
        notes: "Fast reasoning via grok.com session",
      },
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
        instruction: "Click Save, then click 'Test' on Grok 3 to verify session validation.",
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
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        pricing: "Free Web Session",
        contextWindow: "64k",
        rpm: "15 RPM",
        dailyQuota: "~50 chats/day",
        notes: "DeepSeek V3 chat & coding",
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        pricing: "Free Web Session",
        contextWindow: "64k",
        rpm: "10 RPM",
        dailyQuota: "~50 chats/day",
        notes: "DeepSeek R1 reasoning session",
      },
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
        instruction: "Click 'Test' on DeepSeek V3 to verify response.",
      },
    ],
  },

  // ── 22. Genspark AI Web ────────────────────────────────────────────────
  "genspark-web": {
    authTypeBadge: "Web Cookie • 100 Credits/Day",
    authTypeColor: "orange",
    isCompletelyFree: true,
    topSummaryText:
      "Genspark AI Web Chat • 100 Free Credits Daily • Claude 3.5 Sonnet, GPT-4o & Spark 1 • No Credit Card Required",
    apiKeyUrl: "https://www.genspark.ai",
    requirements: {
      loginStatus: "Login Required (Free Google or Email Signup)",
      creditCardStatus: "No Credit Card Required ($0 Free Plan)",
      credentialsNeeded: "Browser Session Cookie (GS_COOKIE) or local genspark2api proxy URL",
      connectionType: "Web Session Cookie / Reverse Proxy",
      toolsSupported: "CheapRouter Web Chat, /v1/chat/completions, AI Search Agents",
    },
    limits: {
      rateLimitBadge: "100 Credits / Day (~20–50 Chat Queries)",
      rateLimitDetail:
        "Free tier grants 100 credits every day without requiring a credit card. Regular chat queries consume ~1–5 credits per prompt (allowing 20–50 queries/day). Heavy tasks like Deep Research, slide generation, or video creation consume 40–100 credits per run.",
      quotaReset: "Refreshes every 24 hours (Midnight UTC).",
      rpm: "10–20 req/min",
      rpd: "20–50 chats/day",
      dailyLimit: "100 Credits / Day",
    },
    freeModels: [
      {
        id: "spark-1",
        name: "Spark 1 (Genspark Flagship)",
        pricing: "100 Credits Daily",
        contextWindow: "128k",
        rpm: "10–20 RPM",
        dailyQuota: "20–50 chats/day",
        notes: "Fast multi-agent search model",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        pricing: "100 Credits Daily",
        contextWindow: "128k",
        rpm: "10 RPM",
        dailyQuota: "20–30 chats/day",
        notes: "Via Genspark web agent",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        pricing: "100 Credits Daily",
        contextWindow: "128k",
        rpm: "10 RPM",
        dailyQuota: "20–30 chats/day",
        notes: "Via Genspark web agent",
      },
      {
        id: "deepseek-v3",
        name: "DeepSeek V3",
        pricing: "100 Credits Daily",
        contextWindow: "64k",
        rpm: "10–20 RPM",
        dailyQuota: "20–50 chats/day",
        notes: "Open-weight reasoning",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Create Free Genspark Account",
        instruction:
          "Visit genspark.ai and sign in with Google or Email. No credit card is required. You instantly receive 100 free credits for the day.",
        linkUrl: "https://www.genspark.ai",
        linkLabel: "Open Genspark.ai ↗",
      },
      {
        step: 2,
        title: "Copy Session Cookie (GS_COOKIE)",
        instruction:
          "Open your browser Developer Tools (F12) → go to Application → Cookies → https://www.genspark.ai. Copy the cookie value or full cookie header string.",
      },
      {
        step: 3,
        title: "Add Connection in CheapRouter",
        instruction:
          "In CheapRouter Dashboard, go to Providers → Genspark AI Web → Click 'Add Connection'. Paste your cookie string into the Cookie box and click Save.",
      },
      {
        step: 4,
        title: "Alternative: Use Local genspark2api Proxy",
        instruction:
          "If Cloudflare anti-bot blocks direct datacenter requests, run the open-source docker container 'deanxv/genspark2api' locally and connect via Custom Base URL (http://localhost:7055/v1).",
        linkUrl: "https://github.com/deanxv/genspark2api",
        linkLabel: "genspark2api GitHub ↗",
      },
      {
        step: 5,
        title: "Test Connection & Route Models",
        instruction:
          "Click 'Test' on 'genspark-web/claude-3-5-sonnet' or 'genspark-web/gpt-4o' to verify live responses. Route prompts with 'genspark-web/<model-id>'.",
      },
    ],
  },

  // ── 22. Arena (formerly LMArena) ───────────────────────────────────────
  lmarena: {
    authTypeBadge: "Free Web Session ($0.00)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free Frontier Models • Claude Sonnet 5, DeepSeek V4, GPT-5/4o",
    apiKeyUrl: "https://arena.ai",
    requirements: {
      loginStatus: "Free Account / Web Session (arena.ai)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "Browser Cookie Header (arena-auth-prod-v1...)",
      connectionType: "Web Cookie Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes, CLIs",
    },
    limits: {
      rateLimitBadge: "Direct Chat Model Allowance",
      rateLimitDetail:
        "Free direct chat access to over 50 leading AI models including Claude Sonnet 5, DeepSeek V4 Pro, GPT-5, and Gemini 2.5 Pro without paying any subscription.",
      quotaReset: "Sliding window / per-session allowance.",
      rpm: "15–30 req/min",
      rpd: "Unlimited (within sessions)",
      dailyLimit: "Unlimited within session concurrency",
    },
    freeModels: [
      {
        id: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        pricing: "100% Free",
        contextWindow: "200k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited / Session",
        notes: "Anthropic flagship via Arena",
      },
      {
        id: "deepseek-v4-pro-thinking",
        name: "DeepSeek V4 Pro",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited / Session",
        notes: "High reasoning CoT",
      },
      {
        id: "amazon.nova-pro-v1:0",
        name: "Nova Pro",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "15–30 RPM",
        dailyQuota: "Unlimited / Session",
        notes: "Amazon frontier model",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Open Arena.ai",
        instruction:
          "Visit arena.ai and sign in with your email or Google account (or use direct chat mode).",
        linkUrl: "https://arena.ai",
        linkLabel: "Open Arena.ai",
      },
      {
        step: 2,
        title: "Copy Session Cookie",
        instruction:
          "Press F12 to open Developer Tools → Network tab. Send a message or click any model. Inspect the request headers and copy the full 'Cookie' header string (must contain arena-auth-prod-v1...).",
      },
      {
        step: 3,
        title: "Add Connection in CheapRouter",
        instruction:
          "On the Arena card, click 'Add Connection'. Paste the Cookie header into the Cookie input and click Save.",
      },
      {
        step: 4,
        title: "Test Connection",
        instruction: "Click 'Test' on 'lmarena/claude-sonnet-5' to verify live routing.",
      },
    ],
  },

  // ── 23. HuggingChat (Free) ─────────────────────────────────────────────
  huggingchat: {
    authTypeBadge: "Free Web Session ($0.00)",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Free HuggingFace LLM Chat • Llama 3.3, Qwen 2.5, DeepSeek",
    apiKeyUrl: "https://huggingface.co/chat",
    requirements: {
      loginStatus: "Free Hugging Face Account (huggingface.co)",
      creditCardStatus: "No Credit Card Required (100% Free)",
      credentialsNeeded: "hf-chat Cookie Header",
      connectionType: "Web Cookie Authentication",
      toolsSupported: "CheapRouter Web Chat, API routes",
    },
    limits: {
      rateLimitBadge: "Generous Free Tier",
      rateLimitDetail:
        "Free LLM chat powered by Hugging Face inference. Provides fast access to open-weights models like Llama 3.3 70B, Qwen 2.5 72B, and DeepSeek models.",
      quotaReset: "Sliding rate limit window.",
      rpm: "20–40 req/min",
      rpd: "Generous turns/day",
      dailyLimit: "Generous daily turns",
    },
    freeModels: [
      {
        id: "meta-llama/Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20–40 RPM",
        dailyQuota: "Generous daily turns",
        notes: "Hugging Face direct",
      },
      {
        id: "Qwen/Qwen2.5-72B-Instruct",
        name: "Qwen 2.5 72B",
        pricing: "100% Free",
        contextWindow: "128k",
        rpm: "20–40 RPM",
        dailyQuota: "Generous daily turns",
        notes: "Open weights coding",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Log In to HuggingChat",
        instruction: "Visit huggingface.co/chat and sign in with your free Hugging Face account.",
        linkUrl: "https://huggingface.co/chat",
        linkLabel: "Open HuggingChat",
      },
      {
        step: 2,
        title: "Copy hf-chat Cookie",
        instruction:
          "Open Developer Tools (F12) → Network tab. Send a chat message or refresh. Copy the Cookie header containing 'hf-chat'.",
      },
      {
        step: 3,
        title: "Paste into CheapRouter",
        instruction:
          "Click 'Add Connection' on the HuggingChat card in CheapRouter, paste your Cookie header and click Save.",
      },
    ],
  },

  // ── 24. AI Horde (Keyless Crowd-Sourced GPUs) ─────────────────────────
  aihorde: {
    authTypeBadge: "100% Free • Crowd GPUs",
    authTypeColor: "emerald",
    isCompletelyFree: true,
    topSummaryText: "Decentralized GPU Cluster • 28+ Models • Zero Signup ($0.00)",
    apiKeyUrl: "https://aihorde.net",
    requirements: {
      loginStatus: "Without Login (Zero Signup / Anonymous API Key: 0000000000)",
      creditCardStatus: "No Credit Card Required (100% $0.00 Free)",
      credentialsNeeded: "Anonymous Key '0000000000' (Pre-configured automatically)",
      connectionType: "AI Horde OpenAI-compatible REST API (oai.aihorde.net/v1)",
      toolsSupported: "CheapRouter Web Chat, /v1/chat/completions, OpenCode CLI, Kilo",
    },
    limits: {
      rateLimitBadge: "Kudos Queue / Anonymous Priority",
      rateLimitDetail:
        "Crowd-sourced GPU cluster powered by community volunteers. The anonymous key ('0000000000') gives completely free access to all text models. Requests join the shared community queue (response times vary based on worker availability; usually 5–30s). Registered users who share GPU workers earn Kudos for higher queue priority.",
      quotaReset: "Continuous queue processing (Zero daily caps).",
      rpm: "10–20 req/min",
      rpd: "Unlimited",
      dailyLimit: "Unlimited ($0.00 Cost)",
    },
    freeModels: [
      {
        id: "aphrodite/koboldcpp/L3-8B-Stheno-v3.2",
        name: "L3 8B Stheno v3.2",
        pricing: "100% Free",
        contextWindow: "8k",
        rpm: "10 RPM",
        dailyQuota: "Unlimited",
        notes: "Crowd-sourced community worker",
      },
      {
        id: "aphrodite/Sao10K/L3-8B-Lunaris-v1",
        name: "L3 8B Lunaris v1",
        pricing: "100% Free",
        contextWindow: "8k",
        rpm: "10 RPM",
        dailyQuota: "Unlimited",
        notes: "Creative roleplay & writing",
      },
      {
        id: "aphrodite/meta-llama/Meta-Llama-3-8B-Instruct",
        name: "Meta Llama 3 8B Instruct",
        pricing: "100% Free",
        contextWindow: "8k",
        rpm: "10 RPM",
        dailyQuota: "Unlimited",
        notes: "Fast general instruction",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Anonymous Access Pre-Configured",
        instruction:
          "AI Horde uses public community GPUs. CheapRouter automatically supplies the anonymous key '0000000000' — zero registration or credit card needed.",
      },
      {
        step: 2,
        title: "Fetch All Live Models",
        instruction:
          "Click 'Fetch All Models' on the AI Horde card to query oai.aihorde.net/v1/models and live-discover all 28+ active community models.",
      },
      {
        step: 3,
        title: "Test Connection",
        instruction:
          "Click 'Test' on 'aphrodite/koboldcpp/L3-8B-Stheno-v3.2' to verify live queue response from community workers.",
      },
      {
        step: 4,
        title: "Optional: Add Custom API Key with Kudos",
        instruction:
          "If you register an account at aihorde.net or share a GPU worker, you can generate an API key with Kudos to get faster queue priority.",
        linkUrl: "https://aihorde.net/register",
        linkLabel: "Register at AI Horde (Optional for Kudos) ↗",
      },
    ],
  },

  // ── Devin (Cognition AI) ────────────────────────────────────────────────
  devin: {
    authTypeBadge: "API Key / CLI Login",
    authTypeColor: "purple",
    isCompletelyFree: false,
    topSummaryText: "Cloud Agent API or Local CLI • Cognition AI",
    apiKeyUrl: "https://app.devin.ai/settings/api-keys",
    requirements: {
      loginStatus: "Devin Account (app.devin.ai) or local Devin CLI login",
      creditCardStatus: "Requires Devin Subscription or active API credits",
      credentialsNeeded: "Devin API Key (Cloud) OR 'devin auth login' session (CLI)",
      connectionType: "Bearer API Key OR Local Process Spawning via stdio",
      toolsSupported: "Full agentic reasoning, code execution, repo editing",
    },
    limits: {
      rateLimitBadge: "Subscription / Credit Based",
      rateLimitDetail: "Rate limits and concurrency depend on your Devin tier.",
      rpm: "Standard Cognition rate limits",
    },
    freeModels: [
      {
        id: "devin",
        name: "Devin Agent",
        pricing: "Subscription / Credits",
        notes: "Autonomous AI software engineering agent",
      },
    ],
    connectSteps: [
      {
        step: 1,
        title: "Option A: Cloud API Key (Recommended)",
        instruction:
          "Visit app.devin.ai → Settings → API Keys to generate your Devin API key. Paste it directly in CheapRouter.",
        linkUrl: "https://app.devin.ai/settings/api-keys",
        linkLabel: "Open Devin API Keys Portal ↗",
      },
      {
        step: 2,
        title: "Option B: Local CLI (Without API Key)",
        instruction:
          "Install Devin CLI from cli.devin.ai on your machine. In terminal, run 'devin auth login' to sign in. CheapRouter will automatically discover your session without an API key.",
        linkUrl: "https://cli.devin.ai",
        linkLabel: "Install Devin CLI ↗",
      },
    ],
  },
};

// Aliases for providers with multiple catalog IDs
PROVIDER_GUIDES["genspark"] = PROVIDER_GUIDES["genspark-web"];
PROVIDER_GUIDES["cloudflare-ai"] = PROVIDER_GUIDES["cloudflare"];
PROVIDER_GUIDES["github-models"] = PROVIDER_GUIDES["github"];
PROVIDER_GUIDES["pollinations-text"] = PROVIDER_GUIDES["pollinations"];
PROVIDER_GUIDES["aihorde-community"] = PROVIDER_GUIDES["aihorde"];
PROVIDER_GUIDES["devin-cli"] = PROVIDER_GUIDES["devin"];
PROVIDER_GUIDES["devin-cli-agentic"] = PROVIDER_GUIDES["devin"];
PROVIDER_GUIDES["devin-desktop"] = PROVIDER_GUIDES["devin"];

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
  const directMatch =
    PROVIDER_GUIDES[providerId] ||
    (providerId === "cloudflare-ai" ? PROVIDER_GUIDES["cloudflare"] : undefined) ||
    (providerId === "cloudflare" ? PROVIDER_GUIDES["cloudflare-ai"] : undefined) ||
    (providerId === "github-models" ? PROVIDER_GUIDES["github"] : undefined) ||
    (providerId === "pollinations-text" ? PROVIDER_GUIDES["pollinations"] : undefined);

  if (directMatch) {
    return directMatch;
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
        {
          id: `${providerId}/default`,
          name: `${providerName} Model`,
          notes: "Default open endpoint",
        },
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
      freeModels:
        Array.isArray(catalogEntry.models) && catalogEntry.models.length > 0
          ? catalogEntry.models.slice(0, 10).map((m: any) => ({
              id: typeof m === "string" ? m : m.id || `${providerId}/model`,
              name: typeof m === "string" ? m : m.name || m.id || `${providerName} Model`,
              pricing: hasFree ? "Free Tier / Included" : "Standard Tier",
              contextWindow:
                typeof m === "object" && m.context_length
                  ? `${Math.round(m.context_length / 1000)}k`
                  : undefined,
              notes: "Available for routing once connected",
            }))
          : [],
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
      freeModels:
        Array.isArray(catalogEntry.models) && catalogEntry.models.length > 0
          ? catalogEntry.models.slice(0, 10).map((m: any) => ({
              id: typeof m === "string" ? m : m.id || `${providerId}/model`,
              name: typeof m === "string" ? m : m.name || m.id || `${providerName} Model`,
              pricing: "100% Free / Local",
              contextWindow:
                typeof m === "object" && m.context_length
                  ? `${Math.round(m.context_length / 1000)}k`
                  : undefined,
              notes: "Local hardware inference",
            }))
          : [],
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
          instruction: "Click 'Test' on this provider card to measure instantaneous local latency.",
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
    apiKeyUrl: apiKeyUrl || undefined,
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
    freeModels:
      Array.isArray(catalogEntry.models) && catalogEntry.models.length > 0
        ? catalogEntry.models.slice(0, 10).map((m: any) => ({
            id: typeof m === "string" ? m : m.id || `${providerId}/model`,
            name: typeof m === "string" ? m : m.name || m.id || `${providerName} Model`,
            pricing: hasFree ? "Free Tier / Included" : "Standard Tier",
            contextWindow:
              typeof m === "object" && m.context_length
                ? `${Math.round(m.context_length / 1000)}k`
                : undefined,
            notes: "Available for routing once connected",
          }))
        : [],
    connectSteps: [
      {
        step: 1,
        title: "Get Your API Key",
        instruction: apiKeyUrl
          ? `Visit the developer dashboard at ${apiKeyUrl} and create an API Key.`
          : `Sign in to ${providerName}'s official developer console and copy your API Key.`,
        linkUrl: apiKeyUrl || undefined,
        linkLabel: apiKeyUrl ? `Open ${providerName} Developer Portal` : undefined,
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

                {/* Structured Limits Metrics Grid */}
                {(guide.limits.rpm ||
                  guide.limits.rpd ||
                  guide.limits.tpm ||
                  guide.limits.dailyLimit) && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {guide.limits.rpm && (
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                        <div className="text-[10px] text-white/50 uppercase font-semibold">
                          Rate Limit (RPM)
                        </div>
                        <div className="text-white font-mono font-medium text-xs">
                          {guide.limits.rpm}
                        </div>
                      </div>
                    )}
                    {guide.limits.rpd && (
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                        <div className="text-[10px] text-white/50 uppercase font-semibold">
                          Daily Requests (RPD)
                        </div>
                        <div className="text-white font-mono font-medium text-xs">
                          {guide.limits.rpd}
                        </div>
                      </div>
                    )}
                    {guide.limits.tpm && (
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                        <div className="text-[10px] text-white/50 uppercase font-semibold">
                          Tokens / Min (TPM)
                        </div>
                        <div className="text-white font-mono font-medium text-xs">
                          {guide.limits.tpm}
                        </div>
                      </div>
                    )}
                    {guide.limits.dailyLimit && (
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-0.5">
                        <div className="text-[10px] text-white/50 uppercase font-semibold">
                          Daily Allowance
                        </div>
                        <div className="text-emerald-300 font-mono font-medium text-xs">
                          {guide.limits.dailyLimit}
                        </div>
                      </div>
                    )}
                  </div>
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
                  <div className="space-y-2">
                    {guide.freeModels.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-white/15 transition-all text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white truncate text-xs">
                              {m.name}
                            </span>
                            {m.pricing && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0">
                                {m.pricing}
                              </span>
                            )}
                          </div>

                          <div className="font-mono text-[10px] text-white/50 truncate flex items-center gap-1.5 flex-wrap">
                            <span className="text-white/70">{m.id}</span>
                            {m.contextWindow && (
                              <span className="text-sky-300/80 bg-sky-500/10 px-1 py-0.5 rounded border border-sky-500/20 text-[9px]">
                                {m.contextWindow}
                              </span>
                            )}
                          </div>

                          {(m.rpm || m.dailyQuota || m.notes) && (
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] pt-0.5">
                              {m.rpm && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-amber-300/90 font-mono text-[9px] border border-white/10">
                                  ⚡ {m.rpm}
                                </span>
                              )}
                              {m.dailyQuota && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-emerald-300/90 font-mono text-[9px] border border-white/10">
                                  📅 {m.dailyQuota}
                                </span>
                              )}
                              {m.notes && (
                                <span className="text-white/50 text-[10px] leading-tight">
                                  • {m.notes}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => copy(m.id)}
                          className="size-7 shrink-0 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors mt-0.5"
                          title="Copy model ID"
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {copied ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/60 py-2">
                    Models for this provider are synced dynamically once connected. Click
                    &apos;Test&apos; on any model to verify.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: HOW TO CONNECT (NOT "How to Use"!) ═══════════ */}
          {activeTab === "connect" && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              {/* Direct API Key Generation Link Banner */}
              {guide.apiKeyUrl && (
                <a
                  href={guide.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 transition-all text-xs font-medium group shadow-sm shadow-sky-950/20"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-base text-sky-400 shrink-0">
                      key
                    </span>
                    <span className="truncate">
                      <span className="block text-white font-semibold text-xs truncate">
                        Generate API Key / Token
                      </span>
                      <span className="text-[10px] text-sky-300/80 font-normal truncate block font-mono">
                        {guide.apiKeyUrl}
                      </span>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-sky-500/20 text-sky-300 font-medium shrink-0 group-hover:bg-sky-500/30">
                    Open Portal
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </span>
                </a>
              )}

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
                  <span className="material-symbols-outlined text-[13px] text-emerald-400">
                    checklist
                  </span>
                  How to Connect in CheapRouter (Step-by-Step)
                </div>

                <div className="space-y-2.5">
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
                        {step.linkUrl && (
                          <a
                            href={step.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[11px] text-sky-300 hover:text-sky-200 font-medium transition-colors"
                          >
                            <span className="material-symbols-outlined text-[12px] text-sky-400">
                              open_in_new
                            </span>
                            <span>{step.linkLabel || "Generate Credentials Here"}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Admin Tip Card */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] text-white/70 space-y-1">
                <div className="font-semibold text-white/90 text-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[13px] text-sky-400">
                    tips_and_updates
                  </span>
                  Admin Verification Tip
                </div>
                <p className="leading-relaxed">
                  After saving credentials, always click the{" "}
                  <strong className="text-white">Test</strong> button on the provider card. A green
                  latency response confirms the provider is ready for automated fallback and combo
                  routing.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
