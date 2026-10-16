import type { ModelLibraryItem } from "./ModelsTable";

// 12 Primary Screenshot Models
const BASE_MODELS: ModelLibraryItem[] = [
  {
    id: "google/gemini-4-argon",
    name: "gemini-4-argon",
    symbol: "G",
    modality: "text",
    weeklyTokens: "209.2M",
    inputPrice: "$0.45",
    inputOriginal: "$2.00",
    inputDiscount: "78% off",
    outputPrice: "$2.25",
    outputOriginal: "$10.00",
    outputDiscount: "78% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 77.0,
    success: 98.1,
    latency: "16.69s",
    released: "Oct 13, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "meta/muse-wonder",
    name: "muse-wonder",
    symbol: "∞",
    modality: "image",
    weeklyTokens: "1.63M",
    inputPrice: "$8.00",
    outputPrice: "$40.00",
    context: "1.0M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 66.7,
    latency: "3.32s",
    released: "Oct 12, 2026",
    hasFunctionCalling: false,
  },
  {
    id: "step/step-5-preview",
    name: "step-5-preview",
    symbol: "🎵",
    modality: "text",
    weeklyTokens: "593K",
    inputPrice: "$2.00",
    outputPrice: "$5.40",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 100.0,
    latency: "1.16s",
    released: "Oct 8, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "anthropic/claude-haiku-5-5",
    name: "claude-haiku-5-5",
    symbol: "A\\",
    modality: "text",
    weeklyTokens: "1.80B",
    inputPrice: "$0.05",
    inputOriginal: "$0.10",
    inputDiscount: "50% off",
    outputPrice: "$0.25",
    outputOriginal: "$0.50",
    outputDiscount: "50% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 99.9,
    latency: "22.83s",
    released: "Oct 7, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "google/gemini-nano-banana-2-1",
    name: "gemini-nano-banana-2.1",
    symbol: "G",
    modality: "image",
    weeklyTokens: "1.83M",
    inputPrice: "-",
    outputPrice: "$0.02/img",
    outputOriginal: "$0.08/img",
    outputDiscount: "70% off",
    context: "65.5K",
    contextNum: 65500,
    uptime: 100.0,
    success: 68.8,
    latency: "30.19s",
    released: "Oct 6, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "mistral/mistral-large-4",
    name: "mistral-large-4",
    symbol: "M",
    modality: "text",
    weeklyTokens: "7.26M",
    inputPrice: "$1.36",
    outputPrice: "$4.08",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 33.3,
    latency: "4.27s",
    released: "Oct 6, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "ling/ling-3-1-flash-free",
    name: "ling-3.1-flash:free",
    symbol: "⏱",
    modality: "text",
    weeklyTokens: "500.8M",
    inputPrice: "-",
    outputPrice: "-",
    context: "262.1K",
    contextNum: 262100,
    uptime: 67.1,
    success: 81.1,
    latency: "2.76s",
    released: "Oct 2, 2026",
    isFree: true,
    hasFunctionCalling: true,
  },
  {
    id: "mercury/mercury-decide-free",
    name: "mercury-decide:free",
    symbol: "⏣",
    modality: "decisions",
    weeklyTokens: "1.34M",
    inputPrice: "-",
    outputPrice: "-",
    context: "32.8K",
    contextNum: 32800,
    uptime: 100.0,
    success: 40.0,
    latency: "1.28s",
    released: "Sep 30, 2026",
    isFree: true,
    hasFunctionCalling: false,
  },
  {
    id: "openai/gpt-6-1-sol",
    name: "gpt-6.1-sol",
    symbol: "✹",
    modality: "text",
    weeklyTokens: "1.57B",
    inputPrice: "$0.36",
    inputOriginal: "$2.00",
    inputDiscount: "82% off",
    outputPrice: "$1.79",
    outputOriginal: "$10.00",
    outputDiscount: "82% off",
    context: "1.1M",
    contextNum: 1100000,
    uptime: 100.0,
    success: 99.2,
    latency: "16.07s",
    released: "Sep 29, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "anthropic/claude-sonnet-5-5",
    name: "claude-sonnet-5-5",
    symbol: "A\\",
    modality: "text",
    weeklyTokens: "748.6M",
    inputPrice: "$0.50",
    inputOriginal: "$2.00",
    inputDiscount: "75% off",
    outputPrice: "$2.50",
    outputOriginal: "$10.00",
    outputDiscount: "75% off",
    context: "1M",
    contextNum: 1000000,
    uptime: 100.0,
    success: 99.9,
    latency: "8.27s",
    released: "Sep 28, 2026",
    hasFunctionCalling: true,
  },
  {
    id: "openai/text-embedding-3-large",
    name: "text-embedding-3-large",
    symbol: "OI",
    modality: "embeddings",
    weeklyTokens: "320.4M",
    inputPrice: "$0.13",
    outputPrice: "-",
    context: "8K",
    contextNum: 8192,
    uptime: 100.0,
    success: 100.0,
    latency: "0.12s",
    released: "Sep 15, 2026",
    hasFunctionCalling: false,
  },
  {
    id: "openai/whisper-large-v3",
    name: "whisper-large-v3",
    symbol: "OI",
    modality: "audio",
    weeklyTokens: "84.2M",
    inputPrice: "$0.006/min",
    outputPrice: "-",
    context: "Audio",
    contextNum: 30000,
    uptime: 99.8,
    success: 99.7,
    latency: "1.85s",
    released: "Sep 10, 2026",
    hasFunctionCalling: false,
  },
];

