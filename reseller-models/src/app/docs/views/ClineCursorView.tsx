"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { Layers, Sparkles } from 'lucide-react';

export default function ClineCursorView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBase}/v1`;

  const steps = [
    {
      stepNumber: 1,
      title: "Configure Cline / Roo-Code in VS Code",
      description: "Open the Cline extension settings in VS Code. Under 'API Provider', select 'OpenAI Compatible' and provide the following configuration:",
      codeSnippet: {
        lang: "json",
        code: `{
  "apiProvider": "openai-compatible",
  "openAiBaseUrl": "${endpoint}",
  "openAiApiKey": "cr-live-your_api_key_here",
  "openAiModelId": "claude-3-5-sonnet"
}`,
        title: "Cline Extension Settings"
      },
      note: "You can type any model identifier supported by CheapRouter into the Model ID field (e.g. claude-3-5-sonnet, gpt-4o, deepseek-chat)."
    },
    {
      stepNumber: 2,
      title: "Configure Cursor IDE",
      description: "In Cursor, open Settings -> Models. Toggle on 'OpenAI API Key' override and enter your CheapRouter key and custom Base URL:",
      codeSnippet: {
        lang: "text",
        code: `OpenAI Base URL: ${endpoint}
OpenAI API Key:  cr-live-your_api_key_here

Custom Models to add:
- claude-3-5-sonnet
- gpt-4o
- deepseek-chat
- qwen2.5-coder-32b`,
        title: "Cursor Settings > Models"
      }
    },
    {
      stepNumber: 3,
      title: "Start Pair Programming with Agent",
      description: "Hit Cmd/Ctrl + L in Cursor or click the Cline sidebar icon. Your agent will have full codebase context and will execute edits and terminal tasks through CheapRouter seamlessly.",
      codeSnippet: {
        lang: "text",
        code: `Prompt example:
"Analyze the repository dependencies, detect unused packages, and run tests after cleanup."`,
        title: "Agent Command"
      }
    }
  ];

  const gotchas = [
    "Context Window Size: Make sure to select models with large context windows (like Claude 3.5 Sonnet 200k or Gemini 1.5/2.0 Flash 1M) when working with large repositories in Cline or Cursor.",
    "Streaming Requirement: Cline and Cursor rely on real-time SSE streaming. CheapRouter automatically proxies SSE chunks with zero latency buffering."
  ];

  return (
    <GuideTemplate
      badge="IDE Connectors"
      badgeColor="#a855f7"
      title="Cline, Roo-Code & Cursor Setup"
      subtitle="Connect powerful IDE agents directly to CheapRouter for in-editor autonomous coding, refactoring, and multi-file code generation."
      icon={<Layers size={14} />}
      baseUrl={cleanBase}
      apiPath="/v1"
      quickConfigNotice="Select 'OpenAI Compatible' in extension settings"
      compatibility={[
        { name: 'VS Code Extension', supported: true, note: 'Tested with Cline and Roo-Code' },
        { name: 'Cursor IDE', supported: true, note: 'Direct OpenAI baseURL override' },
        { name: 'Diff & Multi-file Apply', supported: true, note: 'Supports search/replace and unified diffs' },
        { name: 'Terminal Execution', supported: true, note: 'Full agent tool calling support' }
      ]}
      steps={steps}
      recommendedModels={[
        'claude-3-5-sonnet',
        'gpt-4o',
        'deepseek-chat',
        'gemini-2.0-flash'
      ]}
      gotchas={gotchas}
    />
  );
}
