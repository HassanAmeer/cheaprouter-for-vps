# CheapRoute Reseller Website Integration API Documentation (NEW_API_DOCS)

> **Overview:** Yeh documentation aapki **Reseller Website** ko **CheapRoute AI Router** ke sath seamlessly connect karne ke liye design ki gayi hai. Tamam operations 5 structured tabs ke mutabiq tarteeb diye gaye hain.

---

## 🌐 Base URLs & Environment

| Environment | Base URL | Purpose |
| :--- | :--- | :--- |
| **Production API** | `https://api.tokendeal.cloud` | Reseller backend & user inference calls |
| **Dashboard UI** | `https://router.tokendeal.cloud` | Web management dashboard & live monitor |
| **Local Development** | `http://localhost:20128` | Local testing & development |

---

## 🔄 High-Level Architecture Flow

```mermaid
flowchart TD
    subgraph Setup["Step 1: Admin Setup (CheapRoute)"]
        A1["Combos & Manage Models"] -->|"Select active models"| A2["Available Models Catalog"]
        A3["Providers Tab 5 (Reseller API)"] -->|"Publish BYOK providers"| A4["Allowed Providers List"]
    end

    subgraph ResellerApp["Step 2: Reseller Website / App"]
        B1["User Signup / Purchase"] -->|"POST /api/v1/reseller/users"| B2["Issued API Key (Tab 1)"]
        B3["User Enters Provider Key"] -->|"POST (action: addByok)"| B4["Attached BYOK Key (Tab 2)"]
    end

    subgraph Inference["Step 3: AI Inference (/v1/chat/completions)"]
        C1["User Request with CheapRoute Key"] --> C2{"BYOK Key exists for provider?"}
        C2 -->|"YES & Active"| C3["Execute via User's Own Upstream Key"]
        C2 -->|"NO or Paused"| C4["Execute via CheapRoute Combos / Connections"]
    end
```

---

## 📑 TABLE OF CONTENTS (5 TABS)

