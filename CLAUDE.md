# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

```
AliBot-PRO/              ← repo root (monorepo)
├── backend/             ← NestJS API (port 3001)
├── frontend/            ← Next.js 14 app (port 3000)
├── nginx/               ← reverse-proxy config (prod only)
├── .env                 ← single env file shared by both apps
└── docker-compose.yml
```

All `npm` commands below are run from their respective subdirectory (`backend/` or `frontend/`).

## Development Commands

### Backend (NestJS)
```bash
npm run start:dev       # hot-reload dev server
npm run build           # compile to dist/
npm run test            # Jest (once)
npm run test:watch      # Jest watch

# TypeORM migrations (requires DATABASE_URL in env)
npm run migration:generate -- src/migrations/<Name>   # diff entities → new migration file
npm run migration:run       # apply pending migrations
npm run migration:revert    # roll back last migration
npm run migration:show      # list applied / pending
```

### Frontend (Next.js)
```bash
npm run dev             # dev server on port 3000
npm run build           # production build
npm run lint            # ESLint
```

### Full stack via Docker
```bash
# Start only Postgres + Redis (recommended for local dev)
docker compose up postgres redis -d

# Full stack
docker compose up -d

# Prod profile (adds Nginx)
docker compose --profile prod up -d
```

## Environment

One `.env` lives at the repo root (not inside `backend/` or `frontend/`). Both the backend and the frontend Dockerfile read it. The backend `ConfigModule` looks for it at `../.env` (repo root) when running from `backend/`, falling back to a local `.env`.

Required variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `ANTHROPIC_API_KEY`.

In **development**, TypeORM uses `synchronize: true` (auto-DDL). In **production** it runs migrations from `dist/migrations/` on startup. The standalone migration CLI (`data-source.ts`) always uses `synchronize: false`.

## Backend Architecture

### Module pattern
Every feature follows: `{name}.entity.ts` → `{name}.service.ts` → `{name}.controller.ts` → `{name}.module.ts` → exported `{Name}Service`. To use a service from another module, import that module and inject the service.

### Auth
- Guards: `@UseGuards(JwtAuthGuard)` — standard Passport JWT guard.
- `req.user` is the full `User` entity inside guarded routes (the JWT strategy returns it); use `req.user.id` for the authenticated user ID.
- Access tokens expire in 15 min; refresh tokens in 30 days and are persisted in DB + `refresh_token` cookie.

### Credentials & encryption
Per-user secrets (AliExpress, Telegram, OpenAI keys) are AES-256 encrypted in the DB. `CredentialsService.getRaw(userId)` returns the decrypted `DecryptedCredentials` object. The `ENCRYPTION_KEY` env var is the 32-byte hex key.

### Scheduler
Four `@Cron` jobs in `CampaignSchedulerService` run every minute: send scheduled posts, process auto-send queue, run active campaigns, clean up stuck posts. A campaign with `use_agents: true` routes through `OrchestratorAgent` instead of `PostsService.runCampaign`.

### Multi-agent system (`src/agents/`)
- `ProductAgent` — Claude tool-use to find & rank AliExpress products.
- `ContentAgent` — Claude tool-use to write optimised Telegram copy (learns from recent sent posts).
- `CampaignAgent` — Claude tool-use to evaluate health, auto-pause on high failure rates, refresh dead keywords.
- `OrchestratorAgent` — Runs the three agents in sequence; logs results to `agent_runs` table.
- Triggered manually via `POST /api/agents/run { campaign_id }` or automatically by the scheduler.

### RatesService
Fetches live USD exchange rates and caches them in Redis for 1 hour. Always use `RatesService.getRate(currencyPair)` — never hardcode rates.

## Frontend Architecture

### Auth flow
`middleware.ts` only redirects unauthenticated users (no API calls, to avoid ISR cache invalidation). Real session validation happens inside the dashboard layout via the `useAuth` hook.

### API client
`frontend/src/lib/api-client.ts` is the shared Axios instance. It attaches the JWT access token from `localStorage` and handles 401 → token refresh automatically. Always use this instance, never create raw `axios` calls.

### Route groups
- `(auth)/` — public pages (login, register, password reset, Google callback)
- `(dashboard)/` — all protected pages; the layout enforces authentication

### Path alias
`@/` resolves to `frontend/src/` — use it for all internal imports.
