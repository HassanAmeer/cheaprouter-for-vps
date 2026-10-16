"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { ShieldCheck, Activity, Terminal, Zap } from 'lucide-react';

export default function HarnessView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBase}/v1`;

  const steps = [
    {
      stepNumber: 1,
      title: "Streaming (SSE) Verification & Keepalive Heartbeat",
      description: "Terminal coding agents like Claude Code and Codex require continuous token streaming. Long reasoning queries can trigger proxy or Cloudflare 524 timeouts. CheapRouter's harness actively injects ': keepalive\\n\\n' SSE comments every 15 seconds to keep the pipe open.",
      codeSnippet: {
        lang: "bash",
        code: `curl -N -X POST "${endpoint}/chat/completions" \\
  -H "Authorization: Bearer cr-live-your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Explain binary search trees"}],
    "stream": true
  }'`,
        title: "Test Live Streaming"
      }
    },
    {
      stepNumber: 2,
      title: "Function & Tool Calling Verification",
      description: "Agents cannot edit files or run terminal commands without proper Tool / Function Calling support. CheapRouter's harness tests and ensures tools schema is correctly parsed and passed to the upstream provider:",
      codeSnippet: {
        lang: "json",
        code: `{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "What is the weather in Tokyo?"}],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather in location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": { "type": "string" }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}`,
        title: "Tool Calling Payload Test"
      }
    },
    {
      stepNumber: 3,
      title: "Automated Failover & Multi-Provider Redundancy",
      description: "If an upstream provider experiences a temporary 429 rate limit or 503 outage, CheapRouter's routing engine instantly and transparently switches to the next available healthy provider with zero dropped requests.",
      codeSnippet: {
        lang: "text",
        code: `Primary Provider (Direct) -> [429 Rate Limit Detected]
  -> Seamless Failover: Provider B (Backup Gateway) -> 200 OK Streamed
Client Agent Experience: 0 interruptions, 0 broken sessions.`,
        title: "Failover Flow"
      }
    }
  ];

  const gotchas = [
    "No-Drop History: Failed assistant turns are never recorded into state history to avoid corrupting agent context.",
    "Token Budgeting: Tokenizers are loaded for request budgeting and safety boundaries without slowing down production throughput."
  ];

  return (
    <GuideTemplate
      badge="E2E Harness"
      badgeColor="#10b981"
      title="Agent Test Harness & Reliability Engine"
      subtitle="How CheapRouter guarantees reliable streaming, tool calling validation, and zero-downtime failover for AI coding agents."
      icon={<Activity size={14} />}
      baseUrl={cleanBase}
      apiPath="/v1"
      quickConfigNotice="Built-in streaming heartbeat & tool calling validation"
      compatibility={[
        { name: 'SSE Keepalive Heartbeat', supported: true, note: '15s interval keeps connection alive' },
        { name: 'Tool & Function Calling', supported: true, note: 'End-to-end verified schemas' },
        { name: 'Auto Provider Failover', supported: true, note: 'Switches on 429/500 errors' },
        { name: 'High-Concurrency Testing', supported: true, note: 'Handles 100+ requests/sec smoothly' }
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
