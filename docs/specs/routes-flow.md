# 🧭 Routes, Limits & Failover — operator flow (short spec)

> **Ye meri samajh hai** — compact form. Agar koi line galat lage to batao, main usi ko
> theek karke aage badhunga. Flow chart + dark design: `docs/ui-audit/routes-flow.*`.

---

## 1️⃣ Aapka business (samajh)

- 🌐 **Aapki apni website + admin** — yeh app (backend + dashboard).
- 🔌 Aap **providers connect** karte ho (custom / OAuth / API key) → models load hotay hain →
  sirf **kaam karne wale** models rakhte ho → unhe **alias/rename** karte ho
  (e.g. `gpt-5.6-luna` → "Luna Fast") → har model par **per-minute limit** lagate ho.
- 📦 In models se **routes** (named endpoints) banate ho:
  - `/v1` — OpenAI-compatible, aapke **select kiye hue** models follow karta hai
  - `/bestfree` — aapki ~10-20 selected API models me se **free wale** subset → free-first
  - dono OpenAI-compatible hain; farq sirf **kis taraf** point karte hain
- 👥 **Har user ka apna usage** count hota hai (kitna use kiya) + **Limits Bank** sab
  routed models par lagta hai.
- 🏢 **Scope alag-alag** ho sakta hai: aapki apni site → ek route, global users → doosra,
  free-tier users → teesra.
- 🔁 **Custom provider down** ho to **doosre upstream** se fetch (aapki doosri site ka backend).

---

## 2️⃣ Aaj kya hai vs kya chahiye

| Aaj (combos) | Chahiye |
| --- | --- |
| Combo = named model group + strategy | ✅ reuse ho sakta hai |
| ❌ Published endpoint nahi (`/v1`, `/bestfree` jaisa URL + apni key) | ➕ **Route** = published, scoped endpoint |
| ❌ Scope nahi (global / site / user-tier) | ➕ `scope` per route |
| ❌ Route ka apna exposed model list nahi (frontend site ko dikhane wala) | ➕ route → `GET /v1/models` filtered |
| ⚠️ Free-first sirf `auto/*` virtual combos me | ➕ user-created combo me `free-first` strategy |
| ✅ Priority failover (same provider, multiple connections) | ✅ already hai |
| ✅ Combo step se doosre provider par fallback | ✅ reuse for cross-site failover |
| ✅ Per-user per-model usage (`UserModelUsage`) | ✅ reuse |
| ⚠️ Per-model per-minute limit (Limits Bank) | ➕ route/model par RPM token-bucket |

**Ek shabd mein:** *Combo = engine* (kaise choose karna hai) · **Route = product** (public
endpoint, scope, limits, exposed models).

---

## 3️⃣ Flow — A: Operator setup (ek baar)

```
Connect provider(s) ──▶ Fetch models ──▶ "kaam karne wale" models rakho
      │                                        │
      │                                   alias / rename  (Luna Fast)
      │                                        │
      │                              per-model RPM limit  (Limits Bank)
      ▼                                        ▼
   Route banao:  /v1  (selected models)   ·   /bestfree  (free-first subset)
                 scope: global | site | user-tier
                 strategy: priority | round-robin | free-first | random
                 ↓
   Publish:  base URL + key  →  frontend site apne route ke models dikhata hai
```

## 4️⃣ Flow — B: Request (har call)

```
Client → POST /v1/chat/completions  { model: "..." }
   │
   ├─ ① Route resolve      model name → route (scope-aware: is user/site ka route)
   ├─ ② Candidates         enabled models ∩ route.models ∩ limits me quota hai
   ├─ ③ Strategy           free-first → free pool → random/RR → paid fallback
   ├─ ④ Connection resolve priority order (same provider) → failover next connection
   │        └─ cross-provider failover: combo step → doosre site ka backend
   ├─ ⑤ Limits Bank        per-model RPM token-bucket  (+ per-user budget)
   ├─ ⑥ Usage charge       (user, model, route) → usage tables
   └─ ⑦ Stream response
```

## 5️⃣ Flow — C: Per-user / per-site isolation

```
User key ──▶ scope match ──▶ route A (us user ki list) ──▶ usage (user, model, route)
             (global / site-A / site-B / free-tier)
Frontend site ──▶ /v1/models?scope=site-A  → sirf us site ke models
```

## 6️⃣ Flow — D: Custom provider failover (do upstreams)

```
custom provider "acme"  (2 connections)
   conn#1  base=A  priority 1   ──✗ timeout/5xx──▶
   conn#2  base=B  priority 2   ──✗──▶ error + circuit breaker (us window me band)
   (cross-provider: combo step → doosri site ka backend)
```

---

## 7️⃣ Mera proposal (ek sentence per point)

1. 🆕 **Route** entity = combo + `scope` + `published` + `rpm` + `exposedModels`.
2. 🎯 `/v1` aur `/bestfree` **preset routes** banayein (ek click: `/v1` = all selected, `/bestfree` = free subset).
3. 🔀 `free-first` ko **real combo strategy** banayein (auto/* wali logic reuse).
4. 🚦 `GET /v1/models` **route-scoped** ho → har frontend apni list dikhaye.
5. ⏱️ Limits Bank = per-model RPM token-bucket, route se linked.
6. 📊 Usage = per (user, model, route) — `UserModelUsage` par route dimension add.
7. 🔁 Cross-site failover = combo step (doosre provider ka model) — already supported.
8. 🧭 Custom-provider multi-upstream = ek hi prefix ke multiple connections + priority (already supported).

---

## 8️⃣ Open sawal (aap se)

1. ❓ `/v1` aur `/bestfree` **alag base URL** honge (e.g. `.../v1` vs `.../bestfree`) ya same URL par model-name se choose?
2. ❓ Scope kis basis par hoga — **API key** (har user ki key par ek scope) ya **host/header** (site-A vs site-B)?
3. ❓ `/bestfree` sirf **free** models, ya free + "OAuth ke saath chalne wale" paid-looking models bhi?
4. ❓ Per-minute limit **har model** par, ya **har route** par?
