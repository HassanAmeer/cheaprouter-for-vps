# 🚀 ULTIMATE MASTER PRODUCTION & EXECUTION PROMPT (FINAL A TO Z)
## Ecosystem: CheapRouter (VPS AI Core Gateway) + Reseller Web Platform (`reseller-models`)

---

> ### 🚨 CRITICAL DIRECTIVE FOR THE IMPLEMENTING AGENT / DEVELOPER:
> 1. **Correction on Commit `d5d8c33` (`ProviderTabs.tsx`):**
>    Pichle commit mein doosre AI ne `ProviderTabs.tsx` mein auth categories (`API Key`, `OAuth`, `Free`, `Compatible`, `All`) ke pills bana diye thay. **Yeh ghalat hai!** Usay foran replace karein aur exact required **5 Tabs** banayein:
>    `All Providers` | `Connected Providers` | `Unconnected Providers` | `Manage Models` | `Reseller API Manage Providers`
> 2. **Codebase Inspection & Improvement:** 
>    CheapRouter mein kai features pehle se partially maujood hain (`resellerUsers.ts`, `ByokMasterToggleCard.tsx`, `ApiDocsIntegrationHub.tsx`, `combo.ts`, `apiKeys.ts`). **Existing flow ko verify karein aur usi ko extend/polish karein**, wheel reinvent na karein.
> 3. **Strict Design Aesthetic:** 
>    Zero flashy neon/glassmorphism colors. UI strictly clean, minimal, aur professional hona chahiye. Reseller website strictly **Silver, White, aur Deep Black** (OpenCode style) hogi.

---

## 📌 TABLE OF CONTENTS
1. Sidebar Navigation: Exact Sorting & Duplicate Removal
2. Providers Page: 5-Tab Architecture (Fix `ProviderTabs.tsx`)
3. Provider Details Page Clean-Up & Dedicated Model Studio (`/dashboard/providers/[id]`)
4. Dedicated "Users" Management Tab (`/dashboard/users`)
5. Simplified Combos Engine (`/dashboard/combos`)
6. API Keys & Strict Model-Level Quota Enforcements
7. Multi-User BYOK (Bring Your Own Key) Stateless Pass-Through Architecture
8. Reseller Frontend Web Application (`reseller-models`) Full Specification

---

## 1. SIDEBAR NAVIGATION: EXACT SORTING & DUPLICATE REMOVAL
*Target File: `src/shared/constants/sidebarVisibility/sections.ts`*

Sidebar ki hierarchy aur items ki upar se neeche sequence **STRICTLY** yeh honi chahiye:

1. **Top Standalone Items (Outside / No Section Header - `showTitle: false`):**
   - 🏠 **Home** (`/home`)
   - 👥 **Users** (`/dashboard/users`) — Reseller users, plans & BYOK keys
   - 📊 **Usage** (`/dashboard/usage`) — Live token & provider consumption

2. **Section Label: `CheapProxy`**
   - 🌐 **Providers** (`/dashboard/providers`)
   - 📑 **Combos** (`/dashboard/combos`)
   - 🔑 **API Keys** / API Manager (`/dashboard/api-manager`)
   - ⚠️ **MANDATORY REMOVAL:** Purana duplicate tab `model-catalog` (`/dashboard/models` - "Models & Combos") ko `sections.ts` se **permanently delete/remove** karein taake "Models & Combos" vs "Combos" ki redundancy khatam ho jaye.

3. **Section Label: `API`**
   - 🔌 **API Endpoints** (`/dashboard/endpoint` - Visual Cards/Grid View)
   - 📖 **API Docs** (`/dashboard/endpoint/api-reference` ya `/docs` - Interactive Developer Hub)

4. **Section Label: `Info`**
   - 💰 **Costs / Pricing** (`/dashboard/costs/pricing`)
   - 🏆 **Free Provider Rankings** (`/dashboard/free-provider-rankings`)

5. **Section Label: `Dev Tools`**
   - 📝 **Logs** (`/dashboard/logs`)
   - 🔀 **Proxy Logs** (`/dashboard/logs/proxy`)
   - 💻 **Console Logs** (`/dashboard/logs/console`)

6. **Bottom Standalone Item (Outside / No Section Header - `showTitle: false`):**
   - 🎨 **Theme** / Appearance (`/dashboard/settings/appearance`)

---

## 2. PROVIDERS PAGE: 5-TAB ARCHITECTURE
*Target Files: `src/app/(dashboard)/dashboard/providers/components/ProviderTabs.tsx`, `useProviderTabs.ts`, `page.tsx`*

Existing `ProviderTabs.tsx` ke category pills (`API Key`, `OAuth`, `Free`, etc.) ko hata kar top par yeh **5 Main Tabs** banayein:

### Tab 1: All Providers
- Tamam 370+ supported providers ki directory with search bar aur filter chips.

### Tab 2: Connected Providers
- Sirf wo providers jin ke credentials/API keys currently active aur authenticated hain.

