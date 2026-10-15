/**
 * Centralized Model Capabilities Detection Engine
 *
 * Single source of truth for extracting, inferring, and normalizing
 * capabilities (Vision, Reasoning, Code, Image Gen, Audio, Video,
 * Embedding, Search, Tools, Chat) across both backend discovery
 * and frontend provider/model tables.
 */
import { isVisionModelId } from "@/shared/constants/visionModels";

export interface DetectedModelCapabilities {
  hasChat: boolean;
  hasCode: boolean;
  hasVision: boolean;
  hasReasoning: boolean;
  hasImageGen: boolean;
  hasVideo: boolean;
  hasSearch: boolean;
  hasAudio: boolean;
  hasEmbedding: boolean;
  hasTools: boolean;
  isFree?: boolean;
  capabilities: string[];
}

export interface ModelCapabilityInput {
  id?: string;
  modelId?: string;
  name?: string;
  modelName?: string;
  capabilities?: string[] | Record<string, unknown> | null;
  categories?: string[] | null;
  peers?: Array<{ categories?: string[] }> | null;
  supportedEndpoints?: string[] | null;
  supportsVision?: boolean;
  reasoning?: boolean;
  supportsThinking?: boolean;
  alwaysThinking?: boolean;
  isFree?: boolean;
  cost?: number;
  pricing?: { prompt?: number | string; input?: number | string };
  [key: string]: unknown;
}

const REASONING_REGEX =
  /(?:^|[-_/:])(?:r1|o1|o3|o4|qwq|qvq|marco-o1|skywork-o1)(?:$|[-_/:])|deepseek-r1|claude-3[.-]7-sonnet|gemini-2[.-](?:0|5)-flash-thinking|gemini-thinking|think(?:ing)?|reason(?:ing|er)?|deepthink/i;

const VISION_REGEX =
  /(?:^|[-_/:])(?:vision|vl|multimodal)(?:$|[-_/:])|qwen.*vl|minicpm.*v|internvl|deepseek-vl|cogvlm|ovis|pixtral|llava|llama-3\.2-(?:11b|90b)|grok-2-vision|grok-vision|mimo-v2\.[56]/i;

const CODE_REGEX =
  /(?:code|coder|codex|devstral|deepseek-coder|qwen.*coder|codellama|wizardcoder|starcoder|codestral)/i;

const IMAGE_GEN_REGEX =
  /(?:dall-e|dalle|flux|sdxl|stable-diffusion|imagen|midjourney|recraft|ideogram|playground-v2|aurora|lumina|kolors)/i;

const AUDIO_REGEX =
  /(?:whisper|audio|speech|tts|elevenlabs|orpheus|bark|voice|music|chatter)/i;

const VIDEO_REGEX =
  /(?:sora|kling|runway|luma|cogvideo|veo|seedance|hailuo|wan-2\.1|minimax-video)/i;

const EMBEDDING_REGEX =
  /(?:embed|embedding|bge-|nomic-embed|text-embedding|jina-embed|voyage-|e5-|instructor-|colbert)/i;

const SEARCH_REGEX =
  /(?:search|perplexity|sonar|online|web-search|browsing|grounding)/i;

/**
 * Normalizes input model data and returns a rich breakdown of detected capabilities.
 */
