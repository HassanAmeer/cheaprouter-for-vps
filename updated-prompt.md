# 🚀 CHEAPROUTER — UPDATED MASTER PROMPT (A TO Z FINAL & FIXES)
> Last Updated: 2026-10-13  
> Ecosystem: **CheapRouter** (VPS AI Core Gateway) + **reseller-models** (Reseller Web Platform)

---

## 📌 EXECUTIVE STATUS SUMMARY

| Task / Feature | Status | Notes |
|---|---|---|
| **1. Sidebar Navigation** | ✅ DONE | Correct order; `model-catalog` removed; section types updated |
| **2. Providers Page (5 Tabs Nav)** | ⚠️ PARTIAL | Tab bar & panels exist; **Connected/Unconnected filtering is currently broken** |
| **3. Provider Details Page (`[id]`)** | ⚠️ PARTIAL | "Fetch All Models" button added; **Type errors & manual table columns need completion** |
| **4. Users Management (`/dashboard/users`)** | ✅ DONE | Accordion, BYOK keys, pause/resume, quota bars all functional |
| **5. Combos Page (`/dashboard/combos`)** | ⚠️ PARTIAL | `QuickComboCreator` exists but **5,116-line page needs clean layout reorganization** |
| **6. Manage Models (Tab 4)** | ✅ DONE | `ManageModelsPanel.tsx`, table migrations (206, 208), aliases, testing all active |
| **7. Reseller API (Tab 5)** | ✅ DONE | `ResellerApiPanel.tsx`, public provider checkboxes & master BYOK toggle working |
| **8. API Keys Model-Level Quota** | ✅ DONE | Per-model token budget schema & exact error message rejection working |
| **9. BYOK Stateless Pass-through** | ✅ DONE | Master BYOK gate active; 0-token deduction on user key pass-through active |
| **10. `reseller-models` Web App** | ⚠️ BROKEN | Scaffolded with SQLite/pages; **5 critical Next.js `cookies()` TS errors must be fixed** |

---

## 🚨 MANDATORY FIXES & REMAINING WORK (STEP-BY-STEP)

---

### 🛠️ STEP 1: FIX `reseller-models` NEXT.JS COOKIE TS ERRORS (CRITICAL)

In Next.js modern typing / App Router, `cookies()` returns a `Promise<ReadonlyRequestCookies>` and requires `await cookies()`. The current synchronous calls cause 5 TypeScript compiler errors preventing the app from building.

#### Files to Fix:
1. `reseller-models/src/app/api/auth/login/route.ts`:
   - Change: `cookies().set(...)` ➔ `const cookieStore = await cookies(); cookieStore.set(...)`
2. `reseller-models/src/app/api/auth/logout/route.ts`:
   - Change: `cookies().get(...)` & `cookies().delete(...)` ➔ `const cookieStore = await cookies(); cookieStore.get(...); cookieStore.delete(...)`
3. `reseller-models/src/app/api/auth/register/route.ts`:
   - Change: `cookies().set(...)` ➔ `const cookieStore = await cookies(); cookieStore.set(...)`
4. `reseller-models/src/lib/auth.ts`:
   - Change: `getSessionUser(cookies().get(...)?.value)` ➔ `const cookieStore = await cookies(); return getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);`
   - Mark `getCurrentUser()` as `async` if not already async, and await calls at route call sites.

**Verification:**  
Run `npm --prefix reseller-models run typecheck` — MUST exit with **0 errors**.

---

### 🛠️ STEP 2: FIX PROVIDERS PAGE TAB FILTERING (CONNECTED / UNCONNECTED)

**Files:** `src/app/(dashboard)/dashboard/providers/page.tsx`, `src/app/(dashboard)/dashboard/providers/hooks/useProviderTabs.ts`

#### Problem:
Currently, clicking the "Connected" or "Unconnected" tabs renders all 370 providers without any filtering because `tabToCategories` returns all categories unconditionally, and the provider render list does not check connection status.

#### Requirements:
1. When `activeTab === "all-providers"`:
   - Render the complete directory of providers with search and category filters.
2. When `activeTab === "connected"`:
   - Filter and display **ONLY** providers that have configured credentials/connections (`connectionCount > 0` or matching `connections` list).
   - Show an empty state card if no providers are connected: *"No connected providers yet. Go to All Providers to configure one."*
3. When `activeTab === "unconnected"`:
   - Filter and display **ONLY** providers that have no active connections/credentials (`connectionCount === 0`).
   - Each card displays a prominent "Connect" CTA button.