// Helper to generate the remaining models up to 214 total
export function generateCatalog(): ModelLibraryItem[] {
  const result: ModelLibraryItem[] = [...BASE_MODELS];

  const TEXT_PROVIDERS = [
    { p: "openai", symbol: "✹", models: ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini", "o3", "o3-mini", "gpt-4-turbo", "gpt-3.5-turbo", "chatgpt-4o-latest", "gpt-4o-realtime", "gpt-4-0125-preview", "gpt-4-vision-preview", "gpt-4-32k", "gpt-3.5-turbo-16k", "gpt-4o-audio-preview"] },
    { p: "anthropic", symbol: "A\\", models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-2.1", "claude-2.0", "claude-instant-1.2"] },
    { p: "google", symbol: "G", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-thinking", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro", "gemma-2-27b-it", "gemma-2-9b-it", "gemma-2-2b-it", "code-gecko"] },
    { p: "deepseek", symbol: "🐋", models: ["deepseek-chat-v3", "deepseek-reasoner-r1", "deepseek-coder-v2.5", "deepseek-math-7b", "deepseek-v2-lite", "deepseek-llm-67b-chat"] },
    { p: "meta", symbol: "∞", models: ["llama-3.3-70b-instruct", "llama-3.1-405b-instruct", "llama-3.1-70b-instruct", "llama-3.1-8b-instruct", "llama-3-70b-instruct", "llama-3-8b-instruct", "codellama-70b-instruct", "llama-guard-3-8b"] },
    { p: "mistral", symbol: "M", models: ["mistral-large-2411", "mistral-small-2409", "mistral-nemo", "codestral-2501", "pixtral-large-2411", "pixtral-12b", "mixtral-8x22b-instruct", "mixtral-8x7b-instruct", "open-mistral-7b"] },
    { p: "qwen", symbol: "✦", models: ["qwen-2.5-max", "qwen-2.5-72b-instruct", "qwen-2.5-coder-32b-instruct", "qwen-2.5-14b-instruct", "qwen-2.5-7b-instruct", "qwq-32b-preview", "qwen-vl-max", "qwen-2.5-math-72b"] },
    { p: "cohere", symbol: "C", models: ["command-r-plus-08-2024", "command-r-08-2024", "command-r-plus", "command-r", "command-light", "command-nightly"] },
    { p: "xai", symbol: "✕", models: ["grok-2-1212", "grok-2-vision-1212", "grok-beta", "grok-vision-beta"] },
    { p: "perplexity", symbol: "P", models: ["sonar-reasoning-pro", "sonar-reasoning", "sonar-pro", "sonar", "llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online"] },
    { p: "groq", symbol: "⚡", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "qwen-2.5-coder-32b"] },
    { p: "zhipu", symbol: "智", models: ["glm-4-plus", "glm-4-air", "glm-4-airx", "glm-4-long", "glm-4-flash", "glm-4v-plus"] },
    { p: "moonshot", symbol: "🌙", models: ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k", "kimi-latest"] },
    { p: "baichuan", symbol: "百", models: ["baichuan4", "baichuan3-turbo", "baichuan2-turbo-192k"] },
    { p: "01ai", symbol: "零", models: ["yi-lightning", "yi-large", "yi-medium", "yi-spark", "yi-vision"] },
  ];

  let textCount = result.filter(m => m.modality === "text").length; // currently 6
  for (const prov of TEXT_PROVIDERS) {
    for (const m of prov.models) {
      if (textCount >= 142) break;
      const isFree = m.includes("flash") || m.includes("instant") || m.includes("8b") || m.includes("mini");
      const inPrice = isFree ? "-" : `$${(Math.random() * 2 + 0.05).toFixed(2)}`;
      const outPrice = isFree ? "-" : `$${(Math.random() * 8 + 0.2).toFixed(2)}`;
      const ctxNum = m.includes("128k") ? 128000 : m.includes("1m") || m.includes("plus") ? 1000000 : 200000;
      result.push({
        id: `${prov.p}/${m}`,
        name: m,
        symbol: prov.symbol,
        modality: "text",
        weeklyTokens: `${(Math.random() * 900 + 10).toFixed(1)}M`,
        inputPrice: inPrice,
        outputPrice: outPrice,
        inputDiscount: Math.random() > 0.6 ? `${Math.floor(Math.random() * 50 + 20)}% off` : undefined,
        outputDiscount: Math.random() > 0.6 ? `${Math.floor(Math.random() * 50 + 20)}% off` : undefined,
        context: ctxNum >= 1000000 ? "1M" : `${Math.round(ctxNum / 1000)}K`,
        contextNum: ctxNum,
        uptime: +(98 + Math.random() * 2).toFixed(1),
        success: +(97 + Math.random() * 3).toFixed(1),
        latency: `${(Math.random() * 3 + 0.3).toFixed(2)}s`,
        released: "Sep 2026",
        isFree,
        hasFunctionCalling: true,
      });
      textCount++;
    }
  }

  // IMAGE MODELS (target 55 total)
  const IMAGE_NAMES = [
    "flux-1.1-pro", "flux-dev", "flux-schnell", "flux-realism", "flux-ultra",
    "dall-e-3", "dall-e-3-hd", "dall-e-2", "midjourney-v6.1", "midjourney-v6.0",
    "stable-diffusion-3.5-large", "stable-diffusion-3.5-turbo", "sdxl-turbo", "sdxl-base-1.0",
    "ideogram-v2", "ideogram-v2-turbo", "recraft-v3", "recraft-20b",
    "imagen-3-fast", "imagen-3", "stable-cascade", "playground-v3",
    "kandinsky-3.1", "kolors-v1", "lumina-next", "aurora-v2",
    "aura-flow-v0.3", "hunyuan-dit", "pixart-sigma", "animate-diff-v3",
    "cogview-4", "cogvideo-x-5b", "mochi-1-preview", "ltx-video-0.9",
    "dreamshaper-xl", "realistic-vision-v6", "photoreal-v2", "open-dalle-v1.1",
    "juggernaut-xl-v9", "epicrealism-xl", "animagine-xl-3.1", "pony-diffusion-v6",
    "proteus-v0.5", "playground-v2.5", "albedo-base-xl", "counterfeit-xl",
    "ghostmix-v2", "absolutereality-v1.81", "cyberrealistic-v4.2", "revanimated-v1.2",
    "deliberate-v3", "dreamlike-photoreal-2.0", "openjourney-v4"
  ];
  let imgCount = result.filter(m => m.modality === "image").length; // currently 2
  for (const name of IMAGE_NAMES) {
    if (imgCount >= 55) break;
    result.push({
      id: `image/${name}`,
      name,
      symbol: "🖼",
      modality: "image",
      weeklyTokens: `${(Math.random() * 15 + 0.5).toFixed(2)}M`,
      inputPrice: "-",
      outputPrice: `$${(Math.random() * 0.06 + 0.01).toFixed(3)}/img`,
      context: "Image",
      contextNum: 32000,
      uptime: +(98 + Math.random() * 2).toFixed(1),
      success: +(96 + Math.random() * 4).toFixed(1),
      latency: `${(Math.random() * 6 + 1.2).toFixed(2)}s`,
      released: "Aug 2026",
      hasFunctionCalling: false,
    });
    imgCount++;
  }

  // AUDIO MODELS (target 8 total)
  const AUDIO_NAMES = [
    "whisper-large-v3-turbo", "elevenlabs-multilingual-v2", "elevenlabs-turbo-v2.5",
    "openai-tts-1", "openai-tts-1-hd", "deepgram-nova-2", "bark-v0.2"
  ];
  for (const name of AUDIO_NAMES) {
    if (result.filter(m => m.modality === "audio").length >= 8) break;
    result.push({
      id: `audio/${name}`,
      name,
      symbol: "🎙",
      modality: "audio",
      weeklyTokens: `${(Math.random() * 50 + 2).toFixed(1)}M`,
      inputPrice: `$${(Math.random() * 0.01 + 0.002).toFixed(4)}/min`,
      outputPrice: "-",
      context: "Audio",
      contextNum: 32000,
      uptime: 99.9,
      success: 99.8,
      latency: `${(Math.random() * 1.5 + 0.2).toFixed(2)}s`,
      released: "Aug 2026",
      hasFunctionCalling: false,
    });
  }

  // EMBEDDINGS MODELS (target 7 total)
  const EMB_NAMES = [
    "text-embedding-3-small", "text-embedding-ada-002", "cohere-embed-english-v3.0",
    "cohere-embed-multilingual-v3.0", "voyage-3-large", "bge-large-en-v1.5"
  ];
  for (const name of EMB_NAMES) {
    if (result.filter(m => m.modality === "embeddings").length >= 7) break;
    result.push({
      id: `embed/${name}`,
      name,
      symbol: "🗂",
      modality: "embeddings",
      weeklyTokens: `${(Math.random() * 400 + 50).toFixed(1)}M`,
      inputPrice: `$${(Math.random() * 0.05 + 0.01).toFixed(3)}`,
      outputPrice: "-",
      context: "8K",
      contextNum: 8192,
      uptime: 100.0,
      success: 100.0,
      latency: "0.08s",
      released: "Jul 2026",
      hasFunctionCalling: false,
    });
  }

  // DECISIONS MODELS (target 2 total)
  if (result.filter(m => m.modality === "decisions").length < 2) {
    result.push({
      id: "eval/promptfoo-judge-v1",
      name: "promptfoo-judge-v1",
      symbol: "⚖",
      modality: "decisions",
      weeklyTokens: "4.8M",
      inputPrice: "-",
      outputPrice: "-",
      context: "64K",
      contextNum: 64000,
      uptime: 100.0,
      success: 99.4,
      latency: "0.85s",
      released: "Jul 2026",
      isFree: true,
      hasFunctionCalling: false,
    });
  }

  return result;
}
