import re
import sys
import os

base_dir = "/home/hasan/Documents/reactjs/cheaprouter"

def patch_file(filepath, search_str, replace_str, description):
    full_path = os.path.join(base_dir, filepath)
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if search_str not in content:
        print(f"[FAIL] Could not find target in {filepath}: {description}")
        return False
    
    new_content = content.replace(search_str, replace_str, 1)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"[OK] Patched {filepath}: {description}")
    return True

successes = 0

# --- FIX 1: models/test-all/route.ts (Persist batch test results to db) ---
f1_search = """import { setModelIsHidden } from "@/lib/db/models";
import { sanitizeErrorMessage } from "@cheaproute/open-sse/utils/error";"""
f1_replace = """import { setModelIsHidden } from "@/lib/db/models";
import { upsertCustomization } from "@/lib/db/providerModelCustomizations";
import { sanitizeErrorMessage } from "@cheaproute/open-sse/utils/error";"""

if patch_file("src/app/api/models/test-all/route.ts", f1_search, f1_replace, "Import upsertCustomization"):
    f1_loop_search = """    results[modelId] = entry;
    log.info(
      "MODEL_TEST_ALL","""
    f1_loop_replace = """    results[modelId] = entry;
    if (!entry.skipped) {
      try {
        const isOk = entry.status === "ok";
        upsertCustomization({
          providerId,
          originalModelId: modelId,
          isTested: true,
          testStatus: isOk ? "verified" : "failed",
          testHttpStatus: entry.statusCode ?? (isOk ? 200 : 500),
          testLatencyMs: entry.latencyMs,
          testResponse:
            (typeof entry.responseText === "string" ? entry.responseText.slice(0, 500) : null) ||
            (typeof entry.error === "string" ? entry.error.slice(0, 500) : null),
        });
      } catch (custErr) {
        log.warn("MODEL_TEST_ALL", `Failed to persist customization for ${modelId}: ${custErr}`);
      }
    }
    log.info(
      "MODEL_TEST_ALL","""
    if patch_file("src/app/api/models/test-all/route.ts", f1_loop_search, f1_loop_replace, "Persist test results via upsertCustomization"):
        successes += 1

# --- FIX 2: provider-models/route.ts (Support isFree in PATCH) ---
f2_search = """    if (typeof body.isHidden !== "boolean") {
      return Response.json(
        { error: { message: "isHidden boolean is required", type: "validation_error" } },
        { status: 400 }
      );
    }"""
f2_replace = """    const hasIsHidden = typeof body.isHidden === "boolean";
    const hasIsFree = typeof body.isFree === "boolean" || typeof body.isFreeOverride === "boolean";
    if (!hasIsHidden && !hasIsFree) {
      return Response.json(
        { error: { message: "Either isHidden or isFree boolean is required", type: "validation_error" } },
        { status: 400 }
      );
    }"""

if patch_file("src/app/api/provider-models/route.ts", f2_search, f2_replace, "Allow isFree in PATCH"):
    f2_loop_search = """    for (const modelId of modelIds) {
      const updatedModel = await updateCustomModel(provider, modelId, { isHidden: body.isHidden });
      if (!updatedModel) {
        mergeModelCompatOverride(provider, modelId, { isHidden: body.isHidden, modality });
      }
    }"""
    f2_loop_replace = """    for (const modelId of modelIds) {
      if (hasIsHidden) {
        const updatedModel = await updateCustomModel(provider, modelId, { isHidden: body.isHidden });
        if (!updatedModel) {
          mergeModelCompatOverride(provider, modelId, { isHidden: body.isHidden, modality });
        }
      }
      if (hasIsFree) {
        const isFreeVal = typeof body.isFree === "boolean" ? body.isFree : (body.isFreeOverride as boolean);
        try {
          const { upsertCustomization } = await import("@/lib/db/providerModelCustomizations");
          upsertCustomization({
            providerId: provider,
            originalModelId: modelId,
            isFreeOverride: isFreeVal,
          });
        } catch (e) {
          console.error(`Failed to update isFreeOverride for ${modelId}:`, e);
        }
        await updateCustomModel(provider, modelId, { isFree: isFreeVal } as any);
      }
    }"""
    if patch_file("src/app/api/provider-models/route.ts", f2_loop_search, f2_loop_replace, "Update isFree in provider models PATCH"):
        successes += 1

# --- FIX 3: AvailableModelsTable.tsx (Interactive Embedding Capability Button) ---
f3_search = """                        {caps.hasEmbedding && (
                          <span
                            title="Embedding: Vector semantic representations"
                            className="size-6 rounded-md bg-[#222224] text-[#8e8e93] border border-white/5 inline-flex items-center justify-center cursor-default"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              hub
                            </span>
                          </span>
                        )}"""
