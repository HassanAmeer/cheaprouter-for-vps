# reseller-models — Reseller Web Platform for CheapRouter

Standalone Next.js 14 app (port **3001**). Plans, subscriptions, BYOK key
vault, usage analytics. Talks to CheapRouter over its programmatic APIs.

## Quick start

```bash
cp .env.example .env.local   # then fill CHEAPROUTE_ADMIN_TOKEN + RESELLER_KEY_SECRET
npm install
npm run seed                 # creates data/reseller.db + default plans/users
npm run dev                  # http://localhost:3001
```

Seeded accounts (no default well-known passwords anymore):

| Role  | Login              | How the password is set                                        |
| ----- | ------------------ | -------------------------------------------------------------- |
| Admin | `admin`            | `RESELLER_ADMIN_PASSWORD` env, or a random one printed on first boot |
| User  | `user1@gmail.com`  | Only with `RESELLER_SEED_DEMO_USERS=true`; password = `RESELLER_DEMO_PASSWORD` or random |
| User  | `user2@gmail.com`  | Only with `RESELLER_SEED_DEMO_USERS=true`; password = `RESELLER_DEMO_PASSWORD` or random |

> Existing `data/reseller.db` files created before this change may still contain the old `1234` password.
> Set `RESELLER_ADMIN_PASSWORD` once and restart to rotate the admin password, or delete `data/reseller.db` to re-seed fresh.

## CheapRouter wiring

| Reseller action              | CheapRouter API used                                   |
| ---------------------------- | ------------------------------------------------------ |
| Landing catalog              | `GET /api/v1/public/providers?all=true` (public)       |
| BYOK visibility              | `GET /api/v1/reseller/byok` (master toggle probe)      |
| Assign plan / regenerate key | `POST /api/keys` (`allowedModels`, `modelLimits`, `rateLimits.requestsPerMinute`, `expiresAt`) |
| Usage analytics              | `GET /api/v1/reseller/users?email=` (best-effort)      |

`CHEAPROUTE_ADMIN_TOKEN` must satisfy CheapRouter's `requireManagementAuth`.
BYOK keys are AES-256-GCM encrypted at rest (`RESELLER_KEY_SECRET`); only
masked references ever leave the vault. Chat traffic uses the user's
`x-upstream-key` header straight against CheapRouter (0 plan tokens deducted).

## Design

Dark only: `#0A0A0A` bg, `#FFFFFF` text, `#C0C0C0` secondary. No neon.
