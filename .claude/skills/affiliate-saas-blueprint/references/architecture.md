# Architecture

## Repo layout

A two-app monorepo with a single shared env file. The single `.env` matters: the backend and
the frontend's Docker build both read it, and splitting it into two files reliably produces
"works locally, broken in Docker" drift.

```
<project>/
├── backend/            NestJS API (port 3001)
│   └── src/
│       ├── <feature>/  one directory per feature module
│       ├── common/     cross-cutting utilities (crypto, ssrf, retry, cache)
│       ├── config/     ConfigModule setup
│       ├── migrations/ TypeORM migrations
│       ├── app.module.ts
│       └── main.ts
├── frontend/           Next.js App Router (port 3000)
├── nginx/              reverse proxy (prod profile only)
├── .env                shared by both apps
└── docker-compose.yml
```

Backend `ConfigModule` looks for `../.env` (repo root) when running from `backend/`, falling
back to a local `.env`.

## Module pattern

Every feature is the same five files. Deviating costs more than it saves — with 40 modules,
predictability is the feature.

```
<name>/
├── <name>.entity.ts      TypeORM entity (if it owns tables)
├── <name>.service.ts     business logic; the only place that touches repositories
├── <name>.controller.ts  HTTP surface; guards + DTO validation, no logic
├── <name>.module.ts      wiring; exports the service
└── <name>.service.spec.ts
```

To use a service from another module: import that module, inject the service. Never reach
into another module's repository directly — that is how you end up with two places writing
the same table with different invariants.

## Reference module inventory

From the production system, roughly in dependency order. Use it as a checklist of what a
mature build contains, not as a required set.

**Core** — `auth`, `users`, `credentials`, `config`, `common`
**Domain** — `campaigns`, `posts`, `products`, `catalog`, `channels`, `templates`
**Sources** — `suppliers`, `amazon`, `discovery`
**Publishing** — `integrations`, `collage`, `pricing`, `rates`
**AI** — `ai`, `agents`
**Automation** — `scheduler`, `optimizer`, `recovery`, `promotions`, `coupons`
**Money** — `subscription`, `payments`, `earnings`, `links`
**Ops** — `watchdog`, `notifications`, `mail`, `security`

## Entities

The entity set that carries the system. Every one except `User` has `user_id`.

| Entity | Owns |
|---|---|
| `User` | account, plan, credits |
| `CredentialSet` | per-user encrypted API keys + global schedule defaults |
| `Campaign` | keywords, cron, filters, target channels/platforms, cursor |
| `Post` | one publish unit: content, images, status, schedule, channel overrides |
| `PostedProduct` | dedup ledger — which product went to which campaign, when |
| `Channel` | a destination group/page with its own window + interval |
| `Template` | reusable copy body/footer |
| `CatalogProduct` | cached product data |
| `LinkTarget` / `LinkClick` | short links and click events |
| `Earning` | attributed revenue |
| `AgentRun` / `OptimizerRun` / `AiUsage` | automation audit trails |
| `SecurityEvent` | auth/admin audit |
| `PaymentSession` | checkout state |

### Campaign is the central config object

Its columns define almost every behaviour downstream. Group them deliberately:

- **Identity/state** — `name`, `status` (`draft|active|paused`), `source`
- **Search** — `keywords[]`, `category_id`, `min_price`, `max_price`, `min_rating`,
  `min_discount`
- **Schedule** — `schedule_cron`, `posts_per_run`, `next_run_at`, `last_run_at`,
  optional per-campaign window + timezone
- **Targeting** — `target_channels` (JSON array of channel ids), `target_platforms`
  (JSON array; `null` = all)
- **Content** — `language`, currency override, template ids
- **Rotation** — `keyword_cursor` (integer, monotonically increasing, mod keyword count)
- **Automation** — `use_agents`, seasonal opt-in

Store JSON-ish arrays as `text` holding JSON, or as a native array column — pick one and be
consistent. Mixed representations force `JSON.parse` guards everywhere (the production system
uses `text` + `JSON.parse` in a try/catch helper; if starting fresh, prefer `jsonb`).

## Database

TypeORM, PostgreSQL, Redis for cache.

- **Development**: `synchronize: true` (auto-DDL).
- **Production**: `synchronize: false`, run migrations from `dist/migrations/` on startup.
- **CLI** (`data-source.ts`): always `synchronize: false`.

```bash
npm run migration:generate -- src/migrations/<Name>
npm run migration:run
npm run migration:revert
npm run migration:show
```

**Deploy trap**: on a brand-new empty database, migrations that assume a baseline schema
fail. Make the first migration self-building — able to create the schema from nothing —
or the first production deploy on a fresh DB dies at boot.

**Enable row-level security** on all public tables if using a managed Postgres (Supabase et
al.) where the anon key is exposed. Application-level `user_id` filtering does not protect
you when the database is reachable directly.

Index what the cron scans: `posts(status, scheduled_at)`, `posts(campaign_id, created_at)`,
`posted_products(campaign_id, created_at)`, `campaigns(status, next_run_at)`. The per-minute
schedulers scan these tables constantly.

## Environment variables

Required: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`
(64 hex chars = 32 bytes), `BACKEND_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`.
Optional per feature: OAuth client id/secret, AI provider keys (platform fallback only),
mail transport, `SCHEDULER_TZ`.

`ENCRYPTION_KEY` must **throw at boot in production** if missing or malformed. A dev
fallback key that silently activates in production encrypts every customer secret with a
key that is visible in source control.

## Deployment

`docker compose up postgres redis -d` for local development (run the apps natively for
hot reload). Full stack and a `prod` profile adding Nginx.

Host choice has a real consequence: **free/idle-scaling hosts suspend the process, which
kills every cron job silently.** See `reliability.md` for the keep-alive pattern and why it
is only a partial fix.
