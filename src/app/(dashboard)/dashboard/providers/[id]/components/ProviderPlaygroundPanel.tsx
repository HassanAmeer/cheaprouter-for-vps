"use client";

// Phase 1g extraction — Issue #3501
// Renders a playground section on the individual provider page.
// Shows ServiceKindTabs if the provider declares multiple kinds; falls back to
// a single-kind panel or the LlmChatCard for standard LLM providers.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LlmChatCard } from "@/shared/components/media-playground/LlmChatCard";
import { ServiceKindTabs } from "@/shared/components/media-playground/ServiceKindTabs";
import { EmbeddingExampleCard } from "@/shared/components/media-playground/EmbeddingExampleCard";
import { ImageExampleCard } from "@/shared/components/media-playground/ImageExampleCard";
import { TtsExampleCard } from "@/shared/components/media-playground/TtsExampleCard";
import { SttExampleCard } from "@/shared/components/media-playground/SttExampleCard";
import { WebSearchExampleCard } from "@/shared/components/media-playground/WebSearchExampleCard";
import { WebFetchExampleCard } from "@/shared/components/media-playground/WebFetchExampleCard";
import { VideoExampleCard } from "@/shared/components/media-playground/VideoExampleCard";
import { MusicExampleCard } from "@/shared/components/media-playground/MusicExampleCard";
import type { ServiceKind } from "@/shared/constants/providers";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { providerText } from "../providerPageHelpers";

export const MEDIA_SERVICE_KINDS: ServiceKind[] = [
  "embedding",
  "image",
  "tts",
  "stt",
  "webSearch",
  "webFetch",
  "video",
  "music",
];

export function renderKindPanel(kind: ServiceKind, providerId: string): JSX.Element | null {
  switch (kind) {
    case "llm":
      return <LlmChatCard providerId={providerId} />;
    case "embedding":
      return <EmbeddingExampleCard providerId={providerId} />;
    case "image":
      return <ImageExampleCard providerId={providerId} />;
    case "tts":
      return <TtsExampleCard providerId={providerId} />;
    case "stt":
      return <SttExampleCard providerId={providerId} />;
    case "webSearch":
      return <WebSearchExampleCard providerId={providerId} />;
    case "webFetch":
      return <WebFetchExampleCard providerId={providerId} />;
    case "video":
      return <VideoExampleCard providerId={providerId} />;
    case "music":
      return <MusicExampleCard providerId={providerId} />;
    default:
      return null;
  }
}

export default function ProviderPlaygroundPanel({ providerId }: { providerId: string }) {
  const t = useTranslations("providers");
  // Resolve serviceKinds from AI_PROVIDERS.
  // For providers without explicit serviceKinds (most LLM providers), we infer
  // "llm" as the default.
  const providerEntry = AI_PROVIDERS[providerId as keyof typeof AI_PROVIDERS] as
    (Record<string, unknown> & { serviceKinds?: string[] }) | undefined;

  const rawKinds: string[] = providerEntry?.serviceKinds ?? [];

  const ALL_VALID_KINDS = [
    "llm",
    "embedding",
    "image",
    "imageToText",
    "tts",
    "stt",
    "webSearch",
    "webFetch",
    "video",
    "music",
  ] as const;

  const kinds: ServiceKind[] =
    rawKinds.length > 0
      ? rawKinds.filter((k): k is ServiceKind => (ALL_VALID_KINDS as readonly string[]).includes(k))
      : ["llm"];

  // Filter out kinds that have no playground implementation yet
  const playgroundableKinds = kinds.filter((k) => k !== "imageToText");

  // useState must be called unconditionally (Rules of Hooks)
  const [activeKind, setActiveKind] = useState<ServiceKind>(playgroundableKinds[0] ?? "llm");

  if (playgroundableKinds.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{providerText(t, "playgroundTitle", "Playground")}</h2>
      <ServiceKindTabs
        kinds={playgroundableKinds}
        activeKind={activeKind}
        onSelect={setActiveKind}
      />
      {renderKindPanel(activeKind, providerId)}
    </div>
  );
}
