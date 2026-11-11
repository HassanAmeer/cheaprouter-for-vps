# 🌐 Multi-website (Sites & Subdomains) — operator flow (short spec)

> **Ye meri samajh hai** — compact form, comments dein to theek kar deta hoon.
> Flow chart + dark design: `docs/ui-audit/sites-design.*` · related: `routes-flow.md`

---

## 1️⃣ Samajh

- 🏢 Aapka **ek backend** (yeh app) — aur aapki **1–2 alag websites** (frontend apps).
- Har website ka **apna subdomain** ho sakta hai: `site-a.myapp.com`, `site-b.myapp.com`.
- Har website ko apni **alag route/model list** chahiye (site-A ko `/v1`, site-B ko `/bestfree`).
- Har website ka **apna usage** alag track ho (kaun, kitna, kis model se).
- Website ka **naam** admin me dikhe (display), aur uska **slug/subdomain** routing key bane.

**Ek shabd:** *Site = tenant* — aapki har website ek tenant hai.

---

## 2️⃣ Aaj vs chahiye

| Aaj | Chahiye |
| --- | --- |
| ❌ Site/tenant concept hi nahi | 🆕 `sites` table (name, slug, subdomain, status) |
| ❌ `api_keys` me site nahi | 🆕 `api_keys.site_id` → key se site pata chale |
| ❌ `publishedProviders` global | 🆕 **per-site** exposure (site ka apna model set) |
| ❌ Route site-scoped nahi | 🆕 `site_routes` (site → route) |
| ✅ Host header already padha jaata hai (`isLoopbackHost`) | ✅ host-based site resolve mumkin hai |
| ✅ `call_logs` / `usage_history` me `api_key_id` | ✅ site dimension add → per-site usage |
| ✅ `domain_cost_history` (api_key_id) | ✅ reuse for per-domain costing |

---

## 3️⃣ Site resolve — priority order (request aate hi)

```
1. API key → api_keys.site_id        ← primary (sabse reliable)
2. Host header      Host: site-a.myapp.com → slug "site-a"
3. X-CheapRoute-Site: site-a          → proxy/CDN ke peeche bhi kaam kare
4. (kuch nahi mila)                    → global scope (default route)
```

**TLS:** ek **wildcard cert** `*.myapp.com` (Let's Encrypt DNS-01) → har subdomain
kaam karega, per-site cert nahi banani.

**nginx:**
```nginx
server_name ~^(?<sub>[a-z0-9-]+)\.myapp\.com$;
proxy_set_header X-CheapRoute-Site $sub;   # fallback signal
proxy_set_header X-Forwarded-Host $host;
```

---

## 4️⃣ Flow — Admin (ek baar per website)

```
Sites page → "+ New site"
   ├─ Name (display)      "Site A — blog"
   ├─ Slug / subdomain    site-a  → site-a.myapp.com
   ├─ Routes assign        /v1  (selected models)      ·  /bestfree (free-first)
   ├─ Models exposed      is site ko sirf yehi models dikhein (GET /v1/models)
   ├─ Limits               site RPM / budget  (+ route ka apna limit)
   ├─ Keys issue           site-scoped API key(s) → front me lagao
   └─ Usage                is site ka apna usage + cost
```

## 5️⃣ Flow — Runtime (har call)

```
Request → resolve site (key → host → header → global)
   → route resolve (site ki routes ∩ user ki key ki routes)
   → candidates (site exposed models ∩ route models ∩ quota)
   → strategy (free-first / priority / RR) → connection (priority + failover)
   → limits (site + route + model RPM, user budget)
   → usage charge  (site × user × route × model)
   → stream response
```

## 6️⃣ Flow — Frontend (aapki website)

```
site-a.myapp.com  →  GET /v1/models   → sirf site-A ke models (names + limits)
                    →  POST /v1/chat/completions (site ki key se)
```

---

## 7️⃣ Mera proposal (ek line per point)

1. 🆕 `sites` table: `id, name, slug, subdomain, status, notes` (+ `site_id` on `api_keys`, `call_logs`, `usage_history`).
2. 🔑 **Key-first** site resolve (host/header sirf fallback) — key hi sabse reliable signal hai.
3. 🧭 `site_routes` + per-site `exposedModels` → `GET /v1/models` site-scoped.
4. 📊 Usage ek nayi table `site_usage` (ya `call_logs.site_id` column) — dashboard me per-site breakdown.
5. 🚦 Limits: site → route → model (teeno levels), token-bucket per model.
6. 🌐 Wildcard TLS `*.myapp.com` + nginx `X-CheapRoute-Site` header.
7. 🔁 Cross-site failover: combo step (doosre site ka backend) — already supported.

---

## 8️⃣ Open sawal (aap se)

1. ❓ Site scope **key** se pakka karein, ya **host** se (ek hi key multiple domains par)?
2. ❓ Ek website ke **multiple subdomains** chahiye (blog + api) ya ek hi subdomain per site?
3. ❓ Site ka apna **model pool** bhi ho (site-A sirf uske models), ya sirf routes alag?
4. ❓ Usage per site **alag API key** se aayega, ya aap koi **master key** bhi rakhenge jo sab sites ka mix dikhaye?