### Tab 3: Unconnected Providers
- Tamam non-configured providers jin par "Connect" CTA button ho.

### Tab 4: Manage Models (Dedicated Model Studio)
- **Data Scope:** Sirf **Connected Providers** ke models yahan display honge (collapsible provider groups).
- **Checkbox Selection:** Provider ke 200–300 models me se operator sirf 5–10 zaroori models ko tick karega. Sirf checked models active rahenge aur downstream Combos/API keys me jayenge.
- **Model ID One-Click Copy:** Har model ID ke samne copy icon button taake original model path/ID copy ho sake.
- **Free vs Pro / Paid Label:** Provider status ke mutabiq badge (`FREE` / `PAID`) + manual toggle override.
- **Model Capabilities Badges:** Har model par prominent badges: Context Window (e.g. `1M tokens`, `128K`), Modalities (`Reasoning`, `Vision`, `Audio`, `Code`, `Tools`, `STT`, `TTS`).
- **Capability-Aware Live Test Button:**
  - Har model ke sath "Test" button hoga.
  - Capability template prompts (Code prompt for coding, Vision prompt for vision, Audio prompt for audio, Text prompt for text).
  - Run dabane par real upstream response generate ho kar model ke neeche inline preview show karega:
    - Success: Green Checkmark Badge (`Verified`) + HTTP 200 + real response preview.
    - Error: Red Badge (`Failed`) + Status code + upstream error message.
- **Model Renaming (Custom Aliases):**
  - Checkmark karne par editable fields:
    1. **Original Name:** Read-only label.
    2. **Custom Display Name:** Editable input (e.g. `GLM 5.3 Flash`). *Blank = original.*
    3. **Original API Model ID:** Read-only label (e.g. `glm-5.3`).
    4. **Custom API Call ID / Alias:** Editable input (e.g. `glm-5.3_flash` ya `deepseek_flash`). *Blank = original.*
- **Database Persistence & Routing Integration:**
  - Settings SQLite table `provider_model_customizations` me save hongi (`provider_id`, `original_model_id`, `custom_name`, `custom_alias`, `is_active`, `is_tested`, `context_window`, `capabilities`).
  - Codebase ke `resolveModelAlias` logic ke sath integrate karein taake client request me custom alias aane par router upstream provider ko original ID dispatch kare.

### Tab 5: Reseller API Manage Providers
- Checkboxes to select which providers to expose to reseller websites via `GET /api/v1/public/providers` with official SVG icons, names, and metadata.
- **Master BYOK Toggle Switch:** Prominent switch: **"Enable BYOK Providers (On/Off)"**.
  - ON = Reseller users apni custom keys bhej sakte hain.
  - OFF = External custom keys block hongi with error: `{"error": "BYOK is currently disabled by administrator"}`.

---

## 3. PROVIDER DETAILS PAGE CLEAN-UP (`/dashboard/providers/[id]`)
*Target File: `src/app/(dashboard)/dashboard/providers/[id]/page.tsx`*

- **UI Clean-Up:** Faltu aur extra unnecessary sections ko remove karein. Sirf clean Connectivity + Models Studio rakhein.
- **"Fetch All Models" Button:**
  - Top par prominent button: **"Fetch All Models"** jo upstream provider API se models live load kare.
  - **Orange Alert Fallback:** Agar API se models fetch na ho sakein, toh orange alert box show ho:
    `"Failed to fetch models from API. Please add models manually."`
- **Manual Add Model Form (Top Section):**
  - Input fields: Model Name, Model ID, Context Window size (e.g. 1M, 128K), Capabilities Multi-Select (Text, Vision, Audio, Video, STT, TTS, Code, Reasoning), aur "Add Model" button jo table me new row append kare.
- **Models Table in Details Page:**
  - Columns: Active Checkbox, Model ID with One-Click Copy Button, Free vs Pro/Paid Badge, Context Window, Capabilities Icons, Test Button with inline response preview.

---

## 4. DEDICATED "USERS" TAB (`/dashboard/users`)
*Target Files: `src/app/(dashboard)/dashboard/users/page.tsx`, `src/lib/db/resellerUsers.ts`, `src/app/api/v1/reseller/users/route.ts`*

- **User List Accordion View:** Har registered user ka row/card (Name, Email, Plan Tier e.g. Free/Pro/Premium, Registered Date).
- **Attached BYOK Keys Inspection:** Expand karne par user ki add ki hui BYOK keys (Provider Name, Masked Key, Date Added).
- **Provider Pause / Resume Toggle:** Har BYOK provider ke samne switch jisse user ya admin us key ko temporary pause ya resume kar sake.
- **Live Quota & Usage Analytics:** Total tokens used, remaining plan balance, per-minute request counts, live charts.

---

## 5. SIMPLIFIED COMBOS ENGINE (`/dashboard/combos`)
*Target File: `src/app/(dashboard)/dashboard/combos/page.tsx`*

