# 🚀 PROVIDER DETAIL PAGE OVERHAUL PROMPT (/dashboard/providers/[id])

> **Target File:** `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx`  
> **Associated Components:** `src/app/(dashboard)/dashboard/providers/[id]/components/`  
> **Aesthetic:** Minimalist Dark Mode — Silver (`#C0C0C0`), White (`#FFFFFF`), Deep Black (`#0A0A0A`). Zero neon/clutter.

---

## 🎯 GOAL & SCOPE

Completely simplify and declutter the **Provider Detail Page (`/dashboard/providers/[id]`)**.  
Remove all legacy admin panels, playground tabs, web tool toggles, and connection manager cards.  
Replace the entire page layout with **EXACTLY THREE (3) CORE SECTIONS** following this exact flow:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Provider Header (Title, Provider ID, Status, Back to List)            │
├────────────────────────────────────────────────────────────────────────┤
│ 1. 🔘 "Default Capabilities Prompt" (Collapsible / Expandable Panel)   │
│    - Global test prompt box (e.g. "Hi", code prompt, vision prompt)    │
│    - Linked directly to model row "Test" buttons below!                │
├────────────────────────────────────────────────────────────────────────┤
│ 2. ⚡ "Fetch All Models" Button + ➕ "Add Custom Model" Form            │
│    - Live upstream fetch                                               │
│    - Model ID, Model Name, Context Limit (128K, 1M),                   │
│      Capabilities selector with icons & hover tooltips                 │
├────────────────────────────────────────────────────────────────────────┤
│ 3. 📋 Available Models Table                                           │
│    - Active Checkmark | Model Name & ID (Copy) | Context Limit |       │
│      Capability Icons (Tooltips) | Free/Paid Badge | Test Button ➔     │
│      (Runs Default Prompt ➔ Green Checkmark on success)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚫 WHAT TO REMOVE (STRICT ELIMINATION)

Remove the following legacy sections and components completely from `ProviderDetailPageClient.tsx`:
1. ❌ **Connections List Panel / Toolbar** (`ConnectionsListPanel`, `ConnectionsHeaderToolbar`, `CoolingConnectionsPanel`)
2. ❌ **Playground Panel** (`ProviderPlaygroundPanel`)
3. ❌ **Web Tool Interception Section** (`ProviderInterceptionSection` / search/fetch tool interception)
4. ❌ **Expose in Cloud Code / Claude Code Guide** (`ProviderCcAliasSection`, `CodexCliGuideModal`)
5. ❌ **Parameter Filter Section** (`ProviderParamFilterSection` - remove to keep UI uncluttered)
6. ❌ **Proxy / User Tracker panels** (`UpstreamProxyCard`, `ZedImportCard`, `CursorAgentNudge`)

---

## 🛠️ THE THREE (3) REQUIRED SECTIONS (EXACT WORKFLOW)

---

### SECTION 1: 🔘 "Default Capabilities Prompt" (COLLAPSIBLE TEST PANEL)

A prominent collapsible header button at the top: **"Default Capabilities Prompt"** (with expand/collapse chevron `expand_more` / `expand_less`).

#### Mechanism & Features:
1. **Collapsible Toggle:**
   - Clicking the button expands or collapses the prompt configuration card.
2. **Customizable Global Test Prompt Box:**
   - Text input / textarea pre-filled with default test prompt: e.g. `"Hi"` or `"Hello! Explain your capabilities in 1 short sentence."`.
   - **Preset Quick-Fill Buttons:**
     - 💬 **Text / Hi:** Sets prompt to `"Hi"`
     - 💻 **Code / HTML:** Sets prompt to `"Generate a modern CSS button with HTML."`
     - 👁️ **Vision:** Sets image URL + prompt `"Describe this image in detail."`
     - 🔍 **OCR:** Sets document image URL + prompt `"Extract all text from this receipt."`
