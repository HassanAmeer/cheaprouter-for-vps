// @vitest-environment jsdom
//
// The "Default Capabilities Prompt" sheet tells the operator: "this payload is
// sent upstream" when a model row is tested. Before the fix the operator's own
// text was silently dropped for every capability except text/embedding — the
// code/reasoning/search probes always sent the built-in preset instead.
//
// These tests pin the contract:
//   - the operator's prompt is used for the text-ish capabilities,
//   - media probes (vision / image / video / audio / OCR) keep their preset,
//     because their payload must carry a media URL.
import { describe, it, expect } from "vitest";
import { getPromptForCapability } from "../DefaultCapabilitiesPromptModal";

describe("getPromptForCapability", () => {
  it("uses the operator's prompt for the default text probe", () => {
    expect(getPromptForCapability("text", "my own payload")).toBe("my own payload");
  });

  it("uses the operator's prompt for code, reasoning and search probes", () => {
    expect(getPromptForCapability("code", "write a haiku about routers")).toBe(
      "write a haiku about routers"
    );
    expect(getPromptForCapability("reasoning", "2+2?")).toBe("2+2?");
    expect(getPromptForCapability("search", "latest cheaproute release")).toBe(
      "latest cheaproute release"
    );
    expect(getPromptForCapability("embedding", "embed me")).toBe("embed me");
  });

  it("keeps the media preset for probes that need a URL", () => {
    const vision = getPromptForCapability("vision", "my own payload");
    expect(vision).not.toBe("my own payload");
    expect(vision).toMatch(/http/);

    const image = getPromptForCapability("image", "my own payload");
    expect(image).not.toBe("my own payload");

    const ocr = getPromptForCapability("ocr", "my own payload");
    expect(ocr).not.toBe("my own payload");
    expect(ocr).toMatch(/http/);
  });

  it("falls back to the built-in preset when the operator typed nothing", () => {
    const text = getPromptForCapability("text");
    expect(text.length).toBeGreaterThan(0);
    const code = getPromptForCapability("code");
    expect(code.length).toBeGreaterThan(0);
  });
});