1. [Tab 1: Issue & Manage User Keys (CRUD)](#tab-1-issue--manage-user-keys-crud)
2. [Tab 2: User BYOK Provider Keys (CRUD & State)](#tab-2-user-byok-provider-keys-crud--state)
3. [Tab 3: Allowed Providers & Official SVG Icons](#tab-3-allowed-providers--official-svg-icons)
4. [Tab 4: Models & Combos Catalog](#tab-4-models--combos-catalog)
5. [Tab 5: Chat Completions AI Proxy (Core Engine)](#tab-5-chat-completions-ai-proxy-core-engine)

---

## Tab 1: Issue & Manage User Keys (CRUD)

Is tab ke zariye aapki reseller website naye users ko CheapRoute ki scoped API keys issue karti hai, unke token limits aur model permissions set karti hai, aur keys ko revoke/delete karti hai.

### 1.1 Issue a New Scoped API Key for User
* **Method:** `POST`
* **Endpoint:** `/api/v1/reseller/users`
* **Content-Type:** `application/json`

#### Request Body Parameters:
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `userId` | `string` | **Yes** | User ka unique ID ya UID (e.g. `usr_1001` ya database ID) |
| `userName` | `string` | **Yes** | User ka poora naam (e.g. `Hasan Ali`) |
| `userEmail` | `string` | **Yes** | User ka Email address ya Phone number |
| `plan` | `string` | No | Plan ka naam (e.g. `Free`, `Pro`, `VIP`, `Business`) |
| `allowedModels` | `string[]`| No | Allowed models/combos ki array. Khali array `[]` ka matlab **All Models** |
| `tokenBudget` | `number` | No | Token limit **Millions** mein (e.g. `20` = 20 Million tokens). Default `null` (Unlimited) |
| `rpmLimit` | `number` | No | Requests Per Minute limit (e.g. `60`). Default `null` (Unlimited) |
| `expiresAt` | `string` | No | ISO Date timestamp jab key expire hogi. Default `null` (Never expires) |

#### Sample Request JSON:
```json
{
  "userId": "usr_1001",
  "userName": "Hasan Ali",
  "userEmail": "hasan@example.com",
  "plan": "Pro",
  "allowedModels": ["auto", "openai/gpt-4o", "anthropic/claude-3-5-sonnet"],
  "tokenBudget": 20,
  "rpmLimit": 60,
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

#### Sample Response (201 Created):
```json
{
  "success": true,
  "userKey": {
    "id": 12,
    "userId": "usr_1001",
    "userName": "Hasan Ali",
    "userEmail": "hasan@example.com",
    "planTier": "Pro",
    "apiKey": "sk-cc835689c755e1c0-daa8ef-259ca21c",
    "apiKeyId": "1d75c12f-c1a9-4307-91e2-5f221ab3105b",
    "allowedModels": ["auto", "openai/gpt-4o", "anthropic/claude-3-5-sonnet"],
    "tokenBudget": 20,
    "tokensUsed": 0,
    "rpmLimit": 60,
    "expiresAt": "2026-12-31T23:59:59Z",
    "isActive": true,
    "createdAt": "2026-10-15T18:00:00.000Z"
  },
  "apiKey": "sk-cc835689c755e1c0-daa8ef-259ca21c"
}
```

#### Code Examples:

**cURL:**
```bash
curl -X POST https://api.tokendeal.cloud/api/v1/reseller/users \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_1001",
    "userName": "Hasan Ali",
    "userEmail": "hasan@example.com",
    "plan": "Pro",
    "allowedModels": ["auto", "openai/gpt-4o"],
    "tokenBudget": 20,
    "rpmLimit": 60
  }'
```

**Node.js / JavaScript:**
```javascript
const response = await fetch("https://api.tokendeal.cloud/api/v1/reseller/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "usr_1001",
    userName: "Hasan Ali",
    userEmail: "hasan@example.com",
    plan: "Pro",
    allowedModels: ["auto", "openai/gpt-4o"],
    tokenBudget: 20,
    rpmLimit: 60
  })
});
const data = await response.json();
console.log("Issued Key:", data.apiKey);
```

**Python:**
```python
import requests

res = requests.post(
    "https://api.tokendeal.cloud/api/v1/reseller/users",
    json={
        "userId": "usr_1001",
        "userName": "Hasan Ali",
        "userEmail": "hasan@example.com",
        "plan": "Pro",
        "allowedModels": ["auto", "openai/gpt-4o"],
        "tokenBudget": 20,
        "rpmLimit": 60
    }
)
print("Issued Key:", res.json()["apiKey"])
```

---

### 1.2 List All Issued Keys & Users
* **Method:** `GET`
* **Endpoint:** `/api/v1/reseller/users`

Return karta hai:
- `userKeys`: Tamam issued CheapRoute API keys with metrics.
- `byokKeys`: Users ki attached personal BYOK provider keys.
- `availableModels`: Active combos aur curated models ki list.
- `publishedProviders`: Wo providers jin par BYOK allow hai.

```bash
curl https://api.tokendeal.cloud/api/v1/reseller/users
```

---

### 1.3 Revoke Key or Delete User
* **Method:** `DELETE`
* **Endpoint:** `/api/v1/reseller/users`

**Option A: Revoke specific API key by ID:**
```bash
curl -X DELETE "https://api.tokendeal.cloud/api/v1/reseller/users?id=12"
```

**Option B: Delete user completely (All API keys + BYOK keys + Profile):**
```bash
curl -X DELETE "https://api.tokendeal.cloud/api/v1/reseller/users?userId=usr_1001"
```

---

## Tab 2: User BYOK Provider Keys (CRUD & State)

Jab user aapki website par kisi AI provider (maslan OpenAI, Claude, Gemini) ke sath **apni personal API key** attach karna chahta hai.

### 2.1 Attach or Update User BYOK Key
* **Method:** `POST`
* **Endpoint:** `/api/v1/reseller/users`
* **Content-Type:** `application/json`

#### Request Body Parameters:
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `action` | `string` | **Yes** | Must be `"addByok"` |
| `userId` | `string` | **Yes** | User ka UID (e.g. `usr_1001`) |
| `providerId` | `string` | **Yes** | Provider ID (e.g. `anthropic`, `openai`, `gemini`, `deepseek`) |
| `apiKey` | `string` | **Yes** | User ki unmasked ya masked API key (e.g. `sk-ant-api03-...`) |
| `userName` | `string` | No | User ka naam (optional metadata) |
| `userEmail` | `string` | No | User ka email/phone (optional metadata) |

*Security Note:* CheapRoute user ki raw key ko database mein save karne se pehle auto-mask karta hai (e.g. `sk-ant...1234`).

#### Sample Request JSON:
```json
{
  "action": "addByok",
  "userId": "usr_1001",
  "userName": "Hasan Ali",
  "userEmail": "hasan@example.com",
  "providerId": "anthropic",
  "apiKey": "sk-ant-api03-abcdef1234567890-xyz"
}
```

#### Sample Response (201 Created):
```json
{
  "success": true,
  "key": {
    "id": 4,
    "userId": "usr_1001",
    "providerId": "anthropic",
    "maskedKey": "sk-ant...-xyz",
    "isPaused": false,
    "requests": 0,
    "tokens": 0,
    "createdAt": "2026-10-15T18:00:00.000Z",
    "updatedAt": "2026-10-15T18:00:00.000Z"
  }
}
```

---

### 2.2 Pause or Resume User's BYOK Key
Agar user ka balance khatam ho jaye ya temporarily key band karni ho bina delete kiye:
* **Method:** `PATCH`
* **Endpoint:** `/api/v1/reseller/users`

```json
{
  "action": "pauseByok",
  "userId": "usr_1001",
  "providerId": "anthropic",
  "paused": true
}
```
*Note:* Resume karne ke liye `"paused": false` bhejein.

---

### 2.3 Disconnect / Delete BYOK Key
* **Method:** `DELETE`
* **Endpoint:** `/api/v1/reseller/users?userId={uid}&providerId={pid}` (ya `?byokId={id}`)

```bash
# Delete by user + provider
curl -X DELETE "https://api.tokendeal.cloud/api/v1/reseller/users?userId=usr_1001&providerId=anthropic"

# Or delete by row ID
curl -X DELETE "https://api.tokendeal.cloud/api/v1/reseller/users?byokId=4"
```

---

## Tab 3: Allowed Providers & Official SVG Icons

Reseller website ke frontend par connectable providers ki cards, names, aur unke official high-resolution SVG logos dikhane ke liye.

* **Method:** `GET`
* **Endpoint:** `/api/v1/public/providers`

#### Sample Response:
```json
{
  "success": true,
  "count": 4,
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "icon": "/providers/openai.svg",
      "iconUrl": "https://api.tokendeal.cloud/providers/openai.svg",
      "status": "connected",
      "modelsCount": 14
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "icon": "/providers/anthropic.svg",
      "iconUrl": "https://api.tokendeal.cloud/providers/anthropic.svg",
      "status": "connected",
      "modelsCount": 8
    }
  ]
}
```

---

## Tab 4: Models & Combos Catalog

User ki key permissions aur active system combos ke mutabiq available models hasil karna. Standard OpenAI compatible format.

* **Method:** `GET`
* **Endpoint:** `/v1/models`
* **Header:** `Authorization: Bearer <USER_API_KEY>`

#### Sample cURL:
```bash
curl https://api.tokendeal.cloud/v1/models \
  -H "Authorization: Bearer sk-your-user-key"
