# CheapRouter — VPS AI Gateway

Unified OpenAI-compatible AI gateway for a single VPS: **one endpoint, 370+
providers, auto-fallback, combo routing, per-model quotas, BYOK pass-through and
a reseller platform.**

> Based on [diegosouzapw/CheapRoute](https://github.com/diegosouzapw/CheapRoute) (MIT).
> This fork rebrands the dashboard to **CheapRouter**, ships only the docs/CI
> that match this deployment, and adds a reseller platform, per-model quotas,
> BYOK zero-token accounting, an Antigravity multi-account pool and an optional
> opencode-bypass lane.

---

## Table of contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Operator flows](#operator-flows)
  - [1 · Providers](#1--providers-catalog--connections)
  - [2 · Provider detail](#2--provider-detail-models--connections)
  - [3 · Model testing](#3--model-testing-parallel--streaming)
  - [4 · Capabilities & context windows](#4--capabilities--context-windows-measured)
  - [5 · Combos & named routes](#5--combos--named-routes)
  - [6 · API keys & access](#6--api-keys--access)
  - [7 · Reseller / BYOK](#7--reseller--byok)
  - [8 · Usage, limits & logs](#8--usage-limits--logs)
- [Repository layout](#repository-layout)
- [Configuration](#configuration)
- [Testing & quality gates](#testing--quality-gates)
- [Ops & audit tooling](#ops--audit-tooling)
- [Notes](#notes)

---

## What it does

| Capability            | What the operator gets                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Provider catalog**  | 370+ providers, grouped by type (OAuth, API key, CLI, web cookie, free tier, local, proxy …), searchable, filterable  |
| **Credentials**       | API keys, OAuth logins, browser-session cookies, local daemons — per connection, editable, testable, reorderable      |
| **Model catalog**     | Real context windows, real capability badges and real free/paid verdicts — measured, not guessed                      |
| **Model testing**     | Test every model of a provider **in parallel**, with results streaming in as they land                                |
| **Combo routing**     | Named groups of models with 20 routing strategies (priority, round-robin, random, free-first, cost-optimized, auto …) |
| **Quotas & limits**   | Per-model and per-combo token limits, per-connection rate limits, cooldown tracking                                   |
| **API keys**          | Scoped keys with model allow-lists, budgets, expiry and rate limits                                                   |
| **Reseller platform** | Resell access: user accounts, plans, scoped keys, BYOK (customer's own provider key) and provider exposure control    |
| **Observability**     | Request logs, proxy logs, console logs, live dashboard WebSocket, usage & cost analytics                              |

---

## Requirements

- Node.js **>= 22.22.2 < 23** or **>= 24 < 27**
- ~2 GB RAM free for a production build; the running server fits in < 500 MB
- SQLite (WAL) — no external database

---

## Quick start

```bash
cp .env.example .env      # then set JWT_SECRET, API_KEY_SECRET, INITIAL_PASSWORD, STORAGE_ENCRYPTION_KEY
npm install
npm run build             # production build
npm start                 # serves on PORT (default 20128)
```

Under pm2 (this deployment):

```bash
pm2 start scripts/dev/run-next.mjs --name cheaprouter --interpreter node -- start
pm2 save
```

`npm run dev` runs the dev bundler — use it for development only.

---

## Operator flows

### 1 · Providers (catalog → connections)

```
Sidebar → Providers
   ├─ Tabs (status)      All · Recent · Connected · Needs setup · Reseller / BYOK
   ├─ Toolbar             Search providers · Search by model · Test all
   │                      TYPE  → "All types" dropdown   (one axis: type)
   │                      MEDIA → Image / Video / Music / TTS / STT / Embedding
   └─ Section index       OAuth Providers 2/18   ← count + description, click to open
                          API Key Providers 1/293
                          CLI & Local Agent Tools 9/12
                          Free Tier Providers 12/174
                          …
```

- **One axis per level**: sidebar = _task_, tabs = _status_, sections = _type_.
  The type filter is a single dropdown — there is no second, conflicting chip row.
- **Counts come from one source**, so a chip and a section header can never disagree.
- Pick a type → only that section opens, with its provider cards
  (logo, free badge, capability tags, Connect, info/guide icon).

### 2 · Provider detail (Models | Connections)

```
/dashboard/providers/<id>
   ├─ Header      name · ⓘ info (guide sheet) · status · Connect / Disconnect
   ├─ Tabs        Models | Connections
   ├─ MODELS      Add Custom Model · Available Models Table
   │              (context window, capabilities, billing tier, test button per row)
   └─ CONNECTIONS per-connection row: priority & reorder, status, expiry,
                  protection/proxy toggles, Test message, Retest, Token refresh,
                  Edit, Delete (with confirm) · Disconnect all · Add connection
```

The **Connections** tab is where credentials live: every connection is listed,
editable, testable and deletable. The **ⓘ icon** opens the provider guide
(requirements, measured limits, free models, how to connect).

### 3 · Model testing (parallel + streaming)

```
"Test all models" (one provider)
   → POST /api/models/test-all  { providerId, modelIds[], stream: true }
   → server probes models with BOUNDED PARALLELISM (default 6, env
     MODEL_TEST_ALL_CONCURRENCY, hard cap 16)
   → NDJSON: one line per FINISHED model  { modelId, entry }
   → dashboard paints each model the moment it resolves
```

Safety rules that are preserved:

- paid models are skipped (no dispatch) when `hidePaidModels` is on,
- a run of consecutive 429s stops the batch (the upstream is down),
- web-session providers that ban burst probes (Arena) stay strictly sequential,
- per-connection rate limiting (`withRateLimit`) still applies.

### 4 · Capabilities & context windows (measured)

Everything the dashboard shows about a model is resolved server-side and
labelled with its source — the UI never guesses silently.

```
GET /api/models/metadata?provider=<id>
   → { modelId: { contextWindow, capabilities{vision,reasoning,tools,audio,video,…},
                   contextSource, capabilitySource, meta{family,status,releaseDate,…} } }
```

| Source       | Meaning                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `models.dev` | Measured by the models.dev catalog (limit_context, modalities, tool_call, reasoning, attachment) |
| `live`       | Reported by the provider itself during model discovery ("Fetch All Models")                      |
| `registry`   | CheapRoute's curated provider registry                                                           |
| `none`       | No source published it → the row shows `—` and says so                                           |

The models.dev sync is **on by default** (it is the only source with measured
modality/limit data for ~239 providers). Disable with
`MODELS_DEV_SYNC_ENABLED=0` or from Settings → AI.

### 5 · Combos & named routes

```
Sidebar → Combos
   → a combo = named group of models + a routing strategy
   → invoked by model name:  { "model": "my-combo" }  (also "combo/my-combo")
```

20 strategies are available, including `priority`, `round-robin`, `random`,
`strict-random`, `cost-optimized`, `context-optimized`, `fusion`, `pipeline` and
`auto`. `auto/*` is the virtual tier family (`auto/best-free`, `auto/fast` …).

Planned named routes (built on the same primitive — a combo):

| Route       | Meaning                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `/v1`       | pinned to one operator-selected model                                            |
| `/bestfree` | free-first pool: free models first (random / round-robin), paid only as fallback |

### 6 · API keys & access

```
Sidebar → API Keys → /dashboard/api-manager/<id>/access
   ├─ Models       allow-list per provider (`provider/*`) or per model
   ├─ Combos       which combos the key may call (`combo/*` = all)
   ├─ Connections  which connections the key may use
   └─ Behaviour    budgets, expiry, rate limits
```

### 7 · Reseller / BYOK

Two actors, one policy:

```
A · OPERATOR (you)                         B · RESOLD USER (your customer)
  1 connect providers (your credentials)     A create account + plan (tier, budget,
  2 choose exposure  publishedProviders        RPM, model quotas)
    → which providers appear in the        1 receive a scoped API key
      resold catalog (empty = all)           2 optionally add their OWN provider key
  3 BYOK master switch byokEnabled             (BYOK) — pausable per key
    OFF ⇒ their key is rejected
  4 pooled credential — used when the
    user's own key is not used
```

Request routing:

```
user API key (+ x-upstream-key = BYOK)
   → master switch ON?  → key paused?  → YES: BYOK key goes upstream (user is billed)
                                             NO : operator's pooled credential
```

`publishedProviders` is currently editable from **three** surfaces
(Providers → Reseller/BYOK tab, Endpoint → Showcase Providers, Users → Allowed
Providers stat). Keep **one editor** and turn the others into links, otherwise
the panels can drift (last-write-wins).

### 8 · Usage, limits & logs

```
Sidebar → Usage     token & provider consumption, cost breakdown
Sidebar → Quotas    model & combo token limits (the "Limits Bank")
Sidebar → Logs      request logs · proxy logs · console logs
Sidebar → Playground  live multimodal testbench
```

---

## Repository layout

| Path               | What it is                                                             |
| ------------------ | ---------------------------------------------------------------------- |
| `src/`             | Next.js 16 app — dashboard, API routes, auth, DB domain modules        |
| `open-sse/`        | Streaming engine — providers, executors, translators, MCP/A2A servers  |
| `reseller-models/` | Standalone Next.js 14 reseller platform (plans, subscriptions, BYOK)   |
| `bin/`             | `cheaproute` CLI                                                       |
| `scripts/`         | Build / dev / ops tooling (`scripts/dev/run-next.mjs` runs the server) |
| `scripts/ad-hoc/`  | One-off diagnostic + audit helpers (UI walk, live probes)              |
| `docs/specs/`      | Operator flow specs for this deployment                                |
| `docs/ui-audit/`   | UI audit artifacts: flow sheets + page mockups (PNG/HTML)              |
| `tests/unit/`      | Unit tests (node:test) for the fork-specific additions                 |

---

## Configuration

The important keys (full list in `.env.example`):

| Key                                                        | Purpose                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `JWT_SECRET` / `API_KEY_SECRET` / `STORAGE_ENCRYPTION_KEY` | Signing + credential encryption at rest               |
| `INITIAL_PASSWORD`                                         | First-login password for the dashboard                |
| `PORT` (default `20128`), `DATA_DIR`                       | Where the server listens, where the SQLite file lives |
| `REQUIRE_API_KEY`                                          | Require an API key for `/v1` inference                |
| `MODELS_DEV_SYNC_ENABLED=0`                                | Kill switch for the models.dev capability/price sync  |
| `OPENCODE_BYPASS_ENABLED`                                  | Enable the optional opencode-bypass lane (see below)  |

---

## Testing & quality gates

```bash
npm run lint          # ESLint (suppressions in config/quality/)
npm run typecheck     # advisory in this fork (pre-existing upstream errors)
npm test              # node:test suite (tests/unit/**)
npm run test:coverage # same suite with coverage
npx vitest run        # component/UI tests (src/app/**/__tests__/**)
```

Both runners must be green: they cover non-overlapping files (the node suite
covers the server/domain code, vitest the React components).

---

## Ops & audit tooling

`scripts/ad-hoc/` holds the helpers used to audit the live dashboard:

| Script                        | What it does                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-audit.mjs`                | Walks every main page at 1280px & 375px, reports skip-link/heading duplication, focusable off-screen panels, overflow, console errors |
| `detail-probe.mjs`            | Dumps what a provider detail page actually renders                                                                                    |
| `verify-index.mjs`            | Asserts the providers section index (rows, counts, type select, no leftover chips)                                                    |
| `verify-sidebar.mjs`          | Asserts the sidebar groups and items                                                                                                  |
| `verify-connections.mjs`      | Asserts the provider detail tabs and connection rows                                                                                  |
| `verify-metadata-ui.mjs`      | Asserts the model table shows measured capabilities/context + their source                                                            |
| `shot.mjs`, `render-html.mjs` | Page screenshots and HTML → PNG rendering                                                                                             |

```bash
BASE_URL=http://<host>:20128 PASSWORD=<pw> node scripts/ad-hoc/ui-audit.mjs
```

---

## Notes

- Upstream CheapRoute's documentation tree is not shipped in this fork; the
  operator specs in `docs/specs/` describe the intended flow instead.
- `reseller-models/` is a separate app (port 3001) — see its own README. There
  are **no well-known default passwords**: the admin password comes from
  `RESELLER_ADMIN_PASSWORD` (or a random one printed on first boot).
- `opencode-bypass` is **disabled by default** and routes traffic around the
  upstream free-tier gate — read
  `src/lib/providers/opencode-bypass/README.md` before enabling it.
- `LICENSE` remains MIT (upstream copyright applies).
