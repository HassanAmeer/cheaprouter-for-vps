"use client";

import { useState } from "react";
import Card from "@/shared/components/Card";
import Button from "@/shared/components/Button";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useDisplayBaseUrl } from "@/shared/hooks";

type DocTab = "user-keys" | "byok-keys" | "providers" | "models" | "chat";
type CodeLang = "curl" | "js" | "python";

export default function ApiDocsIntegrationHub() {
  const [activeTab, setActiveTab] = useState<DocTab>("user-keys");
  const [activeLang, setActiveLang] = useState<CodeLang>("curl");
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
              Reseller Website Integration APIs & Documentation
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-500">
              Live Endpoints
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Apni reseller website ko CheapRouter ke sath connect karne ke liye tamam zaroori CRUD
            endpoints, request bodies, aur code examples.
          </p>
        </div>

        {/* Global Language Selector */}
        <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-lg border border-border self-start md:self-auto">
          {(["curl", "js", "python"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md uppercase transition ${
                activeLang === lang
                  ? "bg-action text-white shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {lang === "js" ? "JavaScript" : lang === "python" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mt-4 pb-2 border-b border-border/60">
        <button
          onClick={() => setActiveTab("user-keys")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "user-keys"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">vpn_key</span>
          1. Issue & Manage User Keys
        </button>

        <button
          onClick={() => setActiveTab("byok-keys")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "byok-keys"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">key</span>
          2. User BYOK Provider Keys
        </button>

        <button
          onClick={() => setActiveTab("providers")}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === "providers"
              ? "bg-action text-white shadow-xs"
              : "bg-surface-raised hover:bg-surface-raised/80 text-text-muted hover:text-text-primary border border-border"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">hub</span>
          3. Allowed Providers & Icons
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
          5. Chat Completions AI Proxy
        </button>
      </div>

      {/* Tab 1: User Account & Quota Management */}
      {activeTab === "user-keys" && (
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              User Account, Quota Management & Key Issuance (CRUD)
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Aapki reseller website naye users ko register karegi, unka quota set/update karegi,
              aur keys issue karegi. Quota <strong>User ID (UID)</strong> ke account pool par lock
              rehta hai, chahe user 1 key banaye ya 5 keys banaye.
            </p>
          </div>

          {/* 1.1 Register User on Signup */}
          <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-xs font-mono">
                  POST
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  (1.1 Register User / Free Signup)
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(`${baseUrl}/api/v1/reseller/users`)}
                className="h-7 text-xs"
              >
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>

            <p className="text-xs text-text-muted">
              Jab naya user aapki site par sign up kare, initial free quota ke sath user create karein.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Request JSON Body:
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "action": "upsertUser",
  "userId": "usr_1001",
  "userName": "Hasan Ali",
  "userEmail": "hasan@example.com",
  "plan": "Free",
  "tokenBudget": 10,
  "rpmLimit": 30
}`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Response (200 OK):
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "success": true,
  "user": {
    "id": "usr_1001",
    "name": "Hasan Ali",
    "email": "hasan@example.com",
    "planTier": "Free",
    "tokenBudget": 10,
    "tokensUsed": 0,
    "rpmLimit": 30,
    "isBanned": false,
    "keysCount": 0
  }
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* 1.2 Update Quota on Plan Purchase */}
          <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-xs font-mono">
                  POST / PATCH
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users
                </span>
                <span className="text-xs text-blue-400 font-medium">
                  (1.2 Plan Purchase / Upgrade Quota)
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(`${baseUrl}/api/v1/reseller/users`)}
                className="h-7 text-xs"
              >
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>

            <p className="text-xs text-text-muted">
              Jab user Pro/VIP plan purchase kare ya admin quota barhaye. Nayi billing cycle par tokens reset karne ke liye <code>&quot;resetUsage&quot;: true</code> bhejein.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Request JSON Body:
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "action": "updateQuota",
  "userId": "usr_1001",
  "plan": "Pro",
  "tokenBudget": 50000000,
  "rpmLimit": 60,
  "modelQuotas": {
    "openai/gpt-4o": 25000000,
    "claude-3-5-sonnet": 25000000
  },
  "resetUsage": false
}`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Response:
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "success": true,
  "user": {
    "id": "usr_1001",
    "planTier": "Pro",
    "tokenBudget": 50000000,
    "tokensUsed": 15000000,
    "rpmLimit": 60,
    "modelQuotas": {
      "openai/gpt-4o": 25000000,
      "claude-3-5-sonnet": 25000000
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* 1.3 Issue API Key */}
          <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold text-xs font-mono">
                  POST
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users
                </span>
                <span className="text-xs text-purple-400 font-medium">
                  (1.3 Issue API Key for User)
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              User apne portal par key create kare. Yeh key user ke shared account quota se connect hoti hai.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "userId": "usr_1001",
  "userName": "Hasan Ali",
  "userEmail": "hasan@example.com",
  "plan": "Pro"
}`}
                </pre>
              </div>

              <div>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "success": true,
  "apiKey": "sk-cc835689c755e1c0-daa8ef-259ca21c"
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* 1.4 Ban / Unban User & 1.5 List & 1.6 Delete & 1.7 Lookup */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1.4 Ban / Unban */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold text-xs font-mono">
                  PATCH
                </span>
                <span className="font-mono text-xs text-text-primary">
                  1.4 Ban / Active Toggle
                </span>
              </div>
              <p className="text-xs text-text-muted">
                User ko block/unblock karein (tamam keys par foran effect hota hai):
              </p>
              <pre className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`await fetch("${baseUrl}/api/v1/reseller/users", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "setBanStatus",
    userId: "usr_1001",
    isBanned: true
  })
});`}
              </pre>
            </div>

            {/* 1.5 GET Users List */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-xs font-mono">
                  GET
                </span>
                <span className="font-mono text-xs text-text-primary">
                  1.5 List Users & Quotas
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Users, remaining quotas, model usage breakdown aur keys count:
              </p>
              <pre className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`const res = await fetch("${baseUrl}/api/v1/reseller/users");
const { users, byokKeys } = await res.json();
// users[0].modelUsage: [{model, tokensUsed, requests}]`}
              </pre>
            </div>

            {/* 1.6 DELETE User */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold text-xs font-mono">
                  DELETE
                </span>
                <span className="font-mono text-xs text-text-primary">
                  1.6 Delete User
                </span>
              </div>
              <p className="text-xs text-text-muted">
                User aur uski tamam keys delete karne ke liye:
              </p>
              <pre className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`await fetch("${baseUrl}/api/v1/reseller/users?userId=usr_1001", {
  method: "DELETE"
});`}
              </pre>
            </div>

            {/* 1.7 GET Single User Profile */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-xs font-mono">
                  GET
                </span>
                <span className="font-mono text-xs text-text-primary">
                  1.7 Single User Profile
                </span>
              </div>
              <p className="text-xs text-text-muted">
                User ka live quota balance, BYOK keys aur API keys check karein:
              </p>
              <pre className="p-2.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`const res = await fetch("${baseUrl}/api/v1/reseller/users?userId=usr_1001");
const { user } = await res.json();
// user.byokKeys, user.userKeys, user.tokensUsed`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: BYOK Provider Keys */}
      {activeTab === "byok-keys" && (
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              User BYOK (Bring Your Own Key) Management
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Jab user aapki reseller website par kisi specific provider (maslan OpenAI, Claude,
              Gemini) ke sath apni personal API key jorna chahe ya usko pause/resume/delete karna
              chahe.
            </p>
          </div>

          {/* Sub-section: Attach BYOK Key */}
          <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-xs font-mono">
                  POST
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users
                </span>
                <span className="text-xs text-amber-400 font-medium">(action: &quot;addByok&quot;)</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(`${baseUrl}/api/v1/reseller/users`)}
                className="h-7 text-xs"
              >
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>

            <p className="text-xs text-text-muted">
              Aap <code>apiKey</code> ya <code>maskedKey</code> bhej sakte hain. CheapRouter key ko
              automatic mask karke database mein user profile ke sath attach karega.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Request JSON Body:
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "action": "addByok",
  "userId": "usr_1001",
  "userName": "Hasan Ali",
  "userEmail": "hasan@example.com",
  "providerId": "anthropic",
  "apiKey": "sk-ant-api03-abcdef...1234"
}`}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Response (201 Created):
                </span>
                <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`{
  "success": true,
  "key": {
    "id": 4,
    "userId": "usr_1001",
    "providerId": "anthropic",
    "maskedKey": "sk-ant...1234",
    "isPaused": false,
    "requests": 0,
    "tokens": 0,
    "createdAt": "2026-10-15T18:00:00.000Z"
  }
}`}
                </pre>
              </div>
            </div>

            {/* Code example */}
            <div>
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                {activeLang.toUpperCase()} Code Example:
              </span>
              <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-xs text-text-primary overflow-x-auto">
                {activeLang === "curl" &&
`curl -X POST ${baseUrl}/api/v1/reseller/users \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "addByok",
    "userId": "usr_1001",
    "userName": "Hasan Ali",
    "userEmail": "hasan@example.com",
    "providerId": "anthropic",
    "apiKey": "sk-ant-api03-abcdef...1234"
  }'`}
                {activeLang === "js" &&
`const response = await fetch("${baseUrl}/api/v1/reseller/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "addByok",
    userId: "usr_1001",
    userName: "Hasan Ali",
    userEmail: "hasan@example.com",
    providerId: "anthropic",
    apiKey: "sk-ant-api03-abcdef...1234"
  })
});
const data = await response.json();`}
                {activeLang === "python" &&
`import requests

url = "${baseUrl}/api/v1/reseller/users"
payload = {
    "action": "addByok",
    "userId": "usr_1001",
    "providerId": "anthropic",
    "apiKey": "sk-ant-api03-abcdef...1234"
}
res = requests.post(url, json=payload)
print(res.json())`}
              </pre>
            </div>
          </div>

          {/* Sub-section: Pause / Resume & Delete BYOK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* POST / PATCH Pause / Resume */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold text-xs font-mono">
                  POST / PATCH
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users
                </span>
              </div>
              <p className="text-xs text-text-muted">
                User ki BYOK key ko temporarily pause ya resume karein bina key delete kiye:
              </p>
              <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`await fetch("${baseUrl}/api/v1/reseller/users", {
  method: "POST", // ya PATCH
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "pauseByok",
    userId: "usr_1001",
    providerId: "anthropic",
    paused: true // ya false (resume karne ke liye)
  })
});`}
              </pre>
            </div>

            {/* DELETE / POST Delete BYOK Key */}
            <div className="p-4 rounded-xl border border-border bg-surface-raised/40 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-bold text-xs font-mono">
                  DELETE / POST
                </span>
                <span className="font-mono text-xs text-text-primary">
                  {baseUrl}/api/v1/reseller/users?byokId=...
                </span>
              </div>
              <p className="text-xs text-text-muted">
                User ki attached key ko disconnect ya delete karne ke liye row ID ya user+provider
                bhejein:
              </p>
              <pre className="p-3 rounded-lg bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto">
{`// Delete specific user's provider key:
await fetch("${baseUrl}/api/v1/reseller/users?userId=usr_1001&providerId=anthropic", {
  method: "DELETE"
});

// Or delete by row ID:
await fetch("${baseUrl}/api/v1/reseller/users?byokId=4", {
  method: "DELETE"
});`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Allowed Providers & Icons */}
      {activeTab === "providers" && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Allowed Providers & Official SVG Icons API
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Aapki reseller website ka frontend is API ko call karke un tamam providers ki list aur
              unke official SVG icons dikha sakta hai jo aapne Providers Page (Tab 5) mein allow
              kiye hain.
            </p>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
              GET
            </span>
            <span className="text-text-primary">{baseUrl}/api/v1/public/providers</span>
            <div className="ml-auto">
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
                Frontend Usage Example:
              </span>
              <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`const res = await fetch("${baseUrl}/api/v1/public/providers");
const data = await res.json();

// Renders icons and provider selection cards on your site:
data.providers.forEach(p => {
  console.log(p.id, p.name, p.iconUrl, p.status);
});`}
              </pre>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1">
                Sample Response JSON:
              </span>
              <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto max-h-[160px]">
{`{
  "success": true,
  "count": 3,
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "iconUrl": "${baseUrl}/providers/openai.svg",
      "status": "connected"
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "iconUrl": "${baseUrl}/providers/anthropic.svg",
      "status": "connected"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Models & Combos Catalog */}
      {activeTab === "models" && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Available Models & Combos Catalog (OpenAI Compatible)
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Standard OpenAI models endpoint jo user ki API key ke permissions aur operator ke
              active combos/models ke mutabiq available models return karta hai.
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
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(`${baseUrl}/v1/models`)}
                className="h-6 text-xs"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`curl ${baseUrl}/v1/models \\
  -H "Authorization: Bearer sk-your-user-key"`}
          </pre>
        </div>
      )}

      {/* Tab 5: Chat Completions AI Proxy */}
      {activeTab === "chat" && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Chat Completions Endpoint (Core AI Proxy)
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Aapke users Cursor, Cline, LibreChat, Next.js, ya kisi bhi OpenAI SDK ke zariye
              requests bhej sakte hain. Router check karta hai: agar user ne apni BYOK key lagayi
              hui hai to uski key se upstream bhejta hai, warna CheapRouter ke combos se execute
              karta hai.
            </p>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-raised border border-border font-mono text-xs">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">
              POST
            </span>
            <span className="text-text-primary">{baseUrl}/v1/chat/completions</span>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(`${baseUrl}/v1/chat/completions`)}
                className="h-6 text-xs"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <pre className="p-3 rounded-lg bg-surface-raised border border-border font-mono text-xs text-text-primary overflow-x-auto">
{`curl -X POST ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-user-key" \\
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'`}
          </pre>
        </div>
      )}
    </Card>
  );
}