```

#### Sample Response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "auto",
      "object": "model",
      "created": 1700000000,
      "owned_by": "cheaproute"
    },
    {
      "id": "openai/gpt-4o",
      "object": "model",
      "created": 1700000000,
      "owned_by": "openai"
    },
    {
      "id": "anthropic/claude-3-5-sonnet",
      "object": "model",
      "created": 1700000000,
      "owned_by": "anthropic"
    }
  ]
}
```

---

## Tab 5: Chat Completions AI Proxy (Core Engine)

User jab prompt bhejta hai (Cursor, Cline, Next.js, OpenAI SDK, ya Python library ke zariye).

* **Method:** `POST`
* **Endpoint:** `/v1/chat/completions`
* **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <USER_API_KEY>`

### ⚙️ Automatic Fallback & BYOK Routing Logic:
1. CheapRoute request mein user ki API key check karta hai.
2. Agar user ne us model ke provider (e.g. Anthropic) ke liye **BYOK key** attach ki hui hai aur active hai:
   - Request **user ki apni key** ke zariye upstream execute hoti hai.
3. Agar BYOK key nahi hai:
   - Request CheapRoute ke configured **Combos / Upstream Connections** ke zariye execute hoti hai aur user ka token budget deduct hota hai.

#### Sample cURL:
```bash
curl -X POST https://api.tokendeal.cloud/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-user-key" \
  -d '{
    "model": "auto",
    "messages": [
      { "role": "system", "content": "You are a helpful AI assistant." },
      { "role": "user", "content": "Explain quantum computing in one sentence." }
    ],
    "stream": false
  }'
```

#### Python OpenAI SDK Integration:
```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-your-user-key",
    base_url="https://api.tokendeal.cloud/v1"
)

response = client.chat.completions.create(
    model="auto",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
print(response.choices[0].message.content)
```

---

## ⚡ Error Codes & Handling

| Status Code | Error Message / Cause | Solution |
| :---: | :--- | :--- |
| `400 Bad Request` | Missing required fields (UID, Email) | Check payload schema |
| `401 Unauthorized` | Invalid or revoked API key | Re-issue key via Tab 1 |
| `403 Forbidden` | Model not in user's `allowedModels` | Update allowed models or use allowed combo |
| `429 Too Many Requests` | Token budget exhausted or RPM limit reached | Upgrade user plan or increase token budget |
| `502 / 504 Gateway Error` | Upstream provider temporary issue | Router auto-fallbacks to alternative combo targets |
