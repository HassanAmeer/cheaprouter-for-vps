// @vitest-environment jsdom
//
// The provider table used to render NAME-HEURISTIC capability badges (a model
// called "*-vl" was assumed to see images) and an empty context column.
//
// These tests pin the new contract:
//  - the server-resolved facts win over the name heuristic,
//  - a heuristic answer is only used for what no source knows,
//  - such rows are reported as inferred so the UI can say so.
import { describe, it, expect } from "vitest";
import { resolveRowCapabilities } from "../AvailableModelsTable";
import type { ResolvedModelMetadata } from "@/shared/types/modelMetadata";

function resolved(partial: Partial<ResolvedModelMetadata>): ResolvedModelMetadata {
  return {
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    capabilities: {
      vision: null,
      reasoning: null,
      tools: null,
      audio: null,
      video: null,
      attachment: null,
      structuredOutput: null,
      modalitiesInput: [],
      modalitiesOutput: [],
    },
    contextSource: "none",
    capabilitySource: "none",
    meta: {
      family: null,
      status: null,
      openWeights: null,
      knowledgeCutoff: null,
      releaseDate: null,
    },
    ...partial,
  };
}

describe("resolveRowCapabilities", () => {
  it("prefers the measured capability over the name heuristic", () => {
    // The name says "vl" (heuristic → vision) but the measured source says no.
    const { caps, inferred } = resolveRowCapabilities(
      { id: "acme/model-vl-mini" },
      resolved({
        capabilities: {
          vision: false,
          reasoning: false,
          tools: true,
          audio: null,
          video: null,
          attachment: null,
          structuredOutput: null,
          modalitiesInput: ["text"],
          modalitiesOutput: ["text"],
        },
        capabilitySource: "models.dev",
      })
    );

    expect(caps.hasVision).toBe(false);
    expect(caps.hasTools).toBe(true);
    expect(inferred).toBe(false);
  });

  it("uses the measured modalities for embedding models", () => {
    const { caps } = resolveRowCapabilities(
      { id: "acme/embed-small" },
      resolved({
        capabilities: {
          vision: null,
          reasoning: false,
          tools: null,
          audio: null,
          video: null,
          attachment: null,
          structuredOutput: null,
          modalitiesInput: ["text"],
          modalitiesOutput: ["embeddings"],
        },
        capabilitySource: "models.dev",
      })
    );

    expect(caps.hasEmbedding).toBe(true);
    expect(caps.hasChat).toBe(false);
  });

  it("falls back to the heuristic and flags the row as inferred", () => {
    const { caps, inferred } = resolveRowCapabilities({ id: "acme/deepseek-r1" }, resolved({}));

    // The heuristic still answers, but the row is marked as not measured.
    expect(caps.hasReasoning).toBe(true);
    expect(inferred).toBe(true);
  });

  it("marks every row inferred when the server has no opinion", () => {
    const { inferred } = resolveRowCapabilities({ id: "acme/whatever" }, undefined);
    expect(inferred).toBe(true);
  });

  it("does not mark a fully measured row as inferred", () => {
    const { inferred } = resolveRowCapabilities(
      { id: "acme/plain-chat" },
      resolved({
        capabilities: {
          vision: false,
          reasoning: false,
          tools: true,
          audio: false,
          video: false,
          attachment: null,
          structuredOutput: false,
          modalitiesInput: ["text"],
          modalitiesOutput: ["text"],
        },
        capabilitySource: "live",
      })
    );

    expect(inferred).toBe(false);
  });
});
