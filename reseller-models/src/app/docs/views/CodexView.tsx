"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { Terminal, Code2 } from 'lucide-react';

export default function CodexView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBase}/v1`;

  const osCommands = {
    macos: `# 1. Export standard OpenAI variables
export OPENAI_BASE_URL="${endpoint}"
export OPENAI_API_KEY="cr-live-your_api_key_here"

# 2. Run Codex or OpenCode CLI
codex "Refactor the authentication middleware to use JWT"`,
    linux: `# 1. Export in current bash shell
export OPENAI_BASE_URL="${endpoint}"
export OPENAI_API_KEY="cr-live-your_api_key_here"

# 2. Start codex prompt
codex --model gpt-4o`,
    windows: `# 1. Set environment variables in PowerShell
$env:OPENAI_BASE_URL = "${endpoint}"
$env:OPENAI_API_KEY = "cr-live-your_api_key_here"

# 2. Launch Codex
codex`
  };

  const steps = [
    {
      stepNumber: 1,
      title: "Configure Codex Provider Configuration",
      description: "Codex CLI and OpenCode support standard OpenAI-compatible endpoints. Create or update your ~/.codex/config.json with CheapRouter settings:",
      codeSnippet: {
        lang: "json",
        code: `{
  "model_provider": "cheaprouter",
  "providers": {
    "cheaprouter": {
      "base_url": "${endpoint}",
      "api_key": "cr-live-your_api_key_here",
      "models": [
        "gpt-4o",
        "claude-3-5-sonnet",
        "deepseek-chat",
        "qwen2.5-coder-32b"
      ]
    }
  }
}`,
        title: "~/.codex/config.json"
      }
    },
    {
      stepNumber: 2,
      title: "Set Default Model",
      description: "You can specify your favorite coding model either via config or with the --model CLI flag:",
      codeSnippet: {
        lang: "bash",
        code: `codex --model deepseek-chat "Write unit tests for src/api/users.ts"`,
        title: "CLI Command"
      }
    },
    {
      stepNumber: 3,
      title: "Interactive Coding Session",
      description: "Start an interactive REPL mode where Codex can explore your codebase, inspect files, and propose diffs:",
      codeSnippet: {
        lang: "bash",
        code: `codex repl`,
        title: "Interactive REPL"
      }
    }
  ];

  const gotchas = [
    "OpenAI Spec Compliance: Codex strictly expects OpenAI-format responses with usage token counts. CheapRouter normalizes all model outputs to guarantee 100% compliance.",
    "Tool Approvals: You can configure auto-approval flags for non-destructive read operations to speed up Codex codebase exploration."
  ];

  return (
    <GuideTemplate
      badge="Coding CLI"
      badgeColor="#3b82f6"
      title="Codex CLI & OpenCode Integration"
      subtitle="Run autonomous terminal coding assistants powered by CheapRouter with high-speed tool calls, diff generation, and multi-model failover."
      icon={<Terminal size={14} />}
      baseUrl={cleanBase}
      apiPath="/v1"
      quickConfigNotice="OpenAI-compatible /v1 endpoint"
      compatibility={[
        { name: 'OpenAI Spec Compliance', supported: true, note: 'Standard chat/completions schema' },
        { name: 'Tool & File Ops', supported: true, note: 'Inspects AST, writes and applies diffs' },
        { name: 'Streaming Buffering', supported: true, note: 'Instant real-time token rendering' },
        { name: 'Token Usage Tracking', supported: true, note: 'Reports exact prompt/completion token usage' }
      ]}
      osCommands={osCommands}
      steps={steps}
      recommendedModels={[
        'gpt-4o',
        'claude-3-5-sonnet',
        'deepseek-chat',
        'qwen2.5-coder-32b'
      ]}
      gotchas={gotchas}
    />
  );
}