f3_replace = """                        {caps.hasEmbedding && (
                          <button
                            type="button"
                            onClick={() => handleSelectCapability(model.id, "embedding")}
                            title={`Embedding: Vector semantic representations (${
                              selectedCap === "embedding" ? "Active for test" : "Click to select for test"
                            })`}
                            className={`size-6 rounded-md text-[11px] font-medium transition-all duration-150 inline-flex items-center justify-center cursor-pointer ${
                              selectedCap === "embedding"
                                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-xs scale-105"
                                : "bg-[#222224] text-[#8e8e93] hover:text-white hover:bg-[#2c2c2e] border border-white/5 hover:border-white/20"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none">
                              hub
                            </span>
                          </button>
                        )}"""
if patch_file("src/app/(dashboard)/dashboard/providers/[id]/components/AvailableModelsTable.tsx", f3_search, f3_replace, "Interactive embedding capability button"):
    successes += 1

# --- FIX 4: images/generations/route.ts (Custom image models endpoint tags) ---
f4_search = """          if (!model?.id || !Array.isArray(model.supportedEndpoints)) continue;
          if (!model.supportedEndpoints.includes("images")) continue;
          const fullId = `${providerId}/${model.id}`;
          if (fullId === body.model) {
            provider = providerId;
            requestedModel = model.id;
            isCustomModel = true;
            break;
          }"""
f4_replace = """          if (!model?.id || !Array.isArray(model.supportedEndpoints)) continue;
          const isImageEndpoint =
            model.supportedEndpoints.includes("images") ||
            model.supportedEndpoints.includes("images-generations") ||
            model.supportedEndpoints.includes("image");
          if (!isImageEndpoint) continue;
          const fullId = `${providerId}/${model.id}`;
          const modelLower = body.model.toLowerCase();
          if (fullId.toLowerCase() === modelLower || model.id.toLowerCase() === modelLower) {
            provider = providerId;
            requestedModel = model.id;
            isCustomModel = true;
            break;
          }"""
if patch_file("src/app/api/v1/images/generations/route.ts", f4_search, f4_replace, "Custom image models endpoint tag check & casing"):
    successes += 1

# --- FIX 5: combos/invariants.ts (Add deepseek, qwen, gemma, o1, o3) ---
f5_search = """const FAMILY_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["gpt", /^gpt(?:-|$)/i],
  ["claude", /^claude(?:-|$)/i],
  ["gemini", /^gemini(?:-|$)/i],
  ["glm", /^glm(?:-|$)/i],
  ["kimi", /^kimi(?:-|$)/i],
  ["llama", /^llama(?:-|$)/i],
  ["minimax", /^minimax(?:-|$)/i],
  ["mistral", /^(?:mistral|mixtral)(?:-|$)/i],
];"""
f5_replace = """const FAMILY_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["gpt", /^gpt(?:-|$)/i],
  ["claude", /^claude(?:-|$)/i],
  ["gemini", /^gemini(?:-|$)/i],
  ["glm", /^glm(?:-|$)/i],
  ["kimi", /^kimi(?:-|$)/i],
  ["llama", /^llama(?:-|$)/i],
  ["minimax", /^minimax(?:-|$)/i],
  ["mistral", /^(?:mistral|mixtral)(?:-|$)/i],
  ["deepseek", /^deepseek(?:-|$)/i],
  ["qwen", /^qwen(?:-|$)/i],
  ["gemma", /^gemma(?:-|$)/i],
  ["o1", /^o1(?:-|$)/i],
  ["o3", /^o3(?:-|$)/i],
];"""
if patch_file("src/lib/combos/invariants.ts", f5_search, f5_replace, "Add modern families to FAMILY_PATTERNS"):
    successes += 1

# --- FIX 6: audio/transcriptions/route.ts (Validate audio file) ---
f6_search = """  const model = formData.get("model");
  if (!model) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }
  const modelStr = String(model);"""
f6_replace = """  const model = formData.get("model");
  if (!model) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");
  }
  const file = formData.get("file");
  if (!file) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing required parameter: 'file'");
  }
  const modelStr = String(model);"""
if patch_file("src/app/api/v1/audio/transcriptions/route.ts", f6_search, f6_replace, "Validate file in audio transcription"):
    successes += 1

# --- FIX 7: chat/completions/route.ts (Prevent double-release on structural admission rejection) ---
f7_search = """        if (structuralAdmission.admit === false) {
          void logAdmissionRejection(structuralAdmission.response, {
            path: new URL(request.url).pathname,
            model:
              typeof parsedBody?.model === "string" && parsedBody.model ? parsedBody.model : "-",
            requestBody: parsedBody ?? null,
            apiKeyId: null,
            apiKeyName: null,
            correlationId: resolveIncomingCorrelationId(request.headers.get("x-correlation-id")),
          });
          admission.lease?.release();
          return finishAdmission(structuralAdmission.response);
        }"""
