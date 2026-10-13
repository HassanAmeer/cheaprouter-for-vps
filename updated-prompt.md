# 🚀 CHEAPROUTER — UPDATED MASTER PROMPT (A TO Z FINAL)
> Last Updated: 2026-10-13
> Ecosystem: **CheapRouter** (VPS AI Core Gateway) + **reseller-models** (Reseller Web Platform)

---

## 🚨 CRITICAL DIRECTIVES (READ FIRST)

1. **Fix Commit `d5d8c33` (`ProviderTabs.tsx`):**
   Previous AI made auth-category pills (API Key, OAuth, Free, Compatible, All). **WRONG!**
   Replace with exact **5 Tabs**:
   `All Providers` | `Connected Providers` | `Unconnected Providers` | `Manage Models` | `Reseller API Manage Providers`

2. **Audit Before Building:**
   Existing partials: `resellerUsers.ts`, `ByokMasterToggleCard.tsx`, `ApiDocsIntegrationHub.tsx`, `combo.ts`, `apiKeys.ts`.
   **Extend/polish existing code — do NOT reinvent the wheel.**

3. **Design Aesthetic:**
   Minimalist Dark Mode. **Silver (#C0C0C0), White (#FFFFFF), Deep Black (#0A0A0A)** only.
   Zero neon/glassmorphism. OpenCode-style clean UI.

4. **No Raw SQL** — always use `src/lib/db/*` domain modules.

---

## ✅ IMPLEMENTATION STATUS TRACKER

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 1 | Sidebar: Remove model-catalog duplicate | ⏳ TODO | sections.ts |
| 1 | Sidebar: Correct sort order | ✅ DONE | sections.ts |
| 2 | Providers Page: Replace auth-pills with 5-Tab architecture | ✅ DONE | ProviderTabs.tsx, useProviderTabs.ts |
| 3 | Provider Details Page: Clean-up + Fetch Models + Manual Add | ⏳ TODO | providers/[id]/page.tsx |
| 4 | Users Page: Accordion + BYOK inspection + Quota analytics | ⏳ TODO | users/page.tsx, resellerUsers.ts |
| 5 | Combos Page: Simplify UI, 2 core strategy switches | ⏳ TODO | combos/page.tsx |
| 6 | API Keys: Per-model quota enforcement | ⏳ TODO | chatCore.ts, apiKeys.ts |
| 7 | BYOK: Stateless pass-through with Master ON/OFF switch | ⏳ TODO | chatCore.ts |
| 8 | reseller-models: Full Next.js app (SQLite, Auth, Admin, User, Landing) | ⏳ TODO | /reseller-models/ |

---

## 1. SIDEBAR NAVIGATION (sections.ts)
Target: src/shared/constants/sidebarVisibility/sections.ts

### Required Final Order (Top to Bottom):

```
[No Section Header - showTitle: false]
  Home             /home
  Users            /dashboard/users
  Usage            /dashboard/usage

[Section: CheapProxy]
  Providers        /dashboard/providers
  Combos           /dashboard/combos
  API Keys         /dashboard/api-manager
  REMOVE: model-catalog (/dashboard/models) — DELETE PERMANENTLY

[Section: API]
  API Endpoints    /dashboard/endpoint
  API Docs         /dashboard/endpoint/api-reference

[Section: Info]
  Costs/Pricing    /dashboard/costs/pricing
  Free Rankings    /dashboard/free-provider-rankings

[Section: Dev Tools]
  Logs             /dashboard/logs
  Proxy Logs       /dashboard/logs/proxy
  Console Logs     /dashboard/logs/console

[No Section Header - showTitle: false]
  Theme            /dashboard/settings/appearance
```

### Current Issues in sections.ts to Fix:
- OMNI_PROXY_ITEMS has model-catalog entry → DELETE IT
- OMNI_PROXY_ITEMS order wrong: api-manager first, providers second → providers should be first
- SIDEBAR_SECTIONS order wrong: cheap-proxy before top standalone items
- usage is in COSTS_ITEMS under Info → move to top standalone section
- multi-tenant section has its own label "Reseller" → merge into top standalone (no label)
- API section is at bottom → move between CheapProxy and Info
- settings section has label "Setting" → make standalone (showTitle: false)

---

## 2. PROVIDERS PAGE: 5-TAB ARCHITECTURE
Target: ProviderTabs.tsx, useProviderTabs.ts, providers/page.tsx

Remove: Auth-category pills (API Key, OAuth, Free, Compatible, All)

Replace with 5 tabs:
1. All Providers — 370+ providers directory, search bar, filter chips
2. Connected Providers — credentialed/active providers only
3. Unconnected Providers — non-configured providers with "Connect" CTA
4. Manage Models — active providers' models, checkbox activation, aliases, live test
5. Reseller API — provider exposure toggles + Master BYOK ON/OFF switch

### Tab 4 — Manage Models Details:
- Collapsible provider groups
- Checkbox per model (only checked = active downstream)
- Copy icon next to each Model ID
- FREE / PAID badge + manual toggle override
- Capability badges: Context Window (1M, 128K), Modalities (Reasoning, Vision, Audio, Code, Tools, STT, TTS)
- Test button per model with inline response preview:
  - Success: Green "Verified" badge + HTTP 200 + response preview
  - Error: Red "Failed" badge + status code + error message
- Custom Alias fields (when model is checked):
  - Original Name (read-only)
  - Custom Display Name (editable)
  - Original API Model ID (read-only)
  - Custom API Call ID / Alias (editable)
- DB Table: provider_model_customizations
  - Columns: provider_id, original_model_id, custom_name, custom_alias, is_active, is_tested, context_window, capabilities
- Integrate with resolveModelAlias routing logic

### Tab 5 — Reseller API Details:
- Provider checkboxes → exposed via GET /api/v1/public/providers
- Master BYOK Toggle ON/OFF:
  - ON → reseller users can send x-upstream-key header
  - OFF → returns {"error": "BYOK is currently disabled by administrator"}

---

## 3. PROVIDER DETAILS PAGE (/dashboard/providers/[id])
Target: providers/[id]/page.tsx

- Remove all unnecessary clutter, keep: Connectivity + Models Studio only
- "Fetch All Models" button → live fetch from upstream provider API
  - If fails → orange alert: "Failed to fetch models from API. Please add models manually."
- Manual Add Model form:
  - Fields: Model Name, Model ID, Context Window, Capabilities (multi-select)
  - "Add Model" button appends to table
- Models Table columns: Active checkbox | Model ID (+ copy) | FREE/PAID badge | Context Window | Capabilities icons | Test button

---

## 4. USERS PAGE (/dashboard/users)
Target: users/page.tsx, resellerUsers.ts, reseller/users/route.ts

- Accordion/card list: Name, Email, Plan Tier, Registered Date
- Expand → user's BYOK keys: Provider Name, Masked Key, Date Added
- Pause / Resume toggle per BYOK provider key
- Quota & Usage analytics: tokens used, remaining balance, RPM, live charts

---

## 5. COMBOS PAGE (/dashboard/combos)
Target: combos/page.tsx

Simplify the 5,116-line cluttered UI:
- Custom Combo Name / ID (used as `model` param, e.g. auto-coding-combo)
- Candidate Models — multi-select from Manage Models active models only
- Two Core Strategy Switches:
  1. Auto Failover: Priority sequence (4-6 models). On timeout/429/500 → next model
  2. Random: Each request → random pick from candidates
- Best Model Combo — curated high-perf panel

---

## 6. API KEYS — STRICT MODEL-LEVEL QUOTA
Target: chatCore.ts, apiKeys.ts, api/keys/route.ts

Programmatic Creation (POST /api/keys):
```json
{
  "name": "User1-Pro-Plan",
  "allowedModels": ["glm-5.3_flash", "deepseek-r1", "gemini-2.5-flash"],
  "modelLimits": {
    "glm-5.3_flash": { "maxTokens": 100000000 },
    "deepseek-r1": { "maxTokens": 50000000 }
  },
  "rateLimits": { "requestsPerMinute": 30 },
  "expiresAt": "2026-11-12T00:00:00Z"
}
```

Per-Model Quota Enforcement:
- Model A limit reached → reject: {"error": "Limit reached for this model. Please check another available model to continue."}
- Model B NOT blocked if it still has quota
- Sliding window RPM limiter
- /v1/models public, returns all active models; enforcement at execution time (403 on unallowed)

---

## 7. BYOK STATELESS PASS-THROUGH
Target: chatCore.ts

Flow:
1. Reseller user stores keys in reseller-models DB
2. On chat request → passes x-upstream-key: <key> header
3. CheapRouter checks Master BYOK toggle:
   - OFF → {"error": "BYOK is disabled"}
   - ON → inject user's header key to upstream (bypass VPS default key); deduct 0 tokens from plan
4. User can use all active models of the provider whose key they supplied

---

## 8. RESELLER-MODELS WEB APP
Target: /home/hasan/Documents/reactjs/cheaprouter/reseller-models/

Stack: Next.js (standalone) + SQLite3 (reseller.db)
DB Tables: users, plans, user_subscriptions, user_byok_keys, settings

Pre-seeded Accounts:
| Role  | Credential              |
|-------|-------------------------|
| Admin | admin / 1234            |
| User1 | user1@gmail.com / 1234  |
| User2 | user2@gmail.com / 1234  |

Design: Minimalist Dark — Silver + White + Deep Black. Zero neon.

Landing Page (/)
- Hero: high-speed AI Gateway pitch
- Live Models Catalog (from GET /api/v1/public/providers — SVG icons)
- Pricing Table: Free / Pro / Premium

Admin Panel (/admin)
- Plans Configuration Studio (models, token budgets 10M/50M/100M, RPM, validity)
- Users Management Table → assign plan → auto-calls POST /api/keys on CheapRouter

User Dashboard (/dashboard)
- Active Subscription Card: plan name, token progress bar, expiry countdown
- API Key section: copy + regenerate
- BYOK Keys Manager (visible when Master BYOK = ON): add/pause/resume keys
- Live Analytics: RPM meter + daily usage charts

---

## 📋 IMPLEMENTATION ORDER (Recommended)

Step 1: sections.ts — Sidebar sort fix + remove model-catalog     [QUICKEST WIN]
Step 2: ProviderTabs.tsx + useProviderTabs.ts — 5-tab replace      [HIGH PRIORITY]
Step 3: providers/[id]/page.tsx — Details page clean-up            [MEDIUM]
Step 4: users/page.tsx — Users accordion + BYOK inspection         [MEDIUM]
Step 5: combos/page.tsx — Simplified UI                            [MEDIUM]
Step 6: apiKeys.ts + chatCore.ts — Per-model quota enforcement     [BACKEND]
Step 7: chatCore.ts — BYOK pass-through logic                      [BACKEND]
Step 8: /reseller-models — Full new app init + seed + pages        [LARGEST]

---

## 🔗 KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| src/shared/constants/sidebarVisibility/sections.ts | Sidebar structure |
| src/app/(dashboard)/dashboard/providers/components/ProviderTabs.tsx | Provider tabs UI |
| src/app/(dashboard)/dashboard/providers/hooks/useProviderTabs.ts | Tab config hook |
| src/app/(dashboard)/dashboard/providers/[id]/page.tsx | Provider detail page |
| src/app/(dashboard)/dashboard/users/page.tsx | Users management page |
| src/app/(dashboard)/dashboard/combos/page.tsx | Combos page |
| src/lib/db/apiKeys.ts | API key domain module |
| src/lib/db/resellerUsers.ts | Reseller users domain module |
| open-sse/handlers/chatCore.ts | Core request handler (quota + BYOK) |
| src/app/api/keys/route.ts | API key creation endpoint |
| src/app/api/v1/reseller/users/route.ts | Reseller users API |
