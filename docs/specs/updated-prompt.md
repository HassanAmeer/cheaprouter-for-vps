# 🚀 CHEAPROUTER & RESELLER-MODELS — MASTER SPECIFICATION & PROMPT (A TO Z COMPLETE)
> Last Updated: 2026-10-13  
> Ecosystem: **CheapRouter** (VPS AI Core Gateway) + **reseller-models** (Reseller Web Platform)

---

## 🧭 TABLE OF CONTENTS
1. [Executive Overview & Status](#1-executive-overview--status)
2. [Sidebar Navigation & Hygiene](#2-sidebar-navigation--hygiene)
3. [Providers Main Page (5-Tab Architecture)](#3-providers-main-page-5-tab-architecture)
4. [Provider Detail Page (/dashboard/providers/[id])](#4-provider-detail-page-dashboardprovidersid)
5. [Combos Page Simplification (/dashboard/combos)](#5-combos-page-simplification-dashboardcombos)
6. [Users Management (/dashboard/users)](#6-users-management-dashboardusers)
7. [API Keys — Strict Model-Level Quotas](#7-api-keys--strict-model-level-quotas)
8. [BYOK Stateless Pass-Through & Zero-Token Accounting](#8-byok-stateless-pass-through--zero-token-accounting)
9. [Reseller-Models Web Application (/reseller-models)](#9-reseller-models-web-application-reseller-models)
10. [Validation & Quality Gates](#10-validation--quality-gates)

---

## 1. EXECUTIVE OVERVIEW & STATUS

| Module | Scope | Status | Notes |
|---|---|---|---|
| **Sidebar** | Navigation ordering & deduplication | ✅ DONE | Correct order, `model-catalog` removed, types updated |
| **Providers Page** | 5-Tab Architecture (`/dashboard/providers`) | ✅ DONE | 5 Tabs live, "Add your first provider" banner removed |
| **Provider Detail** | 3-Section Overhaul (`/dashboard/providers/[id]`) | ✅ DONE | Default Capabilities Prompt, Add Custom Model, Models Table |
| **Combos Page** | Simplified Creation (`/dashboard/combos`) | ✅ DONE | `QuickComboCreator` hero + collapsible 20-strategy workbench |
| **Users Page** | User management (`/dashboard/users`) | ✅ DONE | Accordion, BYOK keys, pause/resume, quota bars |
| **API Keys** | Per-model quota limits & RPM | ✅ DONE | `modelLimits` schema & exact error rejection working |
| **BYOK Gate** | Zero-token deduction & admin master switch | ✅ DONE | Central gate in `chatCore.ts` & `chat.ts` |
| **Reseller App** | Standalone web platform (`/reseller-models`) | ✅ BUILT | Next.js standalone, SQLite `reseller.db`, 19 routes built |

---

## 2. SIDEBAR NAVIGATION & HYGIENE

**Files:** `src/shared/constants/sidebarVisibility/sections.ts`, `types.ts`, `sidebarVisibility.ts`

### Requirements:
- Strictly ordered navigation structure:
  ```
  [No Header - Top]     Home / Users / Usage
  [CheapProxy]          Providers / Combos / API Keys
  [API]                 API Endpoints / API Docs
  [Info]                Costs/Pricing / Free Provider Rankings
  [Dev Tools]           Logs / Proxy Logs / Console Logs
  [No Header - Bottom]  Theme
  ```
- Permanently eliminate duplicate `model-catalog` (`/dashboard/models`).
- `SidebarSectionId` type union includes `"top"`, `"info"`, `"bottom"`.

---

## 3. PROVIDERS MAIN PAGE (5-TAB ARCHITECTURE)

**File:** `src/app/(dashboard)/dashboard/providers/page.tsx`  
**Components:** `src/app/(dashboard)/dashboard/providers/components/`  
**Hooks:** `src/app/(dashboard)/dashboard/providers/hooks/useProviderTabs.ts`

### 3.1 Top Layout & Clean-Up:
- ❌ **REMOVE:** The `"Add your first provider"` onboarding card (`showFirstProviderHint`).
- Layout order:
  1. Deprecated provider banner (if any)
  2. **5-Tab Navigation Bar** (`ProviderTabs`):
     - `All Providers`
     - `Connected Providers`
     - `Unconnected Providers`
     - `Manage Models`
     - `Reseller API Manage Providers`
  3. Filter chips / search inputs (for provider list tabs)
  4. Provider cards grid (grouped by category/type)

### 3.2 Tab Details:
- **Tab 1: All Providers (`all-providers`):**
  - Full catalog of all 370+ supported providers across categories (API Key, OAuth, Local, etc.).
- **Tab 2: Connected Providers (`connected`):**
  - **STRICT FILTER:** Shows **ONLY** providers with configured credentials (`connections.length > 0`).
  - Empty state with *"No connected providers yet"* + *"Go to All Providers"* CTA button.
- **Tab 3: Unconnected Providers (`unconnected`):**
  - **STRICT FILTER:** Shows **ONLY** providers that have **NO** credentials or are **PAUSED/DISCONNECTED**.
  - Displays "Connect" CTA button leading to configuration wizard.
- **Tab 4: Manage Models (`manage-models`):**
  - **🔘 "Default Capabilities Prompt" Trigger Button:** Clean button placed in the **Top-Right** header with `expand_more` arrow and `info` icon.
    - When clicked, opens a premium capabilities test suite modal/drawer containing 9 multimodal presets with high-res image previews:
      1. *Text / Hi* (Lightweight greeting & reasoning)
      2. *Code / HTML* (Modern CSS button generation)
      3. *Reasoning* (Mathematical chain-of-thought logic)
      4. *Vision* (Cat photo visual analysis)
      5. *OCR* (Document / receipt text & number extraction)
      6. *Text to Image* (Photorealistic cyberpunk cityscape prompt)
      7. *Image to Image* (Ukiyo-e woodblock artistic transformation)
      8. *Video Analysis* (Temporal scene & camera motion breakdown)
      9. *Audio / STT* (Speech transcription & ambient acoustics)
    - Includes custom editable textarea, "Reset to Hi", and "Done" button.
    - **Directly linked to model row test buttons below!**
  - **⚡ "Fetch All Models" Button (Table Mounted):** Positioned **directly above the models table** on each provider group header beside the count badge.
  - **Detailed Upstream Error Diagnostics:** Any discovery failure displays the exact HTTP status code and upstream response body (e.g. `HTTP 502 from http://...`) so the router operator can immediately inspect and debug custom endpoints.
  - **Search Bar:** Instant fuzzy search filter by Model Name or Model ID.
  - **Collapsible Provider Groups:** Accordion per connected provider (click header to expand/collapse).
  - **Model Rows:**
    - ☑️ Active Checkbox (checked = active downstream in Combos & API keys).
    - Model Display Name + Mono-spaced `Model ID` (+ 1-click copy icon).
    - Context Window badge (e.g. `128K`, `1M`).
    - Capability badges with **hover tooltips** (Reasoning, Vision, Code, Tools, Audio, etc.).
    - FREE / PAID badge with manual override toggle.
    - ✏️ **Edit Icon Button:** Click to edit:
      - Custom Display Name (e.g. `Qwen 3.5` ➔ `Qwen 3.5 Flash`)
      - Custom API Call ID / Alias (e.g. `qwen-3.5` ➔ `qwen-3.5-flash`)
      - Context Limit Override (e.g. `1M` context)
      - Renamed models flow forward to Combos and API calls via `resolveModelAlias()`.
    - ⚡ **Test Button:** Sends the top "Default Capabilities Prompt" upstream. Shows live response snippet and turns into a **Green Checkmark ✅** on success.
- **Tab 5: Reseller API Manage Providers (`reseller-api`):**
  - **Provider Exposure Checkboxes:** Select which providers are exposed via `GET /api/v1/public/providers` to the `reseller-models` website.
  - End users on the reseller website can add their own **BYOK keys** for these exposed providers.
  - **Master BYOK Toggle:** Master ON/OFF switch (ON = allow `x-upstream-key`; OFF = 403 reject).

---

## 4. PROVIDER DETAIL PAGE (/dashboard/providers/[id])

**File:** `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx`  
**Components:** `src/app/(dashboard)/dashboard/providers/[id]/components/`

### 4.1 Strict Removals (Declutter):
- ❌ Remove `ConnectionsListPanel`, `ConnectionsHeaderToolbar`, `CoolingConnectionsPanel`
- ❌ Remove `ProviderPlaygroundPanel` (Playground panel)
- ❌ Remove `ProviderInterceptionSection` (Web tool interception)
- ❌ Remove `ProviderCcAliasSection` (Cloud Code / discovery alias)
- ❌ Remove `ProviderParamFilterSection` (Parameter filter section)
- ❌ Remove `UpstreamProxyCard`, `ZedImportCard`, `CursorAgentNudge`
- ❌ Remove detached/awkward standalone "Upstream Model Discovery" panel box

### 4.2 Top Header & Layout Architecture:
- **Provider Header:** Name, ID, Icon, Website/referral link, and connection count.
- **Top-Right "Default Capabilities Prompt" Button:**
  - Compact trigger button with `expand_more` arrow and `info` icon.
  - Expands into the 9-preset capability test suite drawer with image previews and custom prompt editor.
- **Section 1: ➕ "Add Custom Model" Form** (Manual model entry)
  - `Model ID` (required)
  - `Model Display Name` (optional)
  - `Context Limit / Window` input (e.g. `128K`, `1M`, `200K`)
  - `Capabilities Selector with Icons & Tooltips` (`Text`, `Vision`, `Code`, `Reasoning`, `Tools`, `Audio`, `Video`, `STT`, `TTS`)
  - FREE / PAID toggle + "Add Model" button.
- **Section 2: 📋 Available Models Table (Table-Mounted Model Fetching)**
  - **⚡ "Fetch All Models" Button:** Mounted **directly in the table header bar** right next to the search input.
  - **Comprehensive Upstream Router Support:**
    - Seamlessly supports both `http://` and `https://` custom provider routers (e.g. `http://187.52.117.2:8377/v1/models`).
    - Automatically normalizes base URLs, stripping trailing `/models`, `/chat/completions`, and `/completions`.
    - Probes candidate endpoints (`/v1/models`, `/models`) without throwing unhandled exceptions.
    - Full error visibility banner with HTTP status code and upstream body on failure.
  - `☑ Active` Checkbox.
  - `Model Name` + `Model ID` (1-click copy).
  - `Context Limit` badge.
  - `Capability Icons` with hover tooltips.
  - `FREE / PAID` badge with manual override.
  - `⚡ Test Button`: Dispatches the top capability prompt upstream, displays latency + snippet, and turns into a **Green Checkmark ✅** on success.

---

## 5. COMBOS PAGE SIMPLIFICATION (/dashboard/combos)

**File:** `src/app/(dashboard)/dashboard/combos/page.tsx`

1. **Hero / Primary Section:**
   - Display `QuickComboCreator.tsx` prominently at the top as the default creator:
     - Combo Name / ID (e.g. `auto-coding-combo`).
     - Candidate Models multi-select (filtered to active models from Manage Models).
     - Core toggles: **Auto Failover** (`priority`) & **Random** (`random`).
2. **Advanced Tools Collapsible Section:**
   - Wrap the full 20-strategy workbench and Kimi presets inside a collapsible accordion:
     *"Advanced Combo Workbench (20 Strategies, Fusion, Cost Optimization)"* (collapsed by default).
   - Backend routing engine (`open-sse/services/combo.ts`) remains intact.

---

## 6. USERS MANAGEMENT (/dashboard/users)

**File:** `src/app/(dashboard)/dashboard/users/page.tsx`

- Accordion `UserCard` per user (Name, Email, Plan badge, token usage progress bar).
- Expand card ➔ View BYOK keys list (Provider, Masked Key, Date Added).
- Pause / Resume toggle per BYOK key via `PATCH /api/v1/reseller/users`.
- Auto-polling every 15s.

---

## 7. API KEYS — STRICT MODEL-LEVEL QUOTAS

**Files:** `src/lib/db/apiKeys.ts`, `open-sse/handlers/chatCore.ts`, `src/app/api/keys/route.ts`

### Key Creation Payload (`POST /api/keys`):
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
- **Per-model limit reached** ➔ reject ONLY that model with exact error message:
  `{"error": "Limit reached for this model. Please check another available model to continue."}`
- **Sibling models** with remaining budget remain completely accessible.
- **Sliding-window RPM:** Returns HTTP 429 when rate limit exceeded.
- **`/v1/models` listing:** Public endpoint returning active models without blocking.

---

## 8. BYOK STATELESS PASS-THROUGH & ZERO-TOKEN ACCOUNTING

**File:** `open-sse/handlers/chatCore.ts`, `src/sse/handlers/chat.ts`, `src/lib/byokHeaders.ts`

### Workflow:
1. Reseller users store API keys in `reseller-models` SQLite DB (never stored on CheapRouter VPS).
2. On API request ➔ Client sends header: `x-upstream-key: <user_api_key>` (or `x-claude-key`, `x-deepseek-key`, `x-openai-key`).
3. CheapRouter Execution:
   - Check Master BYOK switch:
     - **OFF** ➔ HTTP 403 Forbidden: `{"error": "BYOK is currently disabled by administrator"}`
     - **ON** ➔ Inject user's key for upstream dispatch.
   - **Zero-Token Accounting:** When `hasByokHeader()` is true, deduct **0 tokens** from the user's plan balance.

---

## 9. RESELLER-MODELS WEB APPLICATION (/reseller-models)

**Directory:** `reseller-models/`  
**Stack:** Next.js 14+ App Router (standalone mode), SQLite (`reseller.db`), NextAuth/custom session cookie.

### Database Schema (`reseller.db`):
- `users` (`id`, `email`, `name`, `password_hash`, `role`, `created_at`)
- `plans` (`id`, `name`, `token_budget`, `rpm_limit`, `validity_days`, `models` JSON, `created_at`)
- `user_subscriptions` (`id`, `user_id`, `plan_id`, `cheaprouter_api_key`, `expires_at`, `created_at`)
- `user_byok_keys` (`id`, `user_id`, `provider_id`, `encrypted_key`, `is_paused`, `created_at`)
- `settings` (`key`, `value`)

### Pre-seeded Accounts:
- **Admin:** `admin` / `1234`
- **User 1:** `user1@gmail.com` / `1234`
- **User 2:** `user2@gmail.com` / `1234`

### Application Pages:
- **`/` — Landing Page:** Hero pitch, live models catalog from `GET /api/v1/public/providers`, pricing table.
- **`/login` & `/register`:** Minimalist authentication forms.
- **`/admin` — Admin Panel (role=admin):**
  - **Plans Studio:** Create/edit Free, Pro, Premium plans with allowed models & token limits.
  - **Users Management:** Users list with current plan badge, edit plan modal calling `POST /api/keys` on CheapRouter.
- **`/dashboard` — User Dashboard:**
  - Active subscription card with token progress bar (`Used / Total`) & expiry countdown.
  - API Key copy & regenerate button.
  - BYOK Keys Manager (visible when Master BYOK = ON): add/pause/resume/delete provider keys.
  - Live analytics charts (RPM meter, daily usage).

---

## 10. VALIDATION & QUALITY GATES

```bash
# 1. Typecheck reseller-models (MUST BE 0 ERRORS)
npm --prefix reseller-models run typecheck

# 2. Build reseller-models (MUST BE 0 ERRORS, 19/19 routes)
npm --prefix reseller-models run build

# 3. Typecheck core Next.js application
npm run typecheck:core

# 4. ESLint verification on modified files
npm run lint

# 5. Start dev environments
npm run dev                           # CheapRouter on port 20128
npm --prefix reseller-models run dev  # Reseller platform on port 3001
```