4. When `activeTab === "manage-models"`:
   - Render `<ManageModelsPanel />` (already implemented).
5. When `activeTab === "reseller-api"`:
   - Render `<ResellerApiPanel />` (already implemented).

---

### 🛠️ STEP 3: PROVIDER DETAILS PAGE (`/dashboard/providers/[id]`) CLEANUP

**Files:** `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx`, `components/ProviderModelsSection.tsx`

#### Requirements:
1. Fix type mismatches in `ProviderDetailPageClient.tsx`:
   - Resolve `ModelMeta` vs `{ customModels, modelCompatOverrides }` typing.
   - Resolve `externalLinkCopied` (boolean vs string) and callback signatures.
2. Fix `src/app/(dashboard)/dashboard/providers/[id]/components/__tests__/fetch-models-fallback-alert.test.tsx`:
   - Set `visibilityFilter: "all"` properly typed as `"visible" | "hidden" | "all"`.
3. In `ProviderModelsSection.tsx`:
   - Keep the prominent **"Fetch All Models"** button at the top.
   - On fetch failure: Display the orange fallback alert banner:
     *"Failed to fetch models from API. Please add models manually."*
   - Ensure model cards/table rows display:
     - `☑ Active` checkbox
     - `Model ID` with one-click clipboard copy icon
     - `FREE / PAID` badge
     - Context window badge (e.g. `128K`, `1M`)
     - Capability icons (Reasoning, Vision, Tools, Code, Audio)
     - `Test` button with inline status preview

---

### 🛠️ STEP 4: COMBOS PAGE UI REORGANIZATION (`/dashboard/combos`)

**Files:** `src/app/(dashboard)/dashboard/combos/page.tsx`, `src/app/(dashboard)/dashboard/combos/QuickComboCreator.tsx`

#### Problem:
The Combos page is over 5,100 lines long and currently renders the full advanced routing workbench right below `QuickComboCreator`, resulting in cognitive overload for users.

#### Requirements:
1. **Hero / Primary Section:**
   - Display `QuickComboCreator` prominently at the top as the default combo creation experience:
     - Combo Name / ID input (e.g. `auto-coding-combo`).
     - Candidate Models multi-select dropdown (filtered to active models from Manage Models Tab 4).
     - Two core strategy toggles:
       - **Auto Failover** (`priority`): Model 1 ➔ Model 2 ➔ Model 3 fallback queue.
       - **Random** (`random`): Random selection across candidates for load distribution.
2. **Advanced Tools Collapsible Section:**
   - Wrap the remaining complex workbench (the other 18 combo strategies, fusion panel, matrix editor) inside a collapsible accordion:
     *"Advanced Combo Workbench (20 Strategies, Fusion, Cost Optimization)"* — collapsed by default.
3. Keep all underlying backend routing engines (`open-sse/services/combo.ts`) intact.

---

### 🛠️ STEP 5: VERIFY & POLISH RESELLER APP & INTEGRATION

**Directory:** `/reseller-models/`

#### Requirements:
1. **Pre-seeded Accounts Check:**
   - Ensure `npm --prefix reseller-models run seed` seeds:
     - Admin: `admin` / `1234`
     - User 1: `user1@gmail.com` / `1234`
     - User 2: `user2@gmail.com` / `1234`
2. **Landing Page (`/`):**
   - Verify models catalog loads from CheapRouter `GET /api/v1/public/providers`.
   - Minimalist Dark design: `#0A0A0A` background, `#FFFFFF` text, `#C0C0C0` accents. Zero neon.
3. **Admin Panel (`/admin`):**
   - Plans Studio (Token budget, RPM, validity days, allowed models multi-select).
   - Users Table with plan assignment calling `POST /api/keys` on CheapRouter.
4. **User Dashboard (`/dashboard`):**
   - Active subscription progress bar (tokens used / total).
   - API key copy & regenerate.
   - BYOK manager (visible when Master BYOK is ON).

---

## 🧪 VALIDATION CHECKLIST (RUN BEFORE REPORTING DONE)

```bash
# 1. Typecheck reseller-models (MUST BE 0 ERRORS)
npm --prefix reseller-models run typecheck

# 2. Typecheck core Next.js application
npm run typecheck:core

# 3. Check for any ESLint regressions
npm run lint

# 4. Verify dev servers start cleanly
npm run dev
npm --prefix reseller-models run dev
```
