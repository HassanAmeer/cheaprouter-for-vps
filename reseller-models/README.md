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

Pre-seeded accounts (password `1234`):

| Role  | Login              |
| ----- | ------------------ |
| Admin | `admin`            |
| User  | `user1@gmail.com`  |
| User  | `user2@gmail.com`  |

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
