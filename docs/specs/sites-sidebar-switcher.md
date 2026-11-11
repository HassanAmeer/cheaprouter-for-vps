# 🌐 Sites + Sidebar Switcher (multi-website, multi-subdomain) — short spec

> **Ye meri samajh hai** — compact. Comment dein to theek kar deta hoon.
> Related: `routes-flow.md` · `sites-multi-tenant.md` · design: `docs/ui-audit/sites-sidebar.*`

---

## 1️⃣ Aapka requirement (samajh)

1. 🏷️ **Shuru mein website ka NAAM** dete ho (display naam).
2. 🌐 Us site ke liye **ek se zyada subdomain** rakh sakte ho (`site-a.myapp.com`,
   `www.site-a.myapp.com`, `api.site-a.myapp.com`).
3. 🎯 **Site select karte hi poora sidebar** us site ka ho jata hai (Providers, Keys,
   Usage, Logs…) + **upar likha/dropdown** hota hai ke abhi konsa site active hai.
4. ➕ **"+" button** se naya website add ho sake.
5. ⚡ **Speed bilkul na gire** — is liye **saare subdomains ek JSON file** me rakhne hain
   (project ke andar).
6. 🏢 Ye sab **multiple websites** ke liye kaam kare.

---

## 2️⃣ Data: subdomains JSON file (project ke andar)

**`config/sites.json`** — boot par ek baar read → in-memory `Map<host, siteId>`:

```json
{
  "sites": [
    {
      "id": "site-a",
      "name": "Site A — blog",
      "subdomains": ["site-a.myapp.com", "www.site-a.myapp.com", "api.site-a.myapp.com"]
    },
    { "id": "site-b", "name": "Site B — app", "subdomains": ["site-b.myapp.com"] }
  ]
}
```

| Kya | Kahan |
| --- | --- |
| Site ki **subdomains** (routing truth) | `config/sites.json` (repo file) |
| Site ki **operational** data (routes, exposed models, keys, limits, usage) | DB (site_id se) |

**➕ "Add site" button** → JSON file me append (atomic write) → in-memory map reload →
foran active. (File hi source of truth — DB me duplicate nahi.)

---

## 3️⃣ Site resolve — speed first (har request)

```
1️⃣ Host header → in-memory Map lookup      ← O(1), ZERO DB, ZERO disk
2️⃣ API key → api_keys.site_id              ← DB (sirf tab key resolve me)
3️⃣ X-CheapRoute-Site header                ← nginx proxy/CDN ke peeche
4️⃣ default → global scope
```

**Speed guarantee:** subdomain→site mapping **boot par ek baar** memory me → har request
me sirf ek `Map.get()` → koi DB hit nahi, koi disk I/O nahi. (JSON file reload sirf
tab hota hai jab aap "+" se site add/edit karein.)

Site ka route/model set bhi **in-memory cache** me (version-based invalidation, jaise
aaj model catalog cache chalta hai) → request path par DB nahi.

---

## 4️⃣ Sidebar — site-scoped

```
┌───────────────────────────────┐
│ [logo] CheapRoute        v1.0│
├───────────────────────────────┤
│ ▾ Site A — blog          [ + ]│  ← dropdown (current site) + "add site"
│   site-a.myapp.com            │
│   www.site-a.myapp.com        │  ← subdomains (multi)
├───────────────────────────────┤
│ CHEAPPROXY                    │
│  Providers      ← sirf is site│
│  Combos                      │
│  Pipe Models                 │
│  Limits Bank                 │
│  Users                       │
│  API Keys                    │
│  API Endpoints               │
│  Usage                       │
└───────────────────────────────┘
```

- 🎯 **Site select = scope switch** → Providers/Keys/Usage/Logs sab us site ke (query
  param `?site=<id>` ya header — UI + API dono).
- 🏷️ **Top par dropdown** yaad dilata hai ke abhi konsa site active hai.
- ➕ **"+"** → naya site (naam + subdomains) → JSON file + DB rows.

---

## 5️⃣ Flow — Aapka roz ka kaam

```
Side bar dropdown → "Site B — app"
   → sidebar ab Site B dikhata hai (providers/keys/usage us site ke)
   → "+" → naya site (naam + subdomains list)
   → us site ke liye routes/keys/limits assign
   → usage alag alag
```

## 6️⃣ Flow — Request (site A ka user)

```
site-a.myapp.com  →  Host lookup (memory)  →  site-a
   → route resolve (site A ki routes ∩ key ki routes)
   → models (site A exposed ∩ route)  →  strategy  →  connection (failover)
   → limits (site → route → model)
   → usage: site-a × user × route × model
```

---

## 7️⃣ Mera proposal (ek line per point)

1. 📁 `config/sites.json` = subdomains ka source of truth; boot par ek baar read →
   in-memory `Map<host, siteId>` (**request path par zero I/O**).
2. 🎛️ Sidebar top par **site dropdown + "+"**; active site dropdown + sidebar labels
   dono se pata chale.
3. 🔀 Site switch = **scope param** (`?site=<id>`) → UI + API dono filter hon.
4. ➕ "Add site" → JSON file me atomic append + map reload + DB bootstrap rows.
5. 🗄️ Site ki operational data DB me (`sites`, `api_keys.site_id`, `call_logs.site_id`,
   `site_routes`, `site_limits`).
6. 📊 Usage per site: `call_logs.site_id` + dashboard me per-site breakdown.
7. 🔐 Wildcard TLS `*.myapp.com` — har subdomain bina alag cert ke.

---

## 8️⃣ Open sawal (aap se)

1. ❓ Site switch **sidebar dropdown** se ho, ya **top header** me bhi ho?
2. ❓ Ek site ke subdomains **UI se add** honge (file write) ya sirf file me manually?
3. ❓ Scope sirf UI/usage tak ho, ya **routing** bhi site-scope ho (site A sirf apne models hi route kare)?
4. ❓ Site ke apne **API keys** alag honge, ya ek master key + site header?
