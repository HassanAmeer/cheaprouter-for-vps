export interface GuideStepData {
  stepNumber: number;
  title: string;
  description: string;
  osCode?: {
    windows: { lang: string; code: string };
    macos: { lang: string; code: string };
    linux: { lang: string; code: string };
  };
  codeSnippet?: {
    lang: string;
    code: string;
  };
}

export interface GuideData {
  slug: string;
  title: string;
  subtitle: string;
  iconKey: string;
  categoryName: string;
  baseUrl: string;
  apiPath?: string;
  compatibility: string[];
  quickConfigCode?: string;
  steps: GuideStepData[];
  recommendedModels?: { id: string; provider: string; price: string }[];
  gotchas?: string[];
}

const HOST = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
const GATEWAY_URL = `${HOST}/v1`;
const ANTHROPIC_GATEWAY_URL = HOST;

const STANDARD_MODELS = [
  { id: "claude-3-7-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
  { id: "claude-3-5-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
  { id: "deepseek-chat-v3", provider: "DeepSeek", price: "$0.14 / $0.28" },
  { id: "deepseek-reasoner-r1", provider: "DeepSeek", price: "$0.55 / $2.19" },
  { id: "gpt-4o", provider: "OpenAI", price: "$2.50 / $10.00" },
  { id: "gemini-2.5-pro", provider: "Google", price: "$1.25 / $5.00" },
];

export const GUIDES_REGISTRY: Record<string, GuideData> = {
  /* ─────────────────────────────────────────────
     CODING AGENTS & CLIs
     ───────────────────────────────────────────── */
  opencode: {
    slug: "opencode",
    title: "OpenCode Setup Guide",
    subtitle: "Configure OpenCode to route coding completions, streaming, and tool calls through CheapRouter.",
    iconKey: "opencode",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open the OpenCode config file",
        description: "Open your OpenCode config in a text editor. Create the file if it does not exist.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `$f = "$env:USERPROFILE\\.config\\opencode\\opencode.json"\nmd -Force (Split-Path $f) | Out-Null; New-Item $f -ea 0 | Out-Null; Invoke-Item $f`,
          },
          macos: {
            lang: "bash",
            code: `mkdir -p ~/.config/opencode && touch ~/.config/opencode/opencode.json\nopen -t ~/.config/opencode/opencode.json`,
          },
          linux: {
            lang: "bash",
            code: `mkdir -p ~/.config/opencode && touch ~/.config/opencode/opencode.json\nxdg-open ~/.config/opencode/opencode.json`,
          },
        },
      },
      {
        stepNumber: 2,
        title: "Replace the file contents",
        description: "Add the CheapRouter provider block to your config. Merge it into the existing file, keeping any mcp or agent blocks you already have.",
        codeSnippet: {
          lang: "json",
          code: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "cheaprouter": {
      "name": "CheapRouter",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "apiKey": "YOUR_CHEAPROUTER_API_KEY",
        "baseURL": "${GATEWAY_URL}"
      },
      "models": {
        "claude-3-7-sonnet": {},
        "deepseek-chat-v3": {},
        "deepseek-reasoner-r1": {},
        "gpt-4o": {}
      }
    }
  }
}`,
        },
      },
      {
        stepNumber: 3,
        title: "Verify the models load",
        description: "Verify that OpenCode successfully connects to CheapRouter and enumerates models.",
        codeSnippet: {
          lang: "bash",
          code: "opencode models",
        },
      },
      {
        stepNumber: 4,
        title: "Pick a model",
        description: "Launch OpenCode in your workspace and select your preferred CheapRouter model.",
        codeSnippet: {
          lang: "bash",
          code: "opencode --model cheaprouter/claude-3-7-sonnet",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "OpenCode requires every model ID to be listed in the models object inside opencode.json.",
      "Ensure the npm provider '@ai-sdk/openai-compatible' is kept as specified.",
      "Check that your API key is correctly formatted with the cr-live- prefix.",
    ],
  },

  "kilo-code": {
    slug: "kilo-code",
    title: "Kilo Code Setup Guide",
    subtitle: "Integrate Kilo Code terminal assistant with CheapRouter high-throughput endpoints.",
    iconKey: "kilo-code",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Kilo Code Settings",
        description: "Launch Kilo Code CLI or open the config file located in your user home directory.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `notepad $env:USERPROFILE\\.kilo\\config.json`,
          },
          macos: {
            lang: "bash",
            code: `mkdir -p ~/.kilo && nano ~/.kilo/config.json`,
          },
          linux: {
            lang: "bash",
            code: `mkdir -p ~/.kilo && nano ~/.kilo/config.json`,
          },
        },
      },
      {
        stepNumber: 2,
        title: "Add Custom OpenAI Provider",
        description: "Add CheapRouter as an OpenAI-compatible provider with your API key.",
        codeSnippet: {
          lang: "json",
          code: `{
  "provider": "openai-compatible",
  "base_url": "${GATEWAY_URL}",
  "api_key": "YOUR_CHEAPROUTER_API_KEY",
  "default_model": "claude-3-7-sonnet"
}`,
        },
      },
      {
        stepNumber: 3,
        title: "Verify the connection",
        description: "Run Kilo Code check command to verify latency and model access.",
        codeSnippet: {
          lang: "bash",
          code: "kilo-code check",
        },
      },
      {
        stepNumber: 4,
        title: "Start coding with CheapRouter",
        description: "Run Kilo Code in any repository to begin automated refactoring and tests.",
        codeSnippet: {
          lang: "bash",
          code: "kilo-code --model claude-3-7-sonnet",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Kilo Code requires trailing '/v1' in the base URL when using OpenAI compatible mode.",
      "Streaming is enabled by default for sub-100ms first token response times.",
    ],
  },

  zed: {
    slug: "zed",
    title: "Zed IDE Setup Guide",
    subtitle: "Configure Zed editor assistant and inline transformations with CheapRouter.",
    iconKey: "zed",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Zed Settings",
        description: "Press Cmd+, (macOS) or Ctrl+, (Linux/Windows) and open settings.json.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `notepad $env:APPDATA\\Zed\\settings.json`,
          },
          macos: {
            lang: "bash",
            code: `open ~/.config/zed/settings.json`,
          },
          linux: {
            lang: "bash",
            code: `xdg-open ~/.config/zed/settings.json`,
          },
        },
      },
      {
        stepNumber: 2,
        title: "Add Language Models Configuration",
        description: "Insert the CheapRouter endpoint configuration into the language_models section.",
        codeSnippet: {
          lang: "json",
          code: `{
  "language_models": {
    "openai": {
      "version": "1",
      "api_url": "${GATEWAY_URL}",
      "available_models": [
        {
          "name": "claude-3-7-sonnet",
          "display_name": "Claude 3.7 Sonnet (CheapRouter)",
          "max_tokens": 128000
        },
        {
          "name": "deepseek-reasoner-r1",
          "display_name": "DeepSeek R1 (CheapRouter)",
          "max_tokens": 64000
        },
        {
          "name": "gpt-4o",
          "display_name": "GPT-4o (CheapRouter)",
          "max_tokens": 128000
        }
      ]
    }
  }
}`,
        },
      },
      {
        stepNumber: 3,
        title: "Set Environment Variable",
        description: "Set your OPENAI_API_KEY environment variable to your CheapRouter key.",
        codeSnippet: {
          lang: "bash",
          code: `export OPENAI_API_KEY="cr-live-your-cheaprouter-api-key"`,
        },
      },
      {
        stepNumber: 4,
        title: "Restart Zed Assistant",
        description: "Open the Assistant panel in Zed (Cmd+? or Ctrl+?) and pick your CheapRouter model.",
        codeSnippet: {
          lang: "bash",
          code: "# Press Cmd+? or Ctrl+? inside Zed to open the AI Assistant",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Zed reads OPENAI_API_KEY directly from your shell environment. Ensure it is exported in ~/.zshrc or ~/.bashrc.",
      "Inline transformations use the default model specified in your Zed assistant profile.",
    ],
  },

  cline: {
    slug: "cline",
    title: "Cline Setup Guide",
    subtitle: "Configure the Cline autonomous coding agent inside VS Code with CheapRouter.",
    iconKey: "cline",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling", "Vision"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Cline Extension Settings",
        description: "Click the Cline icon in the VS Code sidebar and click the Gear icon on top right.",
      },
      {
        stepNumber: 2,
        title: "Select API Provider",
        description: "Change the API Provider dropdown from Anthropic to 'OpenAI Compatible'.",
      },
      {
        stepNumber: 3,
        title: "Enter CheapRouter Connection Details",
        description: "Paste your CheapRouter Base URL and API key.",
        codeSnippet: {
          lang: "text",
          code: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key
Model ID: claude-3-7-sonnet`,
        },
      },
      {
        stepNumber: 4,
        title: "Save and Start Task",
        description: "Click 'Done' and prompt Cline to inspect, refactor, or build code in your repository.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Ensure tool calling is supported on your chosen model. Claude 3.7 Sonnet and GPT-4o have the best performance.",
      "If you experience timeouts during heavy codebase scans, set the request timeout to 120s in Cline advanced settings.",
    ],
  },

  "roo-code": {
    slug: "roo-code",
    title: "Roo Code Setup Guide",
    subtitle: "Connect Roo Code (Roo Cline) multi-mode AI coding assistant to CheapRouter.",
    iconKey: "roo-code",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling", "Vision"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Roo Code Settings",
        description: "Open Roo Code in VS Code sidebar and click the Settings (Gear) icon.",
      },
      {
        stepNumber: 2,
        title: "Select OpenAI Compatible Provider",
        description: "Under API Provider, choose 'OpenAI Compatible'.",
      },
      {
        stepNumber: 3,
        title: "Configure Base URL & Key",
        description: "Set the Base URL and API Key.",
        codeSnippet: {
          lang: "text",
          code: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key
Model ID: claude-3-7-sonnet`,
        },
      },
      {
        stepNumber: 4,
        title: "Configure Modes & Prompts",
        description: "Select Code mode or Architect mode and verify that streaming tokens render in real time.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Roo Code custom modes (Ask, Architect, Code) can each use different CheapRouter models (e.g. DeepSeek R1 for architect, Claude 3.7 for coding).",
    ],
  },

  "continue-dev": {
    slug: "continue-dev",
    title: "Continue.dev Setup Guide",
    subtitle: "Connect Continue.dev open-source autopilot for VS Code and JetBrains to CheapRouter.",
    iconKey: "continue-dev",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling", "Tab Autocomplete"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Continue config file",
        description: "Open ~/.continue/config.yaml in your editor.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `notepad $env:USERPROFILE\\.continue\\config.yaml`,
          },
          macos: {
            lang: "bash",
            code: `open ~/.continue/config.yaml`,
          },
          linux: {
            lang: "bash",
            code: `xdg-open ~/.continue/config.yaml`,
          },
        },
      },
      {
        stepNumber: 2,
        title: "Add CheapRouter Model Provider",
        description: "Insert the provider block with CheapRouter gateway configuration.",
        codeSnippet: {
          lang: "yaml",
          code: `models:
  - name: CheapRouter Claude 3.7
    provider: openai
    model: claude-3-7-sonnet
    apiBase: ${GATEWAY_URL}
    apiKey: cr-live-your-cheaprouter-api-key
  - name: CheapRouter DeepSeek R1
    provider: openai
    model: deepseek-reasoner-r1
    apiBase: ${GATEWAY_URL}
    apiKey: cr-live-your-cheaprouter-api-key
tabAutocompleteModel:
  title: CheapRouter DeepSeek V3
  provider: openai
  model: deepseek-chat-v3
  apiBase: ${GATEWAY_URL}
  apiKey: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 3,
        title: "Save & Restart Continue",
        description: "Reload your IDE window to activate the new model options in the Continue assistant panel.",
      },
      {
        stepNumber: 4,
        title: "Test In-Editor Autocomplete",
        description: "Type code in any file and press Tab to accept CheapRouter ultra-low latency completions.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Ensure apiBase does not contain a trailing slash.",
      "Tab autocomplete requires low latency; we recommend deepseek-chat-v3 or claude-3-5-haiku.",
    ],
  },

  "claude-code": {
    slug: "claude-code",
    title: "Claude Code Setup Guide",
    subtitle: "Run Anthropic's official terminal CLI Claude Code routed through CheapRouter wholesale pricing.",
    iconKey: "claude-code",
    categoryName: "Coding agents",
    baseUrl: ANTHROPIC_GATEWAY_URL,
    compatibility: ["Messages API", "Streaming", "Tool calling", "Bash execution"],
    quickConfigCode: `ANTHROPIC_BASE_URL: ${ANTHROPIC_GATEWAY_URL}
ANTHROPIC_API_KEY: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Install Claude Code CLI",
        description: "Install Claude Code globally via npm.",
        codeSnippet: {
          lang: "bash",
          code: "npm install -g @anthropic-ai/claude-code",
        },
      },
      {
        stepNumber: 2,
        title: "Export Gateway Environment Variables",
        description: "Point Claude Code to CheapRouter Anthropic compatibility endpoint.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `$env:ANTHROPIC_BASE_URL="${ANTHROPIC_GATEWAY_URL}"\n$env:ANTHROPIC_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
          macos: {
            lang: "bash",
            code: `export ANTHROPIC_BASE_URL="${ANTHROPIC_GATEWAY_URL}"\nexport ANTHROPIC_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
          linux: {
            lang: "bash",
            code: `export ANTHROPIC_BASE_URL="${ANTHROPIC_GATEWAY_URL}"\nexport ANTHROPIC_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
        },
      },
      {
        stepNumber: 3,
        title: "Launch Claude Code",
        description: "Run claude in any directory to start coding with full file access and tool calling.",
        codeSnippet: {
          lang: "bash",
          code: "claude",
        },
      },
      {
        stepNumber: 4,
        title: "Verify active provider",
        description: "Ask Claude Code `/cost` or `/model` inside the session to confirm routing through CheapRouter.",
        codeSnippet: {
          lang: "bash",
          code: "/cost",
        },
      },
    ],
    recommendedModels: [
      { id: "claude-3-7-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
      { id: "claude-3-5-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
      { id: "claude-3-5-haiku", provider: "Anthropic", price: "$0.80 / $4.00" },
    ],
    gotchas: [
      "ANTHROPIC_BASE_URL must NOT have '/v1' appended (Claude Code appends /v1/messages internally).",
      "Make sure you run `claude` in a persistent terminal where the environment variables were exported.",
    ],
  },

  codex: {
    slug: "codex",
    title: "Codex CLI Setup Guide",
    subtitle: "Configure Codex CLI agent to route autonomous coding tasks through CheapRouter.",
    iconKey: "codex",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling", "Responses API"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Install Codex CLI",
        description: "Install @openai/codex globally via npm or homebrew.",
        codeSnippet: {
          lang: "bash",
          code: "npm install -g @openai/codex",
        },
      },
      {
        stepNumber: 2,
        title: "Configure Codex Provider",
        description: "Edit ~/.codex/config.toml to define CheapRouter as your custom provider.",
        codeSnippet: {
          lang: "toml",
          code: `# ~/.codex/config.toml
model = "claude-3-7-sonnet"
model_provider = "cheaprouter"

[model_providers.cheaprouter]
name = "CheapRouter"
base_url = "${GATEWAY_URL}"
wire_api = "responses"
env_key = "OPENAI_API_KEY"`,
        },
      },
      {
        stepNumber: 3,
        title: "Export API Key",
        description: "Set your CheapRouter key in your environment.",
        codeSnippet: {
          lang: "bash",
          code: `export OPENAI_API_KEY="cr-live-your-cheaprouter-api-key"`,
        },
      },
      {
        stepNumber: 4,
        title: "Run Codex",
        description: "Execute codex from any project root to build features or fix test suites.",
        codeSnippet: {
          lang: "bash",
          code: "codex",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Codex wire_api can be set to 'responses' or 'chat' depending on whether you want native tool use.",
    ],
  },

  cursor: {
    slug: "cursor",
    title: "Cursor IDE Setup Guide",
    subtitle: "Configure Cursor AI IDE with CheapRouter custom OpenAI endpoint for Composer and Chat.",
    iconKey: "cursor",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Composer", "Inline Edits"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Cursor Settings",
        description: "Open Cursor Settings (Gear icon at top right) and select 'Models'.",
      },
      {
        stepNumber: 2,
        title: "Enable Custom OpenAI API Key",
        description: "Toggle on 'Override OpenAI Base URL' and paste CheapRouter gateway URL.",
        codeSnippet: {
          lang: "text",
          code: `OpenAI Base URL: ${GATEWAY_URL}
OpenAI API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 3,
        title: "Add Custom Model Names",
        description: "Under Model Names, add 'claude-3-7-sonnet', 'deepseek-reasoner-r1', and 'gpt-4o'.",
      },
      {
        stepNumber: 4,
        title: "Verify with Composer",
        description: "Press Cmd+I (macOS) or Ctrl+I (Windows) to verify that Composer streams responses via CheapRouter.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "In Cursor, you must click 'Verify' next to your custom API key to confirm the handshake.",
      "Cursor custom OpenAI endpoint supports Composer multi-file diff generation.",
    ],
  },

  aider: {
    slug: "aider",
    title: "Aider Setup Guide",
    subtitle: "Pair-program in your terminal with Aider AI coding assistant routed via CheapRouter.",
    iconKey: "aider",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Tool calling", "Git auto-commit"],
    quickConfigCode: `OPENAI_API_BASE: ${GATEWAY_URL}
OPENAI_API_KEY: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Install Aider",
        description: "Install aider-chat via pipx or python pip.",
        codeSnippet: {
          lang: "bash",
          code: "pip install aider-chat",
        },
      },
      {
        stepNumber: 2,
        title: "Export Connection Variables",
        description: "Set OPENAI_API_BASE and OPENAI_API_KEY in your terminal session.",
        osCode: {
          windows: {
            lang: "powershell",
            code: `$env:OPENAI_API_BASE="${GATEWAY_URL}"\n$env:OPENAI_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
          macos: {
            lang: "bash",
            code: `export OPENAI_API_BASE="${GATEWAY_URL}"\nexport OPENAI_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
          linux: {
            lang: "bash",
            code: `export OPENAI_API_BASE="${GATEWAY_URL}"\nexport OPENAI_API_KEY="cr-live-your-cheaprouter-api-key"`,
          },
        },
      },
      {
        stepNumber: 3,
        title: "Run Aider with CheapRouter Model",
        description: "Launch aider specifying your chosen model.",
        codeSnippet: {
          lang: "bash",
          code: "aider --model openai/claude-3-7-sonnet",
        },
      },
      {
        stepNumber: 4,
        title: "Automate with .aider.conf.yml",
        description: "Save your preferences to .aider.conf.yml in your project root.",
        codeSnippet: {
          lang: "yaml",
          code: `openai-api-base: ${GATEWAY_URL}
openai-api-key: cr-live-your-cheaprouter-api-key
model: openai/claude-3-7-sonnet
auto-commits: true`,
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Prefix the model name with 'openai/' (e.g. openai/claude-3-7-sonnet) so Aider uses OpenAI compatibility layer.",
    ],
  },

  "cc-switch": {
    slug: "cc-switch",
    title: "CC Switch Tool Guide",
    subtitle: "One-click model switching utility for Claude Code, Codex, and terminal coding agents.",
    iconKey: "cc-switch",
    categoryName: "Coding agents",
    baseUrl: ANTHROPIC_GATEWAY_URL,
    compatibility: ["CLI Profiles", "MCP Management", "Multi-provider switching"],
    quickConfigCode: `cc-switch profile add cheaprouter --endpoint "${ANTHROPIC_GATEWAY_URL}" --key "cr-live-your-cheaprouter-api-key"`,
    steps: [
      {
        stepNumber: 1,
        title: "Install CC Switch",
        description: "Install cc-switch globally via npm.",
        codeSnippet: {
          lang: "bash",
          code: "npm install -g cc-switch",
        },
      },
      {
        stepNumber: 2,
        title: "Add CheapRouter Profile",
        description: "Register CheapRouter as a provider profile in CC Switch.",
        codeSnippet: {
          lang: "bash",
          code: `cc-switch profile add cheaprouter \\
  --endpoint "${ANTHROPIC_GATEWAY_URL}" \\
  --key "cr-live-your-cheaprouter-api-key"`,
        },
      },
      {
        stepNumber: 3,
        title: "Switch active profile",
        description: "Activate CheapRouter as your active provider.",
        codeSnippet: {
          lang: "bash",
          code: "cc-switch use cheaprouter",
        },
      },
      {
        stepNumber: 4,
        title: "Launch Agent",
        description: "Run claude or codex — all traffic will seamlessly route via CheapRouter.",
        codeSnippet: {
          lang: "bash",
          code: "claude",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "CC Switch updates the local shell profile. Restart your terminal if variables are not reflected.",
    ],
  },

  harness: {
    slug: "harness",
    title: "Agent Test Harness Guide",
    subtitle: "Comprehensive testing harness to evaluate coding agents against standardized benchmarks.",
    iconKey: "harness",
    categoryName: "Coding agents",
    baseUrl: GATEWAY_URL,
    compatibility: ["E2E Benchmarks", "Telemetry", "Token Cost Analytics"],
    quickConfigCode: `HARNESS_BASE_URL: ${GATEWAY_URL}
HARNESS_API_KEY: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Clone or install Harness",
        description: "Set up the Agent Test Harness in your testing environment.",
        codeSnippet: {
          lang: "bash",
          code: "npx @cheaprouter/test-harness init",
        },
      },
      {
        stepNumber: 2,
        title: "Configure test suite",
        description: "Define CheapRouter as the evaluation backend in harness.config.json.",
        codeSnippet: {
          lang: "json",
          code: `{
  "gateway": "${GATEWAY_URL}",
  "apiKey": "cr-live-your-cheaprouter-api-key",
  "concurrency": 10,
  "testSuites": ["refactoring", "syntax", "context-retrieval"]
}`,
        },
      },
      {
        stepNumber: 3,
        title: "Run benchmarks",
        description: "Execute the benchmark suite across models to compare speed and cost.",
        codeSnippet: {
          lang: "bash",
          code: "npx @cheaprouter/test-harness run --model claude-3-7-sonnet",
        },
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Use high concurrency limits to stress-test rate limit handling.",
    ],
  },

  /* ─────────────────────────────────────────────
     CHARACTER & FICTION CLIENTS
     ───────────────────────────────────────────── */
  sillytavern: {
    slug: "sillytavern",
    title: "SillyTavern Integration Guide",
    subtitle: "Connect SillyTavern character client to CheapRouter high-throughput LLM endpoints.",
    iconKey: "sillytavern",
    categoryName: "Character & fiction clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Lorebooks", "Vision"],
    quickConfigCode: `API: Chat Completion
API Provider: Custom (OpenAI-compatible)
Custom Endpoint: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open SillyTavern API Connections",
        description: "In SillyTavern, click the Plug icon on top to open the API settings drawer.",
      },
      {
        stepNumber: 2,
        title: "Select Chat Completion / OpenAI",
        description: "Choose 'Chat Completion' as Main API and 'Custom (OpenAI-compatible)' as Provider.",
      },
      {
        stepNumber: 3,
        title: "Enter CheapRouter Custom Endpoint",
        description: "Paste the custom endpoint URL into the Custom Endpoint field.",
        codeSnippet: {
          lang: "text",
          code: `Custom Endpoint (Base URL): ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 4,
        title: "Connect & Fetch Models",
        description: "Click 'Connect' to fetch models. Select 'claude-3-7-sonnet', 'deepseek-chat-v3', or 'gpt-4o'.",
      },
    ],
    recommendedModels: [
      { id: "claude-3-7-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
      { id: "deepseek-chat-v3", provider: "DeepSeek", price: "$0.14 / $0.28" },
      { id: "deepseek-reasoner-r1", provider: "DeepSeek", price: "$0.55 / $2.19" },
      { id: "gpt-4o", provider: "OpenAI", price: "$2.50 / $10.00" },
    ],
    gotchas: [
      "In SillyTavern, make sure 'Streaming' is checked for real-time word-by-word generation.",
      "Context length can be safely set up to 128,000 tokens on Claude and DeepSeek models.",
    ],
  },

  "janitor-ai": {
    slug: "janitor-ai",
    title: "Janitor.AI Integration Guide",
    subtitle: "Route Janitor.AI proxy requests through CheapRouter with zero latency and high context.",
    iconKey: "janitor-ai",
    categoryName: "Character & fiction clients",
    baseUrl: `${GATEWAY_URL}/chat/completions`,
    compatibility: ["Chat Completions", "Streaming", "Reverse Proxy"],
    quickConfigCode: `Proxy URL: ${GATEWAY_URL}/chat/completions
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Janitor.AI API Settings",
        description: "In Janitor.AI, click the three dots icon on any character chat and select 'API Settings'.",
      },
      {
        stepNumber: 2,
        title: "Select OpenAI Compatible Proxy",
        description: "Under API Provider, choose 'OpenAI' or 'Custom Reverse Proxy'.",
      },
      {
        stepNumber: 3,
        title: "Enter Proxy URL & Key",
        description: "Set the Proxy URL to CheapRouter chat completions endpoint.",
        codeSnippet: {
          lang: "text",
          code: `Proxy URL: ${GATEWAY_URL}/chat/completions
API Key: cr-live-your-cheaprouter-api-key
Model: claude-3-7-sonnet`,
        },
      },
      {
        stepNumber: 4,
        title: "Save and Start Chat",
        description: "Click 'Save Settings' and enjoy ultra-fast, unrestricted conversation with your characters.",
      },
    ],
    recommendedModels: [
      { id: "claude-3-7-sonnet", provider: "Anthropic", price: "$3.00 / $15.00" },
      { id: "deepseek-chat-v3", provider: "DeepSeek", price: "$0.14 / $0.28" },
      { id: "gpt-4o", provider: "OpenAI", price: "$2.50 / $10.00" },
    ],
    gotchas: [
      "Janitor.AI requires the full `/chat/completions` suffix in the Proxy URL field.",
      "Max Tokens can be set up to 4096 for long descriptive replies.",
    ],
  },

  risuai: {
    slug: "risuai",
    title: "RisuAI Integration Guide",
    subtitle: "Connect RisuAI desktop or web client to CheapRouter OpenAI-compatible API.",
    iconKey: "risuai",
    categoryName: "Character & fiction clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Custom Formats"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open RisuAI Settings",
        description: "Navigate to Settings > Bot & API settings in RisuAI.",
      },
      {
        stepNumber: 2,
        title: "Select Custom OpenAI Provider",
        description: "Set API to 'Custom OpenAI' or 'OpenAI Compatible'.",
      },
      {
        stepNumber: 3,
        title: "Enter Gateway Base URL",
        description: "Set the custom Base URL to CheapRouter.",
        codeSnippet: {
          lang: "text",
          code: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 4,
        title: "Configure Tokeniser and Presets",
        description: "Choose Claude or GPT-4o tokenizer according to your selected model.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Enable 'Streaming' in RisuAI display settings for instant feedback.",
    ],
  },

  chub: {
    slug: "chub",
    title: "Chub / Venus Integration Guide",
    subtitle: "Configure Chub AI and Venus chat client with CheapRouter high-performance LLMs.",
    iconKey: "chub",
    categoryName: "Character & fiction clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Reverse Proxy"],
    quickConfigCode: `Reverse Proxy URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Chub / Venus Settings",
        description: "Open the generation settings panel in Venus Chub.",
      },
      {
        stepNumber: 2,
        title: "Configure Custom OpenAI Endpoint",
        description: "Select OpenAI API and enter your CheapRouter gateway URL.",
        codeSnippet: {
          lang: "text",
          code: `Reverse Proxy URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 3,
        title: "Select Model ID",
        description: "Type 'claude-3-7-sonnet' or 'deepseek-chat-v3' in the custom model input.",
      },
      {
        stepNumber: 4,
        title: "Save & Start Chatting",
        description: "Save your settings and initiate dialogue with your chosen lorebook character.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Ensure prompt format is set to OpenAI Chat format.",
    ],
  },

  nevika: {
    slug: "nevika",
    title: "Nevika Integration Guide",
    subtitle: "Integrate Nevika client with CheapRouter AI gateway for seamless dialogue generation.",
    iconKey: "nevika",
    categoryName: "Character & fiction clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Narrative runner"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Nevika API Config",
        description: "Open Nevika preferences and navigate to LLM Provider selection.",
      },
      {
        stepNumber: 2,
        title: "Add CheapRouter Gateway",
        description: "Add CheapRouter Base URL and authentication key.",
        codeSnippet: {
          lang: "text",
          code: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 3,
        title: "Select active character runner",
        description: "Choose your model profile and test with a sample prompt.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Nevika supports temperature and top_p overrides sent straight to CheapRouter.",
    ],
  },

  /* ─────────────────────────────────────────────
     CHAT & DESKTOP CLIENTS
     ───────────────────────────────────────────── */
  "open-webui": {
    slug: "open-webui",
    title: "Open WebUI Setup Guide",
    subtitle: "Connect Open WebUI (formerly Ollama WebUI) to CheapRouter for multi-user chat and documents.",
    iconKey: "open-webui",
    categoryName: "Chat & desktop clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "RAG", "Multi-modal"],
    quickConfigCode: `OPENAI_API_BASE_URL: ${GATEWAY_URL}
OPENAI_API_KEY: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open WebUI Admin Settings",
        description: "Log into Open WebUI as Admin, go to Settings > Connections.",
      },
      {
        stepNumber: 2,
        title: "Add OpenAI API Connection",
        description: "Under OpenAI API, add CheapRouter Base URL and API Key.",
        codeSnippet: {
          lang: "text",
          code: `API Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 3,
        title: "Verify Connections",
        description: "Click the refresh icon to pull all 200+ available models from CheapRouter.",
      },
      {
        stepNumber: 4,
        title: "Start chatting",
        description: "Select any model from the dropdown and enjoy web browsing, doc search, and voice interaction.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Open WebUI caches model lists. Click the reload button in Admin > Connections whenever new models are added.",
    ],
  },

  librechat: {
    slug: "librechat",
    title: "LibreChat Integration Guide",
    subtitle: "Configure LibreChat enterprise chat platform with CheapRouter custom endpoints.",
    iconKey: "librechat",
    categoryName: "Chat & desktop clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Artifacts", "Code Execution"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open librechat.yaml",
        description: "Open librechat.yaml in your LibreChat server directory.",
      },
      {
        stepNumber: 2,
        title: "Add Custom Endpoint Block",
        description: "Add CheapRouter to the custom endpoints array.",
        codeSnippet: {
          lang: "yaml",
          code: `endpoints:
  custom:
    - name: "CheapRouter"
      apiKey: "cr-live-your-cheaprouter-api-key"
      baseURL: "${GATEWAY_URL}"
      models:
        default: ["claude-3-7-sonnet", "deepseek-reasoner-r1", "gpt-4o"]
        fetch: true
      titleConvo: true
      titleModel: "claude-3-5-haiku"
      summarize: true`,
        },
      },
      {
        stepNumber: 3,
        title: "Restart LibreChat",
        description: "Restart docker or your Node.js instance to load the custom endpoint.",
        codeSnippet: {
          lang: "bash",
          code: "docker compose restart",
        },
      },
      {
        stepNumber: 4,
        title: "Select CheapRouter in UI",
        description: "Open LibreChat in your browser and pick CheapRouter from the top-left provider dropdown.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Setting `fetch: true` automatically populates all models supported by CheapRouter.",
    ],
  },

  chatbox: {
    slug: "chatbox",
    title: "Chatbox Setup Guide",
    subtitle: "Configure Chatbox desktop AI client for macOS, Windows, and Linux with CheapRouter.",
    iconKey: "chatbox",
    categoryName: "Chat & desktop clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Markdown", "Artifacts"],
    quickConfigCode: `AI Provider: OpenAI API
API Host: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Chatbox Settings",
        description: "Launch Chatbox and click the Settings icon on the bottom left.",
      },
      {
        stepNumber: 2,
        title: "Select Model Provider",
        description: "Choose 'OpenAI API' as your AI Model Provider.",
      },
      {
        stepNumber: 3,
        title: "Configure Host & Key",
        description: "Set API Host to CheapRouter and enter your key.",
        codeSnippet: {
          lang: "text",
          code: `API Host: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key