export function detectModelCapabilities(model: ModelCapabilityInput): DetectedModelCapabilities {
  const rawId = model.id || model.modelId || model.name || "";
  const mid = String(rawId).toLowerCase();
  const nameLower = String(model.name || model.modelName || "").toLowerCase();

  const capsSet = new Set<string>();

  // Collect explicit capability strings from array or object
  if (Array.isArray(model.capabilities)) {
    for (const c of model.capabilities) {
      if (typeof c === "string") capsSet.add(c.toLowerCase().trim());
    }
  } else if (model.capabilities && typeof model.capabilities === "object") {
    for (const [key, val] of Object.entries(model.capabilities)) {
      if (val === true) capsSet.add(key.toLowerCase().trim());
    }
  }

  // Collect categories
  if (Array.isArray(model.categories)) {
    for (const cat of model.categories) {
      if (typeof cat === "string") capsSet.add(cat.toLowerCase().trim());
    }
  }

  // Collect peer categories
  if (Array.isArray(model.peers)) {
    for (const peer of model.peers) {
      if (Array.isArray(peer?.categories)) {
        for (const cat of peer.categories) {
          if (typeof cat === "string") capsSet.add(cat.toLowerCase().trim());
        }
      }
    }
  }

  const endpoints = new Set(
    (model.supportedEndpoints ?? []).map((e) => String(e).toLowerCase().trim())
  );

  // 1. Vision Detection
  const hasVision =
    model.supportsVision === true ||
    isVisionModelId(mid) ||
    isVisionModelId(nameLower) ||
    VISION_REGEX.test(mid) ||
    VISION_REGEX.test(nameLower) ||
    capsSet.has("vision") ||
    capsSet.has("image") ||
    capsSet.has("images") ||
    capsSet.has("multimodal") ||
    (endpoints.has("images") && !IMAGE_GEN_REGEX.test(mid));

  // 2. Reasoning / Thinking Detection
  const hasReasoning =
    model.reasoning === true ||
    Boolean(model.supportsThinking) ||
    Boolean(model.alwaysThinking) ||
    capsSet.has("reasoning") ||
    capsSet.has("thinking") ||
    capsSet.has("thought") ||
    capsSet.has("logic") ||
    capsSet.has("cot") ||
    REASONING_REGEX.test(mid) ||
    REASONING_REGEX.test(nameLower);

  // 3. Code Detection
  const hasCode =
    capsSet.has("code") ||
    capsSet.has("coding") ||
    CODE_REGEX.test(mid) ||
    CODE_REGEX.test(nameLower);

  // 4. Image Generation Detection
  const hasImageGen =
    capsSet.has("image_gen") ||
    capsSet.has("text-to-image") ||
    capsSet.has("image-to-image") ||
    capsSet.has("diffusion") ||
    endpoints.has("images-generations") ||
    IMAGE_GEN_REGEX.test(mid) ||
    IMAGE_GEN_REGEX.test(nameLower);

  // 5. Audio / Speech Detection
  const hasAudio =
    capsSet.has("audio") ||
    capsSet.has("stt") ||
    capsSet.has("tts") ||
    capsSet.has("speech") ||
    capsSet.has("voice") ||
    endpoints.has("audio-speech") ||
    endpoints.has("audio-transcriptions") ||
    Array.from(endpoints).some((e) => e.startsWith("audio")) ||
    AUDIO_REGEX.test(mid) ||
    AUDIO_REGEX.test(nameLower);

  // 6. Video Detection
  const hasVideo =
    capsSet.has("video") ||
    capsSet.has("video_gen") ||
    endpoints.has("videos") ||
    endpoints.has("video") ||
    VIDEO_REGEX.test(mid) ||
    VIDEO_REGEX.test(nameLower);

  // 7. Embedding Detection
  const hasEmbedding =
    capsSet.has("embedding") ||
    capsSet.has("embeddings") ||
    endpoints.has("embeddings") ||
    EMBEDDING_REGEX.test(mid) ||
    EMBEDDING_REGEX.test(nameLower);

  // 8. Search Detection
  const hasSearch =
    capsSet.has("search") ||
    capsSet.has("web_search") ||
    capsSet.has("browsing") ||
    capsSet.has("grounding") ||
    endpoints.has("search") ||
    SEARCH_REGEX.test(mid) ||
    SEARCH_REGEX.test(nameLower);

  // 9. Tools Detection
  const hasTools =
    capsSet.has("tools") ||
    capsSet.has("tool_use") ||
    capsSet.has("function_calling") ||
    endpoints.has("tools") ||
    (!hasEmbedding && !mid.includes("rerank"));

  // 10. Chat / Text Detection
  const isPureSpecialty =
    hasEmbedding ||
    mid.includes("rerank") ||
    (hasAudio && (mid.includes("whisper") || mid.includes("transcription"))) ||
    (hasImageGen && !hasVision && !mid.includes("chat"));

  const hasChat =
    capsSet.has("chat") ||
    capsSet.has("text") ||
    endpoints.has("chat") ||
    endpoints.has("responses") ||
    !isPureSpecialty;

  // Build canonical capabilities list
  const finalCaps = new Set<string>();
  if (hasChat) finalCaps.add("chat");
  if (hasCode) finalCaps.add("coding");
  if (hasVision) finalCaps.add("vision");
  if (hasReasoning) finalCaps.add("reasoning");
  if (hasImageGen) finalCaps.add("image_gen");
  if (hasVideo) finalCaps.add("video");
  if (hasAudio) finalCaps.add("audio");
  if (hasSearch) finalCaps.add("search");
  if (hasEmbedding) finalCaps.add("embedding");
  if (hasTools) finalCaps.add("tool_use");

  // Keep any existing custom caps that were explicitly set
  for (const c of capsSet) {
    finalCaps.add(c);
  }

  // Free detection
  let isFree = model.isFree === true;
  if (
    isFree ||
    mid.includes("free") ||
    model.cost === 0 ||
    (model.pricing && (Number(model.pricing.prompt) === 0 || Number(model.pricing.input) === 0))
  ) {
    isFree = true;
    finalCaps.add("free");
  }

  return {
    hasChat,
    hasCode,
    hasVision,
    hasReasoning,
    hasImageGen,
    hasVideo,
    hasSearch,
    hasAudio,
    hasEmbedding,
    hasTools,
    isFree,
    capabilities: Array.from(finalCaps),
  };
}
