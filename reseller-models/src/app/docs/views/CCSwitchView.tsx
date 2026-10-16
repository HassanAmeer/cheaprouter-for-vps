"use client";
import React from 'react';
import GuideTemplate from '../components/GuideTemplate';
import { Sliders, CheckCircle2 } from 'lucide-react';

export default function CCSwitchView({ baseUrl = 'https://api.cheaprouter.com' }: { baseUrl?: string }) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const endpoint = `${cleanBase}/v1`;

  const osCommands = {
    macos: `# 1. Install CC Switch via homebrew or npm
npm install -g cc-switch

# 2. Add CheapRouter profile
cc-switch profile add cheaprouter \\
  --endpoint "${cleanBase}" \\
  --key "cr-live-your_api_key_here"

# 3. Activate CheapRouter as your default CLI provider
cc-switch use cheaprouter`,
    linux: `# 1. Install CC Switch
npm install -g cc-switch

# 2. Add CheapRouter configuration
cc-switch profile add cheaprouter --endpoint "${cleanBase}" --key "cr-live-your_api_key_here"

# 3. Switch active profile
cc-switch use cheaprouter`,
    windows: `# 1. Install via npm in PowerShell
npm install -g cc-switch

# 2. Configure CheapRouter profile
cc-switch profile add cheaprouter --endpoint "${cleanBase}" --key "cr-live-your_api_key_here"

# 3. Set active
cc-switch use cheaprouter`
  };

  const steps = [
    {
      stepNumber: 1,
      title: "What is CC Switch?",
      description: "CC Switch is an open-source cross-platform CLI tool for managing provider configurations, MCP servers, and system prompts across Claude Code, Codex, and Gemini CLI. It allows one-click switching between different API providers.",
      codeSnippet: {
        lang: "bash",
        code: `npm install -g cc-switch`,
        title: "Installation"
      }
    },
    {
      stepNumber: 2,
      title: "Add CheapRouter Profile",
      description: "Register CheapRouter as a provider profile in CC Switch so all your terminal agents automatically inherit CheapRouter's Base URL and authentication key:",
      codeSnippet: {
        lang: "bash",
        code: `cc-switch profile add cheaprouter \\
  --endpoint "${cleanBase}" \\
  --key "cr-live-your_api_key_here"`,
        title: "Add Profile"
      }
    },
    {
      stepNumber: 3,
      title: "One-Click Activation",
      description: "Switch your entire environment to CheapRouter with a single command. Now when you run 'claude' or 'codex', it routes through CheapRouter with full cost optimization:",
      codeSnippet: {
        lang: "bash",
        code: `cc-switch use cheaprouter
# Check current active configuration
cc-switch status`,
        title: "Activate Profile"
      }
    }
  ];

  return (
    <GuideTemplate
      badge="Tooling"
      badgeColor="#f59e0b"
      title="CC Switch CLI Manager"
      subtitle="Easily manage and toggle provider configurations for Claude Code, Codex, and Gemini CLI with one-click profiles."
      icon={<Sliders size={14} />}
      baseUrl={cleanBase}
      apiPath=""
      quickConfigNotice="Manage multiple CLI tools with one unified profile"
      compatibility={[
        { name: 'Claude Code Switch', supported: true, note: 'Automatically configures ANTHROPIC_BASE_URL' },
        { name: 'Codex CLI Switch', supported: true, note: 'Configures OpenAI-compatible profile' },
        { name: 'Gemini CLI Switch', supported: true, note: 'Switches Google Gemini endpoints' },
        { name: 'MCP Server Management', supported: true, note: 'Syncs MCP tools across providers' }
      ]}
      osCommands={osCommands}
      steps={steps}
    />
  );
}
