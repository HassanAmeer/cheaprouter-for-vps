# CheapRouter — VPS AI Gateway

Unified OpenAI-compatible AI gateway: one endpoint, many providers, auto-fallback,
combo routing, per-model API-key quotas, BYOK pass-through, and a reseller
platform. Built for self-hosted deployments on a single VPS.

> Based on [diegosouzapw/CheapRoute](https://github.com/diegosouzapw/CheapRoute) (MIT).
> This fork rebrands the dashboard to **CheapRouter**, strips the docs/CI that do not
> match this deployment, and adds a reseller platform, per-model quotas, BYOK
> zero-token accounting, an Antigravity multi-account pool, and an optional
> opencode-bypass lane.

## Repository layout

| Path                 | What it is                                                            |
| -------------------- | --------------------------------------------------------------------- |
| `src/`               | Next.js 16 app — dashboard, API routes, auth, DB domain modules       |
| `open-sse/`          | Streaming engine — providers, executors, translators, MCP/A2A servers  |
| `reseller-models/`   | Standalone Next.js 14 reseller platform (plans, subscriptions, BYOK)  |
| `bin/`               | `cheaproute` CLI                                                      |
| `scripts/`           | Build / dev / ops tooling (`scripts/dev/run-next.mjs` runs the server) |
| `docs/specs/`        | Operator flow specs for this deployment (the a-to-z prompt documents)  |
| `tests/unit/`        | Unit tests for the fork-specific additions                             |

## Requirements

- Node.js **>= 22.22.2 < 23** or **>= 24 < 27**
- ~2 GB RAM free for a production build; the running server fits comfortably in < 500 MB

## Quick start

```bash
cp .env.example .env          # then edit: JWT_SECRET, API_KEY_SECRET, INITIAL_PASSWORD, STORAGE_ENCRYPTION_KEY
npm install
npm run build                 # production build
npm start                     # serves on PORT (default 20128)
```

Under pm2:

```bash
pm2 start scripts/dev/run-next.mjs --name cheaprouter --interpreter node -- start
pm2 save
```

Use `npm run dev` only for local development — production should always run the
built server, not the dev bundler.

## Reseller platform (`reseller-models/`)

Standalone Next.js 14 app (port 3001) with plans, subscriptions, BYOK vault
(AES-256-GCM) and usage analytics. See `reseller-models/README.md`.

```bash
cd reseller-models
cp .env.example .env.local    # fill CHEAPROUTE_ADMIN_TOKEN + RESELLER_KEY_SECRET + RESELLER_ADMIN_PASSWORD
npm install
npm run seed
npm run build && npm start
```

There are **no well-known default passwords**: the admin password comes from
`RESELLER_ADMIN_PASSWORD` (or a random one printed on first boot), and demo
users are only created when `RESELLER_SEED_DEMO_USERS=true`.

## opencode-bypass (optional, use at your own risk)

An optional lane that talks to the opencode.ai free inference endpoint. It is
**disabled by default**; set `OPENCODE_BYPASS_ENABLED=true` to enable it. This
routes traffic around the upstream free-tier gate and may violate the upstream
terms of service — read `src/lib/providers/opencode-bypass/README.md` before
enabling, and keep it off in shared deployments.

## Notes

- Upstream CheapRoute's documentation tree is not shipped in this fork; the
  operator specs in `docs/specs/` describe the intended flow instead.
- `LICENSE` remains MIT (upstream copyright applies).