Model: claude-3-7-sonnet`,
        },
      },
      {
        stepNumber: 4,
        title: "Save and Chat",
        description: "Click Save and start productive chatting with high-speed token rendering.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "Chatbox supports custom model names. You can type any model ID supported by CheapRouter.",
    ],
  },

  typingmind: {
    slug: "typingmind",
    title: "TypingMind Integration Guide",
    subtitle: "Supercharge TypingMind web client with CheapRouter models, plugins, and web search.",
    iconKey: "typingmind",
    categoryName: "Chat & desktop clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Web Search", "Plugins"],
    quickConfigCode: `API Endpoint: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open Model Settings",
        description: "In TypingMind, click Preferences > AI Models > Add Custom Model.",
      },
      {
        stepNumber: 2,
        title: "Select OpenAI Compatible",
        description: "Set Endpoint Type to 'OpenAI Compatible'.",
      },
      {
        stepNumber: 3,
        title: "Configure Connection Details",
        description: "Paste your CheapRouter Base URL and key.",
        codeSnippet: {
          lang: "text",
          code: `API Endpoint: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
        },
      },
      {
        stepNumber: 4,
        title: "Sync Models",
        description: "Click 'Sync Models' and choose Claude 3.7, DeepSeek R1, or GPT-4o.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "TypingMind supports image inputs when using vision-capable models like claude-3-7-sonnet or gpt-4o.",
    ],
  },

  anythingllm: {
    slug: "anythingllm",
    title: "AnythingLLM Setup Guide",
    subtitle: "Integrate AnythingLLM document intelligence and RAG workspace with CheapRouter.",
    iconKey: "anythingllm",
    categoryName: "Chat & desktop clients",
    baseUrl: GATEWAY_URL,
    compatibility: ["Chat Completions", "Streaming", "Document Q&A", "RAG"],
    quickConfigCode: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key`,
    steps: [
      {
        stepNumber: 1,
        title: "Open AnythingLLM Settings",
        description: "Click the Gear icon in AnythingLLM and select 'LLM Preference'.",
      },
      {
        stepNumber: 2,
        title: "Select Generic OpenAI",
        description: "Select 'Generic OpenAI' from the LLM Provider dropdown.",
      },
      {
        stepNumber: 3,
        title: "Enter CheapRouter URL & Key",
        description: "Configure the Base URL and API Key.",
        codeSnippet: {
          lang: "text",
          code: `Base URL: ${GATEWAY_URL}
API Key: cr-live-your-cheaprouter-api-key
Chat Model: claude-3-7-sonnet`,
        },
      },
      {
        stepNumber: 4,
        title: "Save & Query Documents",
        description: "Upload PDFs, codebases, or docx files and ask questions with massive 128k context.",
      },
    ],
    recommendedModels: STANDARD_MODELS,
    gotchas: [
      "AnythingLLM performs best with 128k context models like DeepSeek Chat v3 and Claude 3.7 Sonnet.",
    ],
  },
};