3. **DIRECT CONNECTION TO MODEL TABLE:**
   - **When the user clicks the "Test" button on ANY model in the table below (Section 3), it uses the prompt configured in this Default Capabilities Prompt box!**
   - e.g. If the user writes `"Hi"`, clicking "Test" on any model sends `"Hi"` to that model.
   - Shows live response preview and turns the model's test status checkmark **GREEN ✅** upon successful response.

---

### SECTION 2: ⚡ "Fetch All Models" Button + ➕ "Add Custom Model" Form

Right below Section 1:

#### 1. "Fetch All Models" Action:
- A prominent button: **"Fetch All Models"**
  - Calls provider upstream API to live-fetch available models.
  - On failure: Displays an orange alert box:
    *"Failed to fetch models from API. Please add models manually below."*

#### 2. "Add Custom Model" Form:
If a model is not automatically fetched, operators use this form to add it manually:
- **Model ID (Required):** Text input (e.g. `deepseek-ai/DeepSeek-V3`, `claude-3-5-sonnet-20241022`)
- **Model Name (Optional):** Text input (e.g. `DeepSeek V3 (Production)`)
- **Context Limit / Window:** Text input (e.g. `128K`, `1M`, `200K`, `32768`)
- **Capabilities Selector with Icons & Tooltips:**
  - Interactive clickable chips with icons:
    - 💬 `Text`
    - 👁️ `Vision`
    - 💻 `Code`
    - 🧠 `Reasoning`
    - 🛠️ `Tools`
    - 🎙️ `Audio`
    - 📼 `Video`
    - 🗣️ `STT` / `TTS`
  - **Hover Tooltip:** Hovering over any capability icon clearly explains what it is (e.g. *"Vision - Supports image input & visual analysis"*).
  - Selected capabilities show a highlighted checkmark.
- **FREE / PAID Toggle:** Mark model as free or paid.
- **"Add Model" Button:** Saves the custom model and instantly renders it in Section 3 table.

---

### SECTION 3: 📋 AVAILABLE MODELS TABLE (CATALOG & LIVE VERIFICATION)

A clean, responsive table listing all active models for this provider (both auto-fetched and custom-added).

#### Table Columns:
| Column | Specification |
|---|---|
| **☑ Active** | Checkbox toggling model `is_active` status (checked = enabled for router combos & keys). |
| **Model Info** | Model Display Name + Mono-spaced `Model ID` + 1-click clipboard copy button. |
| **Context Limit** | Badge showing context window (e.g. `128K`, `1M`). |
| **Capabilities** | Modality icon badges with **hover tooltips** (`psychology` Reasoning, `visibility` Vision, `code` Code, `build` Tools, `volume_up` Audio). |
| **FREE / PAID** | Green `FREE` badge or Blue `PAID` badge with 1-click toggle override. |
| **⚡ Test Button** | **Sends the prompt from Section 1 ("Default Capabilities Prompt") upstream!**<br>• During test: Loading spinner `Testing...`<br>• On success: **Green Checkmark ✅** + response snippet preview.<br>• On failure: Red error badge + error message. |

---

## 💻 CODE IMPLEMENTATION SUMMARY

1. In `src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx`:
   - Strip out legacy panels: `ConnectionsListPanel`, `ProviderPlaygroundPanel`, `ProviderParamFilterSection`, `ProviderInterceptionSection`, `ProviderCcAliasSection`, `UpstreamProxyCard`, `ZedImportCard`, `CursorAgentNudge`.
2. Add state:
   - `const [showCapabilityPrompt, setShowCapabilityPrompt] = useState(false);`
   - `const [testPrompt, setTestPrompt] = useState("Hi");`
3. Render Section 1: Collapsible button `"Default Capabilities Prompt"` + prompt editor + capability presets.
4. Render Section 2: `"Fetch All Models"` button + `AddCustomModelCard` form (Model ID, Name, Context Limit, Capability chips with tooltips).
5. Render Section 3: `ModelsTable` where `onTestModel(modelId)` sends `testPrompt` and marks the row with a green checkmark ✅ on 200 OK.
6. Verify typecheck: `npm run typecheck:core` exits with 0 errors.
