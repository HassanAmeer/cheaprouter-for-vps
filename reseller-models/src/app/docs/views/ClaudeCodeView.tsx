"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { Bot, Terminal } from 'lucide-react';

export default function ClaudeCodeView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');

  const osCommands = {
    macos: `# 1. Install Claude Code globally (requires Node 18+)
npm install -g @anthropic-ai/claude-code

# 2. Export environment variables to point to CheapRouter
export ANTHROPIC_BASE_URL="${cleanBase}"
export ANTHROPIC_API_KEY="cr-live-your_api_key_here"
export MAX_THINKING_TOKENS="0"
export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS="1"

# 3. Launch Claude Code in your project directory
claude`,
    linux: `# 1. Install Claude Code
npm install -g @anthropic-ai/claude-code

# 2. Add variables to ~/.bashrc or export in session
export ANTHROPIC_BASE_URL="${cleanBase}"
export ANTHROPIC_API_KEY="cr-live-your_api_key_here"
export MAX_THINKING_TOKENS="0"
export CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS="1"

# 3. Start coding agent
claude`,
    windows: `# 1. Install Claude Code via PowerShell or Git Bash
npm install -g @anthropic-ai/claude-code

# 2. Set environment variables in current PowerShell session
$env:ANTHROPIC_BASE_URL = "${cleanBase}"
$env:ANTHROPIC_API_KEY = "cr-live-your_api_key_here"
$env:MAX_THINKING_TOKENS = "0"
$env:CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS = "1"

# 3. Run Claude
claude`
  };

  const steps = [
    {
      stepNumber: 1,
      title: "Install Claude Code CLI",
      description: "Ensure you have Node.js 18 or newer installed on your machine. Install Anthropic's official terminal coding agent via npm:",
      codeSnippet: {
        lang: "bash",
        code: "npm install -g @anthropic-ai/claude-code",
        title: "Terminal Command"
      }
    },
    {
      stepNumber: 2,
      title: "Configure Persistent Global Settings (Recommended)",
      description: "Instead of exporting variables every time you open a terminal, you can save them to ~/.claude/settings.json (or %APPDATA%\\claude\\settings.json on Windows):",
      codeSnippet: {
        lang: "json",
        code: `{
  "env": {
    "ANTHROPIC_BASE_URL": "${cleanBase}",
    "ANTHROPIC_API_KEY": "cr-live-your_api_key_here",
    "MAX_THINKING_TOKENS": "0",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}`,
        title: "~/.claude/settings.json"
      },
      note: "Setting MAX_THINKING_TOKENS to 0 and disabling experimental betas prevents unsupported upstream parameter errors when routing to non-Anthropic models."
    },
    {
      stepNumber: 3,
      title: "Launch & Code Autonomously",
      description: "Navigate to any Git repository or project directory and launch Claude Code. It will read your code, run tests, create git commits, and execute bash commands powered by CheapRouter:",
      codeSnippet: {
        lang: "bash",
        code: `cd /path/to/my-project
claude`,
        title: "Start Agent"
      }
    }
  ];

  const gotchas = [
    "Thinking Tokens: When using Claude 3.7 or Sonnet models through a gateway, ensure MAX_THINKING_TOKENS=\"0\" is set if your upstream provider does not support reasoning budgets.",
    "Stream Keepalive: CheapRouter automatically injects SSE keepalive comments (: keepalive) every 15 seconds to prevent Cloudflare 524 gateway timeouts on long reasoning turns.",
    "Cost Efficiency: You can route Claude Code to cost-effective models like DeepSeek V3, Qwen 2.5 Coder, or Claude 3.5 Haiku at a fraction of standard Anthropic rates."
  ];

  return (
    <GuideTemplate
      badge="Coding Agent"
      badgeColor="#ff5f56"
      title="Claude Code Integration"
      subtitle="Connect Anthropic's official terminal agent to CheapRouter with access to Claude 3.5 Sonnet, DeepSeek V3, and 200+ models using a single API key."
      icon={<Bot size={14} />}
      baseUrl={cleanBase}
      apiPath=""
      quickConfigNotice="Point ANTHROPIC_BASE_URL directly to CheapRouter"
      compatibility={[
        { name: 'Agentic Tool Calling', supported: true, note: 'Runs bash commands, reads and edits files' },
        { name: 'Streaming SSE', supported: true, note: 'Instant live character streaming' },
        { name: 'Git & Terminal Context', supported: true, note: 'Reads branch diffs and repository status' },
        { name: 'Model Switching', supported: true, note: 'Switch between Claude, DeepSeek, and GPT models seamlessly' }
      ]}
      osCommands={osCommands}
      steps={steps}
      recommendedModels={[
        'claude-3-5-sonnet',
        'claude-3-7-sonnet',
        'deepseek-chat',
        'qwen2.5-coder-32b',
        'gpt-4o'
      ]}
      gotchas={gotchas}
    />
  );
}
