"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Terminal,
  Code2,
  Server,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Layers,
  Globe,
  ExternalLink,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { copyToClipboard as copyUtil } from "@/lib/utils";

interface CustomApiViewProps {
  baseUrl?: string;
}

const SERIF_FONT = "'Newsreader', 'Lora', Georgia, Cambria, 'Times New Roman', serif";
const MONO_FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, Consolas, monospace";

/* ─── LANGUAGE ICONS (SVGs) ─── */
function PythonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M11.91 2c-5.06 0-4.73 2.19-4.73 2.19l.01 2.28h4.81v.68H5.24S2 6.78 2 11.87s2.83 4.93 2.83 4.93h1.69v-2.39s-.09-2.83 2.78-2.83h4.75s2.67.04 2.67-2.61V4.67S17.06 2 11.91 2zm-2.6 1.54a.97.97 0 110 1.94.97.97 0 010-1.94z"
        fill="#387EB8"
      />
      <path
        d="M12.09 22c5.06 0 4.73-2.19 4.73-2.19l-.01-2.28h-4.81v-.68h6.76s3.24.37 3.24-4.72-2.83-4.93-2.83-4.93h-1.69v2.39s.09 2.83-2.78 2.83H9.95s-2.67-.04-2.67 2.61v4.29S6.94 22 12.09 22zm2.6-1.54a.97.97 0 110-1.94.97.97 0 010 1.94z"
        fill="#FFE052"
      />
    </svg>
  );
}

function NodeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" fill="#5FA04E" />
      <path d="M12 4.3L5.34 8.15v7.7L12 19.7l6.66-3.85v-7.7L12 4.3z" fill="#333333" />
      <path d="M12 6.5l4.5 2.6v5.2L12 16.9l-4.5-2.6v-5.2L12 6.5z" fill="#5FA04E" />
    </svg>
  );
}

function JsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#F7DF1E" />
      <path
        d="M6.5 18c.5.8 1.4 1.3 2.5 1.3 1.4 0 2.3-.7 2.3-2.4v-8.4h-2.1v8.4c0 .6-.3.9-.8.9-.4 0-.7-.2-.9-.6L6.5 18zm8.6-1.4c.5.9 1.4 1.5 2.7 1.5 1.5 0 2.4-.8 2.4-2 0-1.3-.9-1.8-2.5-2.5-1.9-.8-3.1-1.6-3.1-3.6 0-1.8 1.4-3.2 3.5-3.2 1.6 0 2.7.6 3.4 1.9l-1.7 1.1c-.4-.7-1-1.1-1.7-1.1-1 0-1.6.6-1.6 1.4 0 1 .7 1.5 2.1 2.1 2.2.9 3.5 1.8 3.5 3.9 0 2.2-1.7 3.5-4.2 3.5-2.3 0-3.6-1.1-4.3-2.5l1.5-1.1z"
        fill="#000000"
      />
    </svg>
  );
}

function AnthropicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M17.3 3L11.6 17.5H14L15.3 14H19.7L21 17.5H23.5L17.8 3H17.3ZM16.1 11.8L17.5 7.9L18.9 11.8H16.1ZM6.7 3L1 17.5H3.5L4.8 14H9.2L10.5 17.5H13L7.3 3H6.7ZM5.6 11.8L7 7.9L8.4 11.8H5.6Z"
        fill="#D97757"
      />
    </svg>
  );
}

function DartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.1 3.5L3.5 4.1v7.6l6.8 6.8 7.6-3.4 3.4-7.6-7.8-7.5H5.9L4.1 3.5z" fill="#01579B" />
      <path d="M17.9 15.1l3.4-7.6-7.8-7.5H5.9L17.9 15.1z" fill="#29B6F6" />
      <path d="M10.3 18.5l7.6-3.4L5.9 3.5 3.5 4.1v7.6l6.8 6.8z" fill="#00B0FF" />
      <path d="M10.3 18.5l-6.8-6.8V20l3.5 1.5 6.7-6.4-3.4 3.4z" fill="#0288D1" />
    </svg>
  );
}

function PhpIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#777BB4" />
      <path
        d="M7.5 15.2h1.4l.6-2.5h1.2c1.3 0 2.2-.6 2.5-1.7.3-1.1-.3-1.8-1.5-1.8H8.5l-1 6zm1.9-3.7l.4-1.6h.9c.5 0 .8.2.7.6-.1.5-.4.8-.9.8h-.7v.2h-.4zm5 3.7h1.4l.6-2.5h1.2c1.3 0 2.2-.6 2.5-1.7.3-1.1-.3-1.8-1.5-1.8h-3.2l-1 6zm1.9-3.7l.4-1.6h.9c.5 0 .8.2.7.6-.1.5-.4.8-.9.8h-.7v.2h-.4z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function CurlIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function MoreIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </svg>
  );
}

/* ─── SYNTAX HIGHLIGHTING TOKENIZER ─── */
interface Token {
  type: "comment" | "string" | "keyword" | "boolean" | "number" | "function" | "prop" | "punctuation" | "whitespace" | "text";
  text: string;
}

function tokenizeLine(line: string, lang: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // 1. Whitespace
    const wsMatch = remaining.match(/^(\s+)/);
    if (wsMatch) {
      tokens.push({ type: "whitespace", text: wsMatch[1] });
      remaining = remaining.slice(wsMatch[1].length);
      continue;
    }

    // 2. Comments
    if (lang === "python" || lang === "bash") {
      if (remaining.startsWith("#")) {
        tokens.push({ type: "comment", text: remaining });
        break;
      }
    } else if (lang === "php") {
      if (remaining.startsWith("//") || remaining.startsWith("#") || remaining.startsWith("/*")) {
        tokens.push({ type: "comment", text: remaining });
        break;
      }
    } else if (lang !== "json") {
      if (remaining.startsWith("//") || remaining.startsWith("/*")) {
        tokens.push({ type: "comment", text: remaining });
        break;
      }
    }

    // 3. Strings: double quotes, single quotes, template literals
    const strMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/);
    if (strMatch) {
      const isKey = remaining.slice(strMatch[1].length).trimStart().startsWith(":");
      tokens.push({ type: isKey ? "prop" : "string", text: strMatch[1] });
      remaining = remaining.slice(strMatch[1].length);
      continue;
    }

    // 4. Numbers
    const numMatch = remaining.match(/^(\b\d+(\.\d+)?\b)/);
    if (numMatch) {
      tokens.push({ type: "number", text: numMatch[1] });
      remaining = remaining.slice(numMatch[1].length);
      continue;
    }

    // 5. Booleans & special literals
    const boolMatch = remaining.match(/^(\b(true|false|null|undefined|True|False|None)\b)/);
    if (boolMatch) {
      tokens.push({ type: "boolean", text: boolMatch[1] });
      remaining = remaining.slice(boolMatch[1].length);
      continue;
    }

    // 6. Keywords
    const kwMatch = remaining.match(
      /^(\b(import|from|export|default|const|let|var|function|async|await|return|if|else|elif|for|in|while|def|class|new|as|try|except|catch|throw|finally|void|Future|final|use|echo)\b|<\?php)/
    );
    if (kwMatch) {
      tokens.push({ type: "keyword", text: kwMatch[1] });
      remaining = remaining.slice(kwMatch[1].length);
      continue;
    }

    // 7. Function / Method calls before '('
    const fnMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*\()/);
    if (fnMatch) {
      tokens.push({ type: "function", text: fnMatch[1] });
      remaining = remaining.slice(fnMatch[1].length);
      continue;
    }

    // 8. Properties before ':'
    const propMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*:)/);
    if (propMatch) {
      tokens.push({ type: "prop", text: propMatch[1] });
      remaining = remaining.slice(propMatch[1].length);
      continue;
    }

    // 9. Punctuation / Operators
    const punctMatch = remaining.match(/^([{}()[\],;:=><+\-*/&|!~\\$]+)/);
    if (punctMatch) {
      tokens.push({ type: "punctuation", text: punctMatch[1] });
      remaining = remaining.slice(punctMatch[1].length);
      continue;
    }

    // 10. General text / word
    const textMatch = remaining.match(/^([^\s{}()[\],;:=><+\-*/&|!~"'\`#]+)/);
    if (textMatch) {
      tokens.push({ type: "text", text: textMatch[1] });
      remaining = remaining.slice(textMatch[1].length);
      continue;
    }

    // Fallback single character
    tokens.push({ type: "text", text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return tokens;
}

function getTokenStyle(type: Token["type"], isDark: boolean): React.CSSProperties {
  switch (type) {
    case "comment":
      return { color: isDark ? "#818cf8" : "#6366f1", fontStyle: "italic", opacity: 0.85 };
    case "string":
      return { color: isDark ? "#34d399" : "#15803d" };
    case "keyword":
      return { color: isDark ? "#f472b6" : "#be185d", fontWeight: 600 };
    case "boolean":
    case "number":
      return { color: isDark ? "#fb923c" : "#ea580c", fontWeight: 600 };
    case "function":
      return { color: isDark ? "#60a5fa" : "#2563eb" };
    case "prop":
      return { color: isDark ? "#38bdf8" : "#0284c7" };
    case "punctuation":
      return { color: isDark ? "#94a3b8" : "#64748b" };
    default:
      return { color: isDark ? "#f1f5f9" : "#0f172a" };
  }
}

function HighlightedCode({
  code,
  lang,
  isDark,
  showLineNumbers = true,
}: {
  code: string;
  lang: string;
  isDark: boolean;
  showLineNumbers?: boolean;
}) {
  const lines = code.trim().split("\n");

  return (
    <pre
      style={{
        margin: 0,
        padding: "16px 20px",
        fontFamily: MONO_FONT,
        fontSize: "12.5px",
        lineHeight: "1.65",
        overflowX: "auto",
        backgroundColor: "transparent",
      }}
    >
      <code style={{ display: "block" }}>
        {lines.map((line, lineIdx) => {
          const tokens = tokenizeLine(line, lang);
          return (
            <div
              key={lineIdx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                minHeight: "20px",
              }}
            >
              {showLineNumbers && (
                <span
                  style={{
                    width: "32px",
                    flexShrink: 0,
                    textAlign: "right",
                    paddingRight: "16px",
                    userSelect: "none",
                    color: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)",
                    fontSize: "11px",
                    fontFamily: MONO_FONT,
                  }}
                >
                  {lineIdx + 1}
                </span>
              )}
              <span style={{ flex: 1, whiteSpace: "pre" }}>
                {tokens.length === 0 ? (
                  "\n"
                ) : (
                  tokens.map((token, tokenIdx) => (
                    <span key={tokenIdx} style={getTokenStyle(token.type, isDark)}>
                      {token.text}
                    </span>
                  ))
                )}
              </span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}

export type ActiveSdkKey =
  | "python"
  | "node"
  | "javascript"
  | "anthropic"
  | "dart"
  | "php"
  | "curl"
  | "more";

export default function CustomApiView({ baseUrl = "http://localhost:3000" }: CustomApiViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const cleanBase = baseUrl.replace(/\/$/, "");
  const baseV1Url = `${cleanBase}/v1`;
  const endpointPath = "/chat/completions";
  const fullEndpointUrl = `${baseV1Url}${endpointPath}`;

  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedSdkCode, setCopiedSdkCode] = useState(false);
  const [activeSdk, setActiveSdk] = useState<ActiveSdkKey>("python");

  const samplePayload = `{
  "model": "claude-3-7-sonnet",
  "messages": [
    {
      "role": "system",
      "content": "You are a concise, helpful programming assistant."
    },
    {
      "role": "user",
      "content": "Write a Python function to calculate fibonacci numbers."
    }
  ],
  "temperature": 0.7,
  "stream": false
}`;

  const sampleResponse = `{
  "id": "chatcmpl-cr-8f4b1a29c3",
  "object": "chat.completion",
  "created": 1728123456,
  "model": "claude-3-7-sonnet",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "def fibonacci(n):\\n    if n <= 0:\\n        return 0\\n    elif n == 1:\\n        return 1\\n    a, b = 0, 1\\n    for _ in range(2, n + 1):\\n        a, b = b, a + b\\n    return b"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 58,
    "total_tokens": 86
  }
}`;

  const sdkSnippets: Record<
    ActiveSdkKey,
    { title: string; install: string; lang: string; code: string }
  > = {
    python: {
      title: "Python (Official OpenAI SDK)",
      install: "pip install openai",
      lang: "python",
      code: `from openai import OpenAI

# 1. Point client to CheapRouter universal gateway
client = OpenAI(
    base_url="${baseV1Url}",
    api_key="cr-live-your_api_key_here"
)

# 2. Call any AI model (Claude, GPT, DeepSeek, Llama, etc.)
response = client.chat.completions.create(
    model="claude-3-7-sonnet",
    messages=[
        {"role": "system", "content": "You are a helpful programming assistant."},
        {"role": "user", "content": "Hello! Confirm CheapRouter connection."}
    ],
    stream=True
)

# 3. Stream live tokens
for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)`,
    },
    node: {
      title: "Node.js / TypeScript (Official OpenAI SDK)",
      install: "npm install openai",
      lang: "typescript",
      code: `import OpenAI from "openai";

// 1. Initialize OpenAI client with CheapRouter base URL
const openai = new OpenAI({
  baseURL: "${baseV1Url}",
  apiKey: "cr-live-your_api_key_here",
});

// 2. Execute chat completion with high-speed streaming
async function main() {
  const stream = await openai.chat.completions.create({
    model: "claude-3-7-sonnet",
    messages: [{ role: "user", content: "Hello from CheapRouter!" }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

main();`,
    },
    javascript: {
      title: "JavaScript / React (Universal Fetch & SDK)",
      install: "npm install openai  # or native window.fetch",
      lang: "javascript",
      code: `import OpenAI from "openai";

// 1. Initialize client for Web / React apps
const client = new OpenAI({
  baseURL: "${baseV1Url}",
  apiKey: "cr-live-your_api_key_here",
  dangerouslyAllowBrowser: true, // Only for client-side demo tests
});

// 2. Async AI Assistant function
export async function askCheapRouter(prompt) {
  const response = await client.chat.completions.create({
    model: "claude-3-7-sonnet",
    messages: [
      { role: "system", content: "You are a concise expert." },
      { role: "user", content: prompt }
    ],
  });

  return response.choices[0].message.content;
}

// React usage:
// const [reply, setReply] = useState("");
// const handleAsk = async () => setReply(await askCheapRouter("Build a counter app"));`,
    },
    anthropic: {
      title: "Anthropic SDK (Python)",
      install: "pip install anthropic",
      lang: "python",
      code: `from anthropic import Anthropic

# 1. Point Anthropic client directly to CheapRouter base URL
client = Anthropic(
    base_url="${cleanBase}",
    api_key="cr-live-your_api_key_here"
)

# 2. Call Messages API natively
message = client.messages.create(
    model="claude-3-7-sonnet",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Explain async/await in Python in 2 sentences."}
    ]
)

print(message.content[0].text)`,
    },
    dart: {
      title: "Dart / Flutter (HTTP & REST)",
      install: "flutter pub add http",
      lang: "dart",
      code: `import 'dart:convert';
import 'package:http/http.dart' as http;

Future<void> sendChatMessage() async {
  const url = '${baseV1Url}/chat/completions';
  const apiKey = 'cr-live-your_api_key_here';

  final response = await http.post(
    Uri.parse(url),
    headers: {
      'Authorization': 'Bearer $apiKey',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'model': 'claude-3-7-sonnet',
      'messages': [
        {'role': 'user', 'content': 'Hello from Flutter / Dart!'}
      ],
      'temperature': 0.7,
    }),
  );

  final data = jsonDecode(response.body);
  print(data['choices'][0]['message']['content']);
}`,
    },
    php: {
      title: "PHP (Native cURL / OpenAI PHP)",
      install: "composer require openai-php/client  # or native curl",
      lang: "php",
      code: `<?php
// Simple cURL request to CheapRouter API
$apiKey = "cr-live-your_api_key_here";
$endpoint = "${baseV1Url}/chat/completions";

$payload = json_encode([
    "model" => "claude-3-7-sonnet",
    "messages" => [
        ["role" => "system", "content" => "You are a concise assistant."],
        ["role" => "user", "content" => "Hello from PHP!"]
    ],
    "temperature" => 0.7
]);

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$apiKey}",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
echo $result["choices"][0]["message"]["content"];`,
    },
    curl: {
      title: "cURL (Direct HTTP REST)",
      install: "curl available by default in terminal",
      lang: "bash",
      code: `curl -X POST "${fullEndpointUrl}" \\
  -H "Authorization: Bearer cr-live-your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-3-7-sonnet",
    "messages": [
      {"role": "system", "content": "You are a concise assistant."},
      {"role": "user", "content": "Say hello!"}
    ],
    "temperature": 0.7,
    "stream": false
  }'`,
    },
    more: {
      title: "Universal 20+ Language & Framework Ecosystem",
      install: "100% Wire-Compatible with OpenAI & Anthropic",
      lang: "bash",
      code: `# Universal OpenAI compatibility for ANY language or framework:
# Change baseURL to CheapRouter & insert your key!

# 1. Go (sashabaranov/go-openai)
# config := openai.DefaultConfig("cr-live-your_api_key_here")
# config.BaseURL = "${baseV1Url}"

# 2. Rust (async-openai)
# let config = OpenAIConfig::new().with_api_base("${baseV1Url}");

# 3. C# / .NET (Betalgo.OpenAI / Semantic Kernel)
# options.BaseDomain = "${baseV1Url}";

# 4. Java / Spring AI / LangChain4j
# OpenAiClient.builder().baseUrl("${baseV1Url}").build();

# 5. Ruby (ruby-openai)
# OpenAI.configure { |c| c.uri_base = "${baseV1Url}" }

# 6. Swift / iOS (MacPaw/OpenAI)
# let config = OpenAI.Configuration(token: "...", host: "${cleanBase}")

# 7. AI Frameworks (LangChain, LlamaIndex, AutoGen, CrewAI)
# llm = ChatOpenAI(base_url="${baseV1Url}", api_key="...")`,
    },
  };

  const sdkTabs = [
    { id: "python", label: "Python", sub: "OpenAI", icon: PythonIcon },
    { id: "node", label: "Node.js / TS", sub: "OpenAI", icon: NodeIcon },
    { id: "javascript", label: "JavaScript", sub: "React / Fetch", icon: JsIcon },
    { id: "anthropic", label: "Anthropic", sub: "Python", icon: AnthropicIcon },
    { id: "dart", label: "Dart", sub: "Flutter", icon: DartIcon },
    { id: "php", label: "PHP", sub: "cURL / SDK", icon: PhpIcon },
    { id: "curl", label: "cURL", sub: "CLI", icon: CurlIcon },
    { id: "more", label: "More...", sub: "+20 SDKs", icon: MoreIcon, isMore: true },
  ] as const;

  const copyToClipboard = async (text: string, setter: (val: boolean) => void) => {
    const success = await copyUtil(text);
    if (success) {
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "36px",
        width: "100%",
        maxWidth: "100%",
        paddingBottom: "80px",
      }}
    >
      {/* ────────────────────────────────────────────────────────
          PAGE HEADER
          ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: isDark ? "#9ca3af" : "#64748b" }}>
          <span>Docs</span>
          <span>/</span>
          <span>Platform & Core API</span>
          <span>/</span>
          <span style={{ color: isDark ? "#ffffff" : "#0f172a", fontWeight: 600 }}>Custom API / SDK</span>
        </div>

        <h1
          style={{
            fontSize: "38px",
            fontWeight: 400,
            fontFamily: SERIF_FONT,
            letterSpacing: "-0.02em",
            color: isDark ? "#ffffff" : "#0f172a",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Custom API & SDK Integration
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: isDark ? "#9ca3af" : "#475569",
            lineHeight: 1.6,
            maxWidth: "780px",
            margin: 0,
          }}
        >
          Step-by-step specification for calling CheapRouter directly via HTTP REST or integrating through official OpenAI & Anthropic SDKs with zero architectural changes.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────────
          STEP 1: DIRECT API ENDPOINT SPECIFICATION
          ──────────────────────────────────────────────────────── */}
      <div
        id="overview"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          padding: "24px",
          borderRadius: "8px",
          backgroundColor: isDark ? "#0d0f14" : "#ffffff",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
          boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "0 2px 10px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Step Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            paddingBottom: "16px",
            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: MONO_FONT,
              }}
            >
              1
            </span>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                fontFamily: SERIF_FONT,
                color: isDark ? "#ffffff" : "#0f172a",
                margin: 0,
              }}
            >
              By Direct API
            </h2>
          </div>

          <span
            style={{
              fontSize: "11px",
              fontFamily: MONO_FONT,
              color: isDark ? "#9ca3af" : "#64748b",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            HTTP / REST Protocol
          </span>
        </div>

        {/* 1. Method, Base URL, Endpoint Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "12px",
          }}
        >
          {/* Method & Endpoint Card */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "6px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
            }}
          >
            <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b", marginBottom: "6px", fontFamily: MONO_FONT }}>
              HTTP Method & Endpoint
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "12px",
                  fontWeight: 800,
                  fontFamily: MONO_FONT,
                }}
              >
                POST
              </span>
              <code style={{ fontFamily: MONO_FONT, fontSize: "13.5px", fontWeight: 600, color: isDark ? "#ffffff" : "#0f172a" }}>
                /v1/chat/completions
              </code>
            </div>
          </div>

          {/* Base URL Card */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "6px",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b", fontFamily: MONO_FONT }}>
                Base URL
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(baseV1Url, setCopiedBaseUrl)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  background: "transparent",
                  border: "none",
                  color: copiedBaseUrl ? "#10b981" : isDark ? "#9ca3af" : "#64748b",
                  cursor: "pointer",
                  fontFamily: SERIF_FONT,
                  padding: 0,
                }}
              >
                {copiedBaseUrl ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedBaseUrl ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <code style={{ fontFamily: MONO_FONT, fontSize: "13px", fontWeight: 600, color: isDark ? "#ffffff" : "#0f172a", wordBreak: "break-all" }}>
              {baseV1Url}
            </code>
          </div>
        </div>

        {/* Required Headers */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
            fontSize: "12.5px",
            fontFamily: MONO_FONT,
            color: isDark ? "#cbd5e1" : "#334155",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div>
            <strong style={{ color: "#ef4444" }}>Authorization:</strong> Bearer &lt;YOUR_CHEAPROUTER_API_KEY&gt;
          </div>
          <div>
            <strong style={{ color: "#ef4444" }}>Content-Type:</strong> application/json
          </div>
        </div>

        {/* Payload & Response Side-by-Side Grid with Syntax Highlighting */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {/* Request Payload */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: MONO_FONT, color: isDark ? "#e2e8f0" : "#1e293b", textTransform: "uppercase" }}>
                Request Payload (JSON)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(samplePayload, setCopiedPayload)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  background: "transparent",
                  border: "none",
                  color: copiedPayload ? "#10b981" : isDark ? "#9ca3af" : "#64748b",
                  cursor: "pointer",
                  fontFamily: SERIF_FONT,
                  padding: 0,
                }}
              >
                {copiedPayload ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedPayload ? "Copied" : "Copy Payload"}</span>
              </button>
            </div>

            <div
              style={{
                borderRadius: "6px",
                backgroundColor: isDark ? "#050608" : "#f8fafc",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.1)",
                minHeight: "260px",
                overflow: "hidden",
              }}
            >
              <HighlightedCode code={samplePayload} lang="json" isDark={isDark} showLineNumbers={true} />
            </div>
          </div>

          {/* Response Demo */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: MONO_FONT, color: isDark ? "#e2e8f0" : "#1e293b", textTransform: "uppercase" }}>
                  Demo Response
                </span>
                <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 700, fontFamily: MONO_FONT }}>
                  200 OK
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(sampleResponse, setCopiedResponse)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  background: "transparent",
                  border: "none",
                  color: copiedResponse ? "#10b981" : isDark ? "#9ca3af" : "#64748b",
                  cursor: "pointer",
                  fontFamily: SERIF_FONT,
                  padding: 0,
                }}
              >
                {copiedResponse ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span>{copiedResponse ? "Copied" : "Copy Response"}</span>
              </button>
            </div>

            <div
              style={{
                borderRadius: "6px",
                backgroundColor: isDark ? "#050608" : "#f8fafc",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.1)",
                minHeight: "260px",
                overflow: "hidden",
              }}
            >
              <HighlightedCode code={sampleResponse} lang="json" isDark={isDark} showLineNumbers={true} />
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          STEP 2: SDK INTEGRATION GUIDE
          ──────────────────────────────────────────────────────── */}
      {/* Labeled Divider Line with 'For SDK' in the middle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          width: "100%",
          margin: "4px 0",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          }}
        />
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isDark ? "#9ca3af" : "#64748b",
            padding: "3px 10px",
            borderRadius: "999px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.08)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            userSelect: "none",
          }}
        >
          <Code2 size={11} color="#ef4444" />
          <span>For SDK</span>
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
          }}
        />
      </div>

      <div
        id="quick-config"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          padding: "24px",
          borderRadius: "8px",
          backgroundColor: isDark ? "#0d0f14" : "#ffffff",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
          boxShadow: isDark ? "0 4px 20px rgba(0, 0, 0, 0.3)" : "0 2px 10px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Step Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            paddingBottom: "16px",
            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: MONO_FONT,
              }}
            >
              2
            </span>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 600,
                fontFamily: SERIF_FONT,
                color: isDark ? "#ffffff" : "#0f172a",
                margin: 0,
              }}
            >
              SDK Integration Guide
            </h2>
          </div>

          <span
            style={{
              fontSize: "11px",
              fontFamily: MONO_FONT,
              color: isDark ? "#9ca3af" : "#64748b",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            Zero Extra Libraries Needed
          </span>
        </div>

        <p
          style={{
            fontSize: "14px",
            color: isDark ? "#9ca3af" : "#475569",
            lineHeight: "1.6",
            margin: 0,
          }}
        >
          Use your existing official OpenAI, Anthropic, or community SDK packages. Simply point the{" "}
          <code style={{ fontFamily: MONO_FONT, color: "#ef4444" }}>baseURL</code> to CheapRouter and provide your API key.
        </p>

        {/* SDK Language Selector Tabs with Icons & 'More...' Button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            paddingBottom: "12px",
            flexWrap: "wrap",
          }}
        >
          {sdkTabs.map((tab) => {
            const isActive = activeSdk === tab.id;
            const Icon = tab.icon;
            const isMoreTab = "isMore" in tab && tab.isMore;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSdk(tab.id as ActiveSdkKey)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: SERIF_FONT,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive
                    ? "#ffffff"
                    : isMoreTab
                    ? isDark
                      ? "#fca5a5"
                      : "#dc2626"
                    : isDark
                    ? "#e2e8f0"
                    : "#334155",
                  backgroundColor: isActive
                    ? "#ef4444"
                    : isMoreTab
                    ? isDark
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(239, 68, 68, 0.06)"
                    : isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.04)",
                  border: isActive
                    ? "1px solid #ef4444"
                    : isMoreTab
                    ? isDark
                      ? "1px solid rgba(239, 68, 68, 0.35)"
                      : "1px solid rgba(239, 68, 68, 0.28)"
                    : isDark
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isActive ? "0 2px 8px rgba(239, 68, 68, 0.3)" : "none",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} />
                </span>
                <span>{tab.label}</span>
                {isMoreTab && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "rgba(239, 68, 68, 0.18)",
                      color: isActive ? "#ffffff" : "#ef4444",
                      fontFamily: MONO_FONT,
                      fontWeight: 700,
                    }}
                  >
                    +20
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Code Snippet Box with Syntax Coloring */}
        <div
          style={{
            borderRadius: "6px",
            overflow: "hidden",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.1)",
            backgroundColor: isDark ? "#050608" : "#f8fafc",
          }}
        >
          {/* Header of snippet */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
              borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12.5px", fontFamily: MONO_FONT, fontWeight: 600, color: isDark ? "#ffffff" : "#0f172a" }}>
                {sdkSnippets[activeSdk].title}
              </span>
              <span style={{ fontSize: "11px", color: isDark ? "#9ca3af" : "#64748b", fontFamily: MONO_FONT }}>
                • {sdkSnippets[activeSdk].install}
              </span>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(sdkSnippets[activeSdk].code, setCopiedSdkCode)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                fontSize: "12px",
                fontFamily: SERIF_FONT,
                borderRadius: "4px",
                border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.12)",
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                color: copiedSdkCode ? "#10b981" : isDark ? "#e2e8f0" : "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {copiedSdkCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedSdkCode ? "Copied!" : "Copy Code"}</span>
            </button>
          </div>

          {/* Special Ecosystem Overview when 'More...' is active */}
          {activeSdk === "more" && (
            <div
              style={{
                padding: "16px 20px 14px 20px",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                backgroundColor: isDark ? "rgba(239,68,68,0.04)" : "rgba(239,68,68,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Sparkles size={16} color="#ef4444" />
                <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: SERIF_FONT, color: isDark ? "#ffffff" : "#0f172a" }}>
                  Universal OpenAI Protocol Wire-Compatibility
                </span>
              </div>
              <p style={{ fontSize: "12.5px", color: isDark ? "#9ca3af" : "#64748b", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                Any library, framework, or CLI client that allows specifying an OpenAI <code style={{ color: "#ef4444" }}>baseURL</code> is 100% plug-and-play compatible with CheapRouter:
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                  gap: "8px",
                }}
              >
                {[
                  { name: "Go", pkg: "sashabaranov/go-openai", icon: "🐹" },
                  { name: "Rust", pkg: "async-openai", icon: "🦀" },
                  { name: "C# / .NET", pkg: "Betalgo.OpenAI / Semantic Kernel", icon: "🔷" },
                  { name: "Java / Kotlin", pkg: "openai-java & Spring AI", icon: "☕" },
                  { name: "Ruby", pkg: "ruby-openai", icon: "💎" },
                  { name: "Swift / iOS", pkg: "MacPaw/OpenAI", icon: "🍎" },
                  { name: "LangChain", pkg: "Python & TypeScript", icon: "🦜" },
                  { name: "LlamaIndex", pkg: "Universal Indexing", icon: "🦙" },
                ].map((item) => (
                  <div
                    key={item.name}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "4px",
                      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                      border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 600, color: isDark ? "#f3f4f6" : "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </div>
                    <div style={{ fontSize: "10.5px", color: isDark ? "#9ca3af" : "#64748b", fontFamily: MONO_FONT }}>
                      {item.pkg}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color-Coded Syntax Highlighted Code */}
          <HighlightedCode
            code={sdkSnippets[activeSdk].code}
            lang={sdkSnippets[activeSdk].lang}
            isDark={isDark}
            showLineNumbers={true}
          />
        </div>
      </div>
    </motion.div>
  );
}
