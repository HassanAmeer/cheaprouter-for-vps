# 🚀 CHEAPROUTER — UPDATED MASTER PROMPT (A TO Z FINAL)
> Last Updated: 2026-10-13
> Ecosystem: **CheapRouter** (VPS AI Core Gateway) + **reseller-models** (Reseller Web Platform)

---

## 🚨 CRITICAL DIRECTIVES (READ FIRST)

1. **Audit Before Building:**
   Existing partials already in codebase: `resellerUsers.ts`, `ByokMasterToggleCard.tsx`,
   `ApiDocsIntegrationHub.tsx`, `combo.ts`, `apiKeys.ts`.
   **Extend/polish existing code — do NOT reinvent the wheel.**

2. **Design Aesthetic:**
   Minimalist Dark Mode. **Silver (#C0C0C0), White (#FFFFFF), Deep Black (#0A0A0A)** only.
   Zero neon/glassmorphism. OpenCode-style clean UI.

3. **No Raw SQL** — always use `src/lib/db/*` domain modules.

4. **Error sanitization** — all error responses must go through `buildErrorBody()` or
   `sanitizeErrorMessage()` from `open-sse/utils/error.ts`. Never expose raw `err.stack`.

5. **TypeScript strict** — no new `any` types in `open-sse/` or `tests/`. Fix ESLint issues.

---

## ✅ IMPLEMENTATION STATUS TRACKER

| # | Task | Status | Files |
|---|------|--------|-------|
| 1a | Sidebar: Remove model-catalog duplicate | ✅ DONE | sections.ts, types.ts, sidebarVisibility.ts |
| 1b | Sidebar: Correct sort order (Home/Users/Usage top; CheapProxy; API; Info; Dev Tools; Theme bottom) | ✅ DONE | sections.ts |
| 1c | Sidebar: Fix SidebarSectionId type (add top/info/bottom) | ✅ DONE | types.ts |
| 2 | Providers Page: Replace auth-pills with 5-Tab architecture | ✅ DONE | ProviderTabs.tsx, useProviderTabs.ts, page.tsx |
| 3a | Provider Details: Fetch All Models button + orange fallback alert | ⏳ TODO | ProviderDetailPageClient.tsx |
| 3b | Provider Details: Manual Add Model form (Name, ID, Context, Capabilities) | ⏳ TODO | ProviderDetailPageClient.tsx |
| 3c | Provider Details: Models table (Active cb, ID copy, FREE/PAID, Context, Caps, Test) | ⏳ TODO | ProviderDetailPageClient.tsx |
| 4 | Users Page: Accordion + BYOK inspection + Quota analytics | ✅ DONE (already existed) | users/page.tsx |
| 5a | Combos Page: Simplify 5,116-line UI — Custom Combo Name/ID | ⏳ TODO | combos/page.tsx |
| 5b | Combos Page: Candidate Models from Manage Models active list only | ⏳ TODO | combos/page.tsx |
| 5c | Combos Page: Auto Failover switch + Random switch (2 core strategies) | ⏳ TODO | combos/page.tsx |
| 6a | DB Migration: provider_model_customizations table | ⏳ TODO | src/lib/db/migrations/ |
| 6b | Manage Models Tab 4: Checkbox selection, FREE/PAID badge, Copy ID, Capability badges | ⏳ TODO | New component under providers/ |
| 6c | Manage Models Tab 4: Live Test button with inline preview (Verified/Failed) | ⏳ TODO | New component under providers/ |
| 6d | Manage Models Tab 4: Custom alias fields (Display Name + API Call ID) | ⏳ TODO | New component under providers/ |
| 6e | Manage Models Tab 4: Integrate with resolveModelAlias routing logic | ⏳ TODO | open-sse/translator/ or handlers/ |
| 7a | Reseller API Tab 5: Provider exposure checkboxes (GET /api/v1/public/providers) | ⏳ TODO | New component + API route |
| 7b | Reseller API Tab 5: Master BYOK ON/OFF toggle (reuse ByokMasterToggleCard.tsx) | ⏳ TODO | Tab 5 panel |
| 8a | API Keys: Per-model quota schema (allowedModels, modelLimits, rateLimits, expiresAt) | ⏳ TODO | apiKeys.ts, DB migration |
| 8b | API Keys: Enforce per-model token limit (reject only exhausted model, not others) | ⏳ TODO | chatCore.ts |
| 8c | API Keys: Sliding window RPM limiter | ⏳ TODO | chatCore.ts |
| 8d | API Keys: /v1/models public listing (403 on unallowed at execution time only) | ⏳ TODO | models route |
| 9a | BYOK Pass-through: Check Master toggle before injecting x-upstream-key header | ⏳ TODO | chatCore.ts |
| 9b | BYOK Pass-through: 0-token deduction when BYOK key is used | ⏳ TODO | chatCore.ts |
| 10 | reseller-models: Init Next.js standalone app + SQLite reseller.db | ⏳ TODO | /reseller-models/ |
| 10a | reseller-models: Seed DB (admin/1234, user1@gmail.com/1234, user2@gmail.com/1234) | ⏳ TODO | /reseller-models/ |
| 10b | reseller-models: Admin Panel (/admin) — Plans Studio + Users Table | ⏳ TODO | /reseller-models/ |
| 10c | reseller-models: User Dashboard (/dashboard) — Subscription, API Key, BYOK, Analytics | ⏳ TODO | /reseller-models/ |
| 10d | reseller-models: Landing Page (/) — Hero, Live Models Catalog, Pricing Table | ⏳ TODO | /reseller-models/ |

---

## 1. SIDEBAR — DONE ✅
**Files:** `src/shared/constants/sidebarVisibility/sections.ts`, `types.ts`, `sidebarVisibility.ts`

Final order implemented:
```
[No Header - showTitle:false]  Home / Users / Usage
[CheapProxy]                   Providers / Combos / API Keys
[API]                          API Endpoints / API Docs
[Info]                         Costs/Pricing / Free Rankings
[Dev Tools]                    Logs / Proxy Logs / Console Logs
[No Header - showTitle:false]  Theme
```
model-catalog (`/dashboard/models`) permanently removed.
SidebarSectionId type extended with `"top"`, `"info"`, `"bottom"`.

---

## 2. PROVIDERS PAGE: 5-TAB ARCHITECTURE — DONE ✅
**Files:** `ProviderTabs.tsx`, `useProviderTabs.ts`, `providers/page.tsx`

Old auth-category pills (API Key / OAuth / Free / Compatible / All) → replaced with:

| Tab ID | Label | Content |
|--------|-------|---------|
| all-providers | All Providers | 370+ providers directory, search, filter chips |
| connected | Connected | Credentialed/active providers only |
| unconnected | Unconnected | Non-configured providers with "Connect" CTA |
| manage-models | Manage Models | Model studio for connected providers |
| reseller-api | Reseller API | Provider exposure + Master BYOK toggle |

Tab rendering: clean underline nav bar (border-b-2 style), no pills.

---

## 3. PROVIDER DETAILS PAGE (/dashboard/providers/[id]) — TODO ⏳
**File:** `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx`

> Actual logic is in `ProviderDetailPageClient.tsx` (954 lines), NOT `page.tsx` (thin wrapper).
> Audit existing hooks first: `useProviderModels`, `useModelImportHandlers`.

### 3.1 Fetch All Models Button
- Prominent button at top: **"Fetch All Models"**
- Calls upstream provider API to live-load model list
- On failure → orange alert box:
  `"Failed to fetch models from API. Please add models manually."`

### 3.2 Manual Add Model Form
Fields: Model Name | Model ID | Context Window (e.g. 1M, 128K) | Capabilities multi-select
(Text, Vision, Audio, Video, STT, TTS, Code, Reasoning) | **"Add Model"** button

### 3.3 Models Table
Columns: `☑ Active` | `Model ID (+ copy icon)` | `FREE/PAID badge` | `Context Window` | `Capability icons` | `Test button with inline preview`

---

## 4. USERS PAGE (/dashboard/users) — DONE ✅
**File:** `src/app/(dashboard)/dashboard/users/page.tsx`

Already fully implemented:
- Accordion UserCard per user (Name, Email, Plan badge, token progress bar)
- Expand → BYOK keys list (Provider, Masked Key, Date Added)
- Pause/Resume toggle per BYOK key via PATCH `/api/v1/reseller/users`
- Auto-polls every 15s

---

## 5. COMBOS PAGE (/dashboard/combos) — TODO ⏳
**File:** `src/app/(dashboard)/dashboard/combos/page.tsx` (5,116 lines)

### Goal: Simplify the cluttered UI into a clean, focused experience.

### Required UI Elements:
1. **Custom Combo Name / ID** — text input
   - Used as `model` param in API calls (e.g. `auto-coding-combo`)
2. **Candidate Models** — multi-select dropdown
   - Only shows models from **Manage Models Tab 4** active list
   - Displays model context window + capability icons alongside each option
3. **Two Core Strategy Switches** (prominent toggles):
   - **Auto Failover** — priority queue: Model 1 → on timeout/429/500 → Model 2 → Model 3
   - **Random** — each request picks a random model from candidates (load distribution)
4. **Best Model Combo** — curated preset panel of high-performance models

> Note: All 20 existing combo strategies in `open-sse/services/combo.ts` remain in the backend.
> The UI just needs to expose the 2 most-used ones cleanly. Do not remove backend logic.

---

## 6. MANAGE MODELS (Tab 4 of Providers Page) — TODO ⏳
**New components under:** `src/app/(dashboard)/dashboard/providers/components/`

### 6.1 DB Migration Required
New table: `provider_model_customizations`
```sql
CREATE TABLE IF NOT EXISTS provider_model_customizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  original_model_id TEXT NOT NULL,
  custom_name TEXT,
  custom_alias TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  is_tested INTEGER NOT NULL DEFAULT 0,
  context_window TEXT,
  capabilities TEXT,
  free_paid TEXT DEFAULT 'paid',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider_id, original_model_id)
);
```
Migration file: `src/lib/db/migrations/` (next available number)
Domain module: `src/lib/db/providerModelCustomizations.ts`

### 6.2 UI Features
- **Collapsible provider groups** (accordion per connected provider)
- **Checkbox** per model → only checked = active → flows to Combos + API key allowedModels
- **Copy icon** next to each Model ID (one-click clipboard copy)
- **FREE / PAID badge** — auto-detected from provider type + manual toggle override
- **Capability badges:** Context Window chip (`1M`, `128K`) + Modality chips (`Reasoning`, `Vision`, `Audio`, `Code`, `Tools`, `STT`, `TTS`)
- **Test button** per model → capability-aware prompt sent upstream:
  - ✅ Green `Verified` badge + HTTP 200 + real response preview snippet
  - ❌ Red `Failed` badge + status code + upstream error message
- **Custom alias fields** (shown when model checkbox is checked):
  | Field | Type |
  |-------|------|
  | Original Name | Read-only label |
  | Custom Display Name | Editable input (blank = use original) |
  | Original API Model ID | Read-only label |
  | Custom API Call ID / Alias | Editable input (blank = use original) |
- Integrate alias with `resolveModelAlias()` so client's custom alias → router uses original ID upstream

---

## 7. RESELLER API (Tab 5 of Providers Page) — TODO ⏳
**New component under:** `src/app/(dashboard)/dashboard/providers/components/`

### UI Features:
- **Provider checkboxes** — select which providers expose via `GET /api/v1/public/providers`
  - Response includes official SVG icons, names, metadata
- **Master BYOK Toggle** (reuse existing `ByokMasterToggleCard.tsx`):
  - **ON** → reseller users can send `x-upstream-key: <key>` (or `x-claude-key`, `x-deepseek-key`)
  - **OFF** → CheapRouter rejects with: `{"error": "BYOK is currently disabled by administrator"}`

### API Route Needed:
`GET /api/v1/public/providers` — public endpoint, no auth, returns enabled providers list with SVG icons

---

## 8. API KEYS — STRICT MODEL-LEVEL QUOTA — TODO ⏳
**Files:** `src/lib/db/apiKeys.ts`, `open-sse/handlers/chatCore.ts`, `src/app/api/keys/route.ts`

### Programmatic Key Creation (`POST /api/keys`):
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

### Enforcement Rules:
- **Per-model limit hit** → reject ONLY that model:
  `{"error": "Limit reached for this model. Please check another available model to continue."}`
- **Other models** with remaining quota → still accessible (do NOT block all)
- **Sliding window RPM** → reject with 429 when exceeded
- **`/v1/models` endpoint** → public, returns all active models (no auth needed for listing)
- **Execution-time check** → if API key does not include a model → 403 Forbidden

---

## 9. BYOK STATELESS PASS-THROUGH — TODO ⏳
**File:** `open-sse/handlers/chatCore.ts`

### Flow:
1. Reseller user's keys stored in `reseller-models` SQLite DB (never sent to CheapRouter storage)
2. On chat API call → reseller app passes header: `x-upstream-key: <user_api_key>`
   (Provider-specific variants: `x-claude-key`, `x-deepseek-key`, `x-openai-key`)
3. CheapRouter at request time:
   - Check Master BYOK toggle (from settings DB)
   - **Toggle OFF** → return: `{"error": "BYOK is disabled"}`
   - **Toggle ON** → substitute user's header key for the VPS default key when calling upstream
   - Deduct **0 tokens** from user's plan balance (free routing — user is using their own key)
4. User gets access to all active models of the provider whose key they supplied

---

## 10. RESELLER-MODELS WEB APP — TODO ⏳
**Target Directory:** `reseller-models/` (inside cheaprouter repo root)

### Stack:
- Next.js 14+ App Router (standalone mode)
- SQLite3 (`reseller.db`) via better-sqlite3
- NextAuth.js for auth (credentials provider)
- Run on separate port (e.g. 3001)

### DB Schema (`reseller.db`):
```sql
users (id, email, name, password_hash, role, created_at)
plans (id, name, token_budget, rpm_limit, validity_days, models JSON, created_at)
user_subscriptions (id, user_id, plan_id, cheaprouter_api_key, expires_at, created_at)
user_byok_keys (id, user_id, provider_id, encrypted_key, is_paused, created_at)
settings (key, value)
```

### Pre-seeded Accounts:
| Role | Login | Password |
|------|-------|----------|
| Admin | `admin` (username) | `1234` |
| User 1 | `user1@gmail.com` | `1234` |
| User 2 | `user2@gmail.com` | `1234` |

### Design System:
- Dark mode only
- Colors: `#0A0A0A` bg, `#FFFFFF` text, `#C0C0C0` secondary, `#1A1A1A` surface
- Font: Inter or system-ui
- Zero neon/gradient accents. Clean table-driven UI like OpenCode.

### Pages:

**`/` — Landing Page**
- Hero: "Your Private AI Gateway. 370+ Models. One Endpoint."
- Live Models Catalog fetched from `GET /api/v1/public/providers` on CheapRouter (SVG icons + model count)
- Pricing Table: Free (10M tokens) | Pro (50M tokens) | Premium (100M tokens)
- CTA: Sign Up / Login buttons

**`/login` and `/register`**
- Simple credential forms

**`/admin` — Admin Panel** (role=admin only)
- **Plans Configuration Studio:**
  - Create/edit Free, Pro, Premium plans
  - Fields: Name, Token Budget (10M/50M/100M), RPM Limit, Validity (7/30/Unlimited days), Allowed Models (multi-select from CheapRouter active models)
- **Users Management Table:**
  - All users list with current plan badge + usage %
  - "Edit Plan" modal → select plan → on save: calls `POST /api/keys` on CheapRouter to create/update API key → stores key in `user_subscriptions`

**`/dashboard` — User Dashboard**
- **Active Subscription Card:** Plan name + Token Quota progress bar (`Used / Total`) + Expiry countdown ("Expires in 28 days" or "Unlimited")
- **API Key Section:** CheapRouter key (masked) + one-click copy + "Regenerate" button (calls admin API to reissue key)
- **BYOK Keys Manager** (only visible when CheapRouter Master BYOK = ON):
  - Add key per provider (text input + provider selector)
  - List of added keys: Provider | Masked Key | Status | Pause/Resume toggle | Delete
- **Live Analytics:** Requests/min meter + 24h usage chart (bar chart, token counts)

---

## 📋 IMPLEMENTATION ORDER (Recommended)

```
✅ Step 1: sections.ts — Sidebar restructure + model-catalog removal
✅ Step 2: ProviderTabs.tsx — 5-tab nav bar
⏳ Step 3: ProviderDetailPageClient.tsx — Fetch Models btn + Manual Add + Models Table
⏳ Step 4: DB Migration — provider_model_customizations table + domain module
⏳ Step 5: ManageModelsTab component — checkbox, alias, test, copy, badges
⏳ Step 6: ResellerApiTab component — public providers toggle + BYOK master switch
⏳ Step 7: combos/page.tsx — Simplify to 2 core strategies UI
⏳ Step 8: apiKeys.ts + chatCore.ts — Per-model quota enforcement + RPM limiter
⏳ Step 9: chatCore.ts — BYOK stateless pass-through
⏳ Step 10: /reseller-models — Full Next.js app scaffold + seed + all pages
```

---

## 🔗 KEY FILES REFERENCE

| File | Purpose |
|------|---------|
| `src/shared/constants/sidebarVisibility/sections.ts` | Sidebar structure ✅ |
| `src/shared/constants/sidebarVisibility/types.ts` | SidebarSectionId type ✅ |
| `src/shared/constants/sidebarVisibility.ts` | Icon accents map ✅ |
| `src/app/(dashboard)/dashboard/providers/components/ProviderTabs.tsx` | 5-tab nav ✅ |
| `src/app/(dashboard)/dashboard/providers/hooks/useProviderTabs.ts` | Tab config ✅ |
| `src/app/(dashboard)/dashboard/providers/page.tsx` | Providers page ✅ |
| `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx` | Detail page ⏳ |
| `src/app/(dashboard)/dashboard/users/page.tsx` | Users page ✅ |
| `src/app/(dashboard)/dashboard/combos/page.tsx` | Combos page ⏳ |
| `src/lib/db/apiKeys.ts` | API key domain module ⏳ |
| `src/lib/db/resellerUsers.ts` | Reseller users domain module |
| `src/lib/db/providerModelCustomizations.ts` | To be created ⏳ |
| `open-sse/handlers/chatCore.ts` | Core request handler (quota + BYOK) ⏳ |
| `src/app/api/keys/route.ts` | API key creation endpoint ⏳ |
| `src/app/api/v1/reseller/users/route.ts` | Reseller users API |
| `src/app/api/v1/public/providers/route.ts` | Public providers endpoint (to create) ⏳ |
| `src/app/(dashboard)/dashboard/providers/components/ByokMasterToggleCard.tsx` | BYOK toggle (reuse) |
