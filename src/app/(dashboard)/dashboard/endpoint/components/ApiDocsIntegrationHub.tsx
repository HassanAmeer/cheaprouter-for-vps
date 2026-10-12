"use client";

import { useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useDisplayBaseUrl } from "@/shared/hooks";

type DocTab = "providers" | "keys" | "token-limits" | "models" | "chat";

export default function ApiDocsIntegrationHub() {
  const [activeTab, setActiveTab] = useState<DocTab>("providers");
  const displayBaseUrl = useDisplayBaseUrl();
  const { copy, copied } = useCopyToClipboard();

  const baseUrl = displayBaseUrl || "http://localhost:20128";

  return (
    <Card className="mt-6 border border-border/80 bg-surface">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-action text-2xl">menu_book</span>
            <h2 className="text-lg font-bold text-text-primary">
              Website Integration APIs & Documentation
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-500">
              Developer Hub
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Apni website ko CheapRouter ke sath connect karne ke liye tamam zaroori endpoints,
            request payloads aur code examples.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mt-4 pb-2 border-b border-border/60">
        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "providers"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">public</span>
          1. Showcase Providers API
        </button>

        <button
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "keys"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">vpn_key</span>
          2. Generate API Keys (User Plans)
        </button>

        <button
          onClick={() => setActiveTab("token-limits")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "token-limits"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">speed</span>
          3. Per-Model Token Limits
        </button>

        <button
          onClick={() => setActiveTab("models")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "models"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">view_list</span>
          4. Models & Combos Catalog
        </button>

        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "chat"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">chat</span>
          5. Chat Completions Proxy
        </button>
      </div>

      {/* Content based on activeTab */}
      <div className="mt-4">
        {/* 1. Showcase Providers */}
        {activeTab === "providers" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Get Showcase Providers (With Official SVG Icons)
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Aapki website ka frontend ya backend is API ko call karke un tamam providers ki list
                aur unke SVG icons hasil kar sakta hai jo aapne showcase karne ke liye select kiye
                hain.
              </p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                GET
              </span>
              <span className="text-text-primary">{baseUrl}/api/v1/public/providers</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(`${baseUrl}/api/v1/public/providers`)}
                  className="h-6 text-xs"
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  JavaScript / Fetch Example:
                </span>
                <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`const res = await fetch("${baseUrl}/api/v1/public/providers");
const data = await res.json();

// data.providers list:
data.providers.forEach(p => {
  console.log(p.name, p.iconUrl, p.status);
});`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Sample JSON Response:
                </span>
                <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto max-h-[160px]">
{`{
  "success": true,
  "count": 3,
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "icon": "/providers/openai.svg",
      "iconUrl": "${baseUrl}/providers/openai.svg",
      "status": "connected",
      "modelsCount": 12
    },
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "icon": "/providers/deepseek.svg",
      "iconUrl": "${baseUrl}/providers/deepseek.svg",
      "status": "connected",
      "modelsCount": 4
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 2. Generate API Keys */}
        {activeTab === "keys" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Programmatic API Key Generation (User Purchases Plan)
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Jab user aapki website par Free, Pro, ya Premium plan purchase kare, aapki website
                ka backend CheapRouter ki is API ko call karke user ke liye restricted key issue
                karega.
              </p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
                POST
              </span>
              <span className="text-text-primary">{baseUrl}/api/keys</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(`${baseUrl}/api/keys`)}
                  className="h-6 text-xs"
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Request JSON Body (Pro Plan Example):
                </span>
                <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "name": "User_John_Pro_Plan",
  "modelAccessMode": "restricted",
  "allowedModels": [
    "gpt-4o",
    "claude-3-5-sonnet",
    "deepseek-chat"
  ],
  "expiresAt": "2026-11-15T00:00:00Z",
  "usageLimitEnabled": true,
  "dailyUsageLimitUsd": 5.00,
  "noLog": true
}`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Generated Response:
                </span>
                <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "id": "key_uuid_here",
  "key": "cr-xxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "User_John_Pro_Plan",
  "expiresAt": "2026-11-15T00:00:00Z",
  "modelAccessMode": "restricted",
  "allowedModels": ["gpt-4o", "claude-3-5-sonnet", ...]
}`}
                </pre>
                <p className="text-[11px] text-text-muted mt-2">
                  * User ko yeh generated <code>key</code> aur aapka Base URL (
                  <code>{baseUrl}/v1</code>) provide kar dein.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Per-Model Token Limits */}
        {activeTab === "token-limits" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Per-Model Token Limits (GPT: 20M, Claude: 10M, DeepSeek: 50M)
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Aap har user ki key ke liye alag alag models par specific monthly ya daily token
                limits laga sakte hain.
              </p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
                POST
              </span>
              <span className="text-text-primary">{baseUrl}/api/usage/token-limits</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Request Payload (Per-Model Limit):
                </span>
                <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "apiKeyId": "<KEY_ID_FROM_STEP_2>",
  "scopeType": "model",
  "scopeValue": "deepseek-chat",
  "tokenLimit": 50000000,
  "resetInterval": "monthly",
  "resetTime": "00:00",
  "enabled": true
}`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Multi-Model Strategy:
                </span>
                <div className="p-3 rounded-lg bg-surface-raised border border-border text-xs text-text-muted space-y-2">
                  <div>
                    <strong className="text-text-primary">ChatGPT:</strong> Set{" "}
                    <code>scopeValue: &quot;gpt-4o&quot;</code>, <code>tokenLimit: 20000000</code> (20M)
                  </div>
                  <div>
                    <strong className="text-text-primary">Claude:</strong> Set{" "}
                    <code>scopeValue: &quot;claude-3-5-sonnet&quot;</code>, <code>tokenLimit: 10000000</code>{" "}
                    (10M)
                  </div>
                  <div>
                    <strong className="text-text-primary">DeepSeek:</strong> Set{" "}
                    <code>scopeValue: &quot;deepseek-chat&quot;</code>, <code>tokenLimit: 50000000</code> (50M)
                  </div>
                  <p className="text-[11px] text-emerald-500 mt-2">
                    ✓ Jab limit khatam hogi, router automatic user ko 429 Quota Exceeded bhej dega.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Models Catalog */}
        {activeTab === "models" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Available Models & Combos (OpenAI Compatible)
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Standard OpenAI models endpoint jo user ki API key ke mutabiq sirf unhi models ko
                return karega jo us key ke liye allowed hain.
              </p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                GET
              </span>
              <span className="text-text-primary">{baseUrl}/v1/models</span>
              <span className="text-[10px] text-text-muted ml-2">
                Header: Authorization: Bearer &lt;USER_API_KEY&gt;
              </span>
            </div>

            <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`curl ${baseUrl}/v1/models \\
  -H "Authorization: Bearer cr-your-api-key"`}
            </pre>
          </div>
        )}

        {/* 5. Chat Completions */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Chat Completions Endpoint (Core Proxy)
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Aapke customers Cursor, Cline, LibreChat, Next.js ya kisi bhi OpenAI SDK mein yeh
                endpoint use kar sakte hain.
              </p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
                POST
              </span>
              <span className="text-text-primary">{baseUrl}/v1/chat/completions</span>
            </div>

            <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer cr-your-api-key" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'`}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