f7_replace = """        if (structuralAdmission.admit === false) {
          void logAdmissionRejection(structuralAdmission.response, {
            path: new URL(request.url).pathname,
            model:
              typeof parsedBody?.model === "string" && parsedBody.model ? parsedBody.model : "-",
            requestBody: parsedBody ?? null,
            apiKeyId: null,
            apiKeyName: null,
            correlationId: resolveIncomingCorrelationId(request.headers.get("x-correlation-id")),
          });
          const leaseToRelease = admission.lease;
          admission.lease = null;
          leaseToRelease?.release();
          return structuralAdmission.response;
        }"""
if patch_file("src/app/api/v1/chat/completions/route.ts", f7_search, f7_replace, "Fix double lease release in chat completions"):
    successes += 1

# --- FIX 8: models/route.ts (Include custom models in /api/models candidates) ---
f8_search = """    // Filter before capability resolution so unavailable/paid rows cannot trigger
    // needless capability work. One request-local snapshot supplies all persisted
    // capability and custom-vision rows to the remaining resolutions.
    const candidates = AI_MODELS.filter((model: any) => {
      if (activeProviders && !activeProviders.has(model.provider)) return false;
      const canonicalKey = `${model.provider}::${model.model}`;
      if (inactiveCustomizationKeys.has(canonicalKey)) return false;
      return (
        !hidePaid ||
        (providerHasFreeModels(model.provider) && isFreeModel(model.provider, { id: model.model }))
      );
    });"""
f8_replace = """    // Merge custom models into candidates list
    let customModelCandidates: any[] = [];
    try {
      const { getAllCustomModels } = await import("@/lib/db/models");
      const customModelsMap = (await getAllCustomModels()) as Record<string, any>;
      for (const [providerId, models] of Object.entries(customModelsMap)) {
        if (!Array.isArray(models)) continue;
        for (const m of models) {
          if (!m?.id) continue;
          if (m.isHidden === true) continue;
          customModelCandidates.push({
            id: `${providerId}/${m.id}`,
            name: m.name || m.id,
            provider: providerId,
            model: m.id,
          });
        }
      }
    } catch {}

    const allModelCandidates = [...AI_MODELS, ...customModelCandidates];
    const seenFullIds = new Set<string>();
    const candidates = allModelCandidates.filter((model: any) => {
      const full = `${model.provider}/${model.model}`;
      if (seenFullIds.has(full)) return false;
      seenFullIds.add(full);
      if (activeProviders && !activeProviders.has(model.provider)) return false;
      const canonicalKey = `${model.provider}::${model.model}`;
      if (inactiveCustomizationKeys.has(canonicalKey)) return false;
      return (
        !hidePaid ||
        (providerHasFreeModels(model.provider) && isFreeModel(model.provider, { id: model.model }))
      );
    });"""
if patch_file("src/app/api/models/route.ts", f8_search, f8_replace, "Include custom models in /api/models"):
    successes += 1

# --- FIX 9: apiKeyPolicy.ts (Robust date parsing for expiresAt) ---
f9_search = """  if (apiKeyInfo.expiresAt && Date.now() > new Date(apiKeyInfo.expiresAt).getTime()) {
    return errorResponse(HTTP_STATUS.FORBIDDEN, "This API key has expired");
  }"""
f9_replace = """  if (apiKeyInfo.expiresAt) {
    const expiresTime = Date.parse(apiKeyInfo.expiresAt);
    if (Number.isFinite(expiresTime) && Date.now() > expiresTime) {
      return errorResponse(HTTP_STATUS.FORBIDDEN, "This API key has expired");
    }
  }"""
if patch_file("src/shared/utils/apiKeyPolicy.ts", f9_search, f9_replace, "Robust expiresAt date parsing"):
    successes += 1

# --- FIX 10: modelTestRunner.ts (TTS audio-speech probe support instead of skip) ---
f10_search = """  // Skip music/video/TTS generation models without interactive chat probe handlers
  if (isNonChatGeneration) {
    const desc = isAudioSpeech ? "audio-speech / TTS" : "music/video";
    return {
      modelId: fullModelStr,
      status: "error",
      latencyMs: 0,
      httpStatus: 422,
      error: `Skipped: non-chat generation model (${desc}) — use the corresponding generation endpoint instead`,
    };
  }"""
f10_replace = """  // Skip music/video generation models without interactive chat probe handlers
  if (isNonChatGeneration && !isAudioSpeech) {
    return {
      modelId: fullModelStr,
      status: "error",
      latencyMs: 0,
      httpStatus: 422,
      error: `Skipped: non-chat generation model (music/video) — use the corresponding generation endpoint instead`,
    };
  }"""
if patch_file("src/lib/api/modelTestRunner.ts", f10_search, f10_replace, "Allow audio-speech in modelTestRunner"):
    successes += 1

print(f"\nCompleted {successes}/10 fixes applied successfully.")