5,116 lines ke complex cluttered UI ko clean aur simplified banayein:
- **Custom Combo Name / ID:** Jo API request me `model` parameter me pass hoga (e.g. `auto-coding-combo`).
- **Candidate Models Selection:** Multi-select dropdown jisme sirf `Manage Models` ke active models show hon unki 1M context aur capabilities ke sath.
- **Two Core Strategy Switches:**
  1. **Auto Combo (Auto Failover Switch):** 4–6 models ka priority sequence. Agar Model 1 timeout, rate-limit (429), server error (500), ya quota exhaust ho jaye -> router instantly Model 2 par request replay karega -> then Model 3.
  2. **Random Combo (Random Switch):** Har incoming request par candidate models me se random model pick karega load distribution ke liye.
- **Best Model Combo:** Curated high-performance models panel.

---

## 6. API KEYS & STRICT MODEL-LEVEL QUOTA ENFORCEMENTS
*Target Files: `open-sse/handlers/chatCore.ts`, `src/lib/db/apiKeys.ts`, `src/app/api/keys/route.ts`*

- **Programmatic API Creation:** Reseller backend `POST /api/keys` call karke keys banayega:
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
- **Strict Per-Model Quota Enforcement:**
  - Agar Model A ki 100M limit reach ho jaye, toh Model A par request reject hogi with exact message:
    `{"error": "Limit reached for this model. Please check another available model to continue."}`
  - **Lekin Model B block nahi hoga!** Agar Model B par quota baqi hai, toh user Model B use kar sakega.
- **Rate Limits:** Sliding window RPM rate limiter (e.g. 30 req/min).
- **`/v1/models` Listing Rule:** `/v1/models` endpoint public/open rahega aur **tamam active models har kisi ko return karega**. Execution ke waqt strictly API key ke allowed models check honge (unallowed par 403 Forbidden).

---

## 7. MULTI-USER BYOK STATELESS PASS-THROUGH ARCHITECTURE
*Target File: `open-sse/handlers/chatCore.ts`*

- Reseller website user ke personal keys apne secure database me rakhti hai.
- Chat call karte waqt pass-through headers bheje jate hain: `x-upstream-key: <user_api_key>` (ya `x-claude-key`, `x-deepseek-key`).
- CheapRouter request aane par:
  1. Agar Master BYOK Switch = OFF -> Return error `{"error": "BYOK is disabled"}`.
  2. Agar Master BYOK Switch = ON -> CheapRouter VPS default key ke bajaye **user ki header key** upstream ko inject karega.
  3. CheapRouter is call par user ke plan balance se **0 tokens** deduct karega (Free routing).
- User ne jis provider ki key lagayi hai, us provider ke active models user freely use kar sakega.

---

## 8. RESELLER FRONTEND WEB APPLICATION (`reseller-models`)
*Target Directory: `/home/hasan/Documents/reactjs/cheaprouter/reseller-models/`*

Nayi independent Next.js standalone web app initialize karein:

### 8.1 UI & Design System
- Minimalist Modern Dark Mode strictly using **Silver (#C0C0C0 / #E5E7EB), White (#FFFFFF), and Deep Black (#0A0A0A / #121212)** (OpenCode style). Zero unwanted flashy neon colors.

### 8.2 Local Database (SQLite3) & Auth
- Local SQLite database `reseller.db` (tables: `users`, `plans`, `user_subscriptions`, `user_byok_keys`, `settings`).
- **Pre-seeded Accounts:**
  - **Admin:** Username: `admin` | Password: `1234`
  - **User 1:** Email: `user1@gmail.com` | Password: `1234`
  - **User 2:** Email: `user2@gmail.com` | Password: `1234`

### 8.3 Admin Panel (`/admin`)
- **Plans Configuration Studio:** Admin Free, Pro, aur Premium plans configure kare (Included models, token budgets e.g. 10M, 50M, 100M, RPM limits, validity duration e.g. 7 Days, 30 Days, Unlimited).
- **Users Management Table:** Tamam users ki list with plan badges. Admin "Edit Plan" modal se user ka plan assign/change kare, jo foran CheapRouter `POST /api/keys` call karke key sync kar de.

### 8.4 User Dashboard (`/dashboard`)
- **Active Subscription Card:** Current plan name, token quota progress bar (Used vs Remaining), aur Expiry Countdown ("Expires in 28 days" ya "Unlimited").
- **API Key Section:** CheapRouter-generated key with One-Click Copy aur Regenerate button.
- **BYOK Keys Manager (Active when Router BYOK = ON):** User custom provider keys dale, Pause / Resume kare, status dekhe.
- **Live Analytics:** Requests per minute meter aur daily usage charts.

### 8.5 Public Landing Page (`/`)
- Hero Section explaining the high-speed AI Gateway.
- Live Models Catalog (CheapRouter `GET /api/v1/public/providers` se fetched with SVG icons).
- Pricing Table with Free, Pro, and Premium tiers.
