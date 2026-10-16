"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { MessageSquare, Heart } from 'lucide-react';

export default function SillyTavernView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBase}/v1`;

  const steps = [
    {
      stepNumber: 1,
      title: "Configure SillyTavern",
      description: "In SillyTavern, click on the API Connections (plug icon) panel at the top. Under 'API', select 'Chat Completion' and choose 'OpenAI' as the main source:",
      codeSnippet: {
        lang: "text",
        code: `API: Chat Completion
Source: Custom (OpenAI-compatible)
Server URL: ${endpoint}
API Key: cr-live-your_api_key_here`,
        title: "SillyTavern API Settings"
      },
      note: "Click 'Connect' or 'Test Connection' to fetch the real-time list of available models from CheapRouter."
    },
    {
      stepNumber: 2,
      title: "Configure LibreChat",
      description: "If you run LibreChat via Docker or Node, add CheapRouter as a custom endpoint in your librechat.yaml file:",
      codeSnippet: {
        lang: "yaml",
        code: `endpoints:
  custom:
    - name: "CheapRouter"
      apiKey: "cr-live-your_api_key_here"
      baseURL: "${endpoint}"
      models:
        default: ["claude-3-5-sonnet", "gpt-4o", "deepseek-chat"]
        fetch: true
      titleConvo: true
      modelDisplayLabel: "CheapRouter"`,
        title: "librechat.yaml"
      }
    },
    {
      stepNumber: 3,
      title: "Select Context Size & Model",
      description: "Select your desired character card or system prompt and pick high-context models like Claude 3.5 Sonnet (200k) or DeepSeek V3 for deep conversational memory.",
      codeSnippet: {
        lang: "text",
        code: `Recommended Settings:
- Context Length: 16k - 64k tokens
- Temperature: 0.7 - 0.9
- Top P: 0.95`,
        title: "Parameters"
      }
    }
  ];

  return (
    <GuideTemplate
      badge="Chat Apps"
      badgeColor="#ec4899"
      title="SillyTavern & LibreChat Connectors"
      subtitle="Connect popular desktop and self-hosted chat interfaces to CheapRouter with unified billing, streaming, and full character support."
      icon={<MessageSquare size={14} />}
      baseUrl={cleanBase}
      apiPath="/v1"
      quickConfigNotice="Select 'Custom (OpenAI-compatible)' in connection settings"
      compatibility={[
        { name: 'SillyTavern Native', supported: true, note: 'Chat completion custom endpoint' },
        { name: 'LibreChat Endpoint', supported: true, note: 'Custom endpoint in librechat.yaml' },
        { name: 'Personas & Lorebooks', supported: true, note: 'Full system & character prompt injection' },
        { name: 'SSE Streaming', supported: true, note: 'Instant character typing effect' }
      ]}
      steps={steps}
      recommendedModels={[
        'claude-3-5-sonnet',
        'deepseek-chat',
        'gpt-4o',
        'gemini-2.0-flash'
      ]}
    />
  );
}
