---
name: affiliate-saas-blueprint
description: >-
  Production blueprint for a multi-tenant SaaS that finds products from affiliate sources
  (AliExpress, Amazon, supplier feeds), writes AI marketing copy, and publishes on a schedule
  to Telegram / Facebook / Instagram / WhatsApp / Pinterest — with per-user encrypted API
  keys, subscription plans and feature gating, click tracking and revenue attribution, and a
  cron scheduler. Use it whenever the user wants to build, clone, re-skin, or extend an
  affiliate marketing automation platform, a social auto-posting SaaS, a product-feed
  publisher, a Telegram/WhatsApp deals-channel bot, a dropshipping content engine, or any
  multi-tenant system where per-user credentials drive scheduled publishing — including when
  described loosely ("like the system we built for X", "מערכת פרסום אוטומטי", "בוט דילים
  לטלגרם") without naming a stack. Also use it when working INSIDE such a system on
  scheduling, publishing, dedup, plan gating, or affiliate-API integration.
---

# Affiliate Automation SaaS — Blueprint

This skill encodes a **working production system**, not a theoretical design. Every invariant
below exists because its absence caused a real, diagnosed failure: silent publishing outages,
duplicate posts to the same channel, campaigns going quiet for hours, cron jobs dying on a
sleeping host, subscription features leaking to free users.

Treat it as a map plus a list of landmines. Adapt the domain freely — the shape (multi-tenant
credentials → scheduled work → external fan-out → attribution) transfers to any "automated
publishing" product.

## What you are building

```
Product source ──► Selection & dedup ──► AI copywriting ──► Scheduling ──► Multi-channel publish
  AliExpress          per-campaign          per-channel        windows          Telegram
  Amazon PA-API       cursor + cooldown     tone/language      + pacing         Facebook / IG
  Supplier catalog    cross-campaign        + price convert                     WhatsApp
                                                                                Pinterest
                                                    │
                                                    ▼
                              Short links ──► Click tracking ──► Revenue attribution
                                                    │
                                                    ▼
                                     Learning optimizer (retire/boost keywords)
```

Cross-cutting: multi-tenancy, per-user encrypted API keys, subscription plans + feature
gating, credit metering, notifications, watchdog, admin panel.

## Before you write code: choose the scope

Not every client needs all of it. Ask, then build only the chosen lanes — but keep the
**core** in every build, because everything else attaches to it.

| Lane | Always? | Build when |
|---|---|---|
| Core: auth, tenancy, encrypted credentials, campaigns, scheduler, one channel | **yes** | always |
| Extra publish channels | no | client sells on more than one network |
| Extra product sources | no | client has supplier feeds or Amazon affiliate access |
| AI agents (autonomous campaign tuning) | no | client wants hands-off operation |
| Short links + attribution | no | client needs to prove ROI per post |
| Subscription plans + gating | no | the client resells this as a product (vs. internal tool) |
| Learning optimizer | no | there is ≥30 days of click/earnings data to learn from |

If the user hasn't said, ask once — the answer changes the schema, so retrofitting is
expensive. Then proceed without further check-ins.

## Build order (this order matters)

Each step depends on the previous. Building out of order forces rework, especially around
tenancy and credentials.

1. **Skeleton + tenancy.** Monorepo, one `.env` at root, `User` entity, JWT auth with
   refresh. Every subsequent entity carries `user_id` from day one — retrofitting
   multi-tenancy into single-tenant tables is the single most expensive mistake here.
2. **Encrypted credentials.** AES-256-GCM at rest, a `getRaw(userId)` accessor that returns
   the decrypted bundle. Build this *before* any integration, so no plaintext key ever lands
   in a column "temporarily".
3. **One product source + one channel, manual trigger.** Prove the end-to-end path
   (search → copy → publish) with a button before adding any automation.
4. **Scheduler.** Cron, send windows, per-channel pacing. Read `references/scheduling.md`
   in full before writing this — it is where the subtle bugs live.
5. **Dedup + cursor.** The moment posting is automatic, repeats become the top complaint.
6. **Fan-out to remaining channels.** Each channel is an adapter behind one interface.
7. **Plans, gating, credits** — if this is a product.
8. **Links, attribution, optimizer** — the analytics layer, last.

## Non-negotiable invariants

These are cheap to honour up front and brutal to retrofit.

**Tenancy.** Every query filters by `user_id`. Every cron job iterates users. A cron that
forgets the filter publishes one client's products to another client's audience — assume it
will happen if the filter is optional.

**Credentials are per-user and encrypted.** Never read integration keys from `process.env`
except for platform-level infrastructure (DB, Redis, the app's own OAuth client). A user's
Telegram token belongs in their encrypted credential row.

**Fail closed on money, fail open on reads.** A plan check that errors should *deny* a paid
feature. A cache read that times out should *skip the cache*, not block the request. Getting
this backwards causes either revenue leakage or total outages.

**Never trust an external API's filter params.** Validate on the data you got back. Affiliate
APIs routinely accept `min_discount`/`min_rating` and ignore them silently.

**Idempotency and overlap guards on every cron.** Sending is slower than the tick interval.
Without an in-flight guard, ticks stack and the same post goes out twice.

**Log the skip reason.** Any branch where the scheduler decides *not* to act must say why.
Silence with no explanation is the hardest class of bug in this system — you cannot
distinguish "nothing to do" from "gate stuck closed" after the fact.

## Reference files

Read the ones relevant to what you're building. Each is self-contained.

| File | Read it when |
|---|---|
| `references/architecture.md` | Setting up the repo, modules, entities, env, deployment |
| `references/auth-and-tenancy.md` | Auth, JWT/refresh, OAuth, encrypted per-user credentials |
| `references/scheduling.md` | **Any** scheduler work — cron, windows, pacing, the classic stalls |
| `references/publishing.md` | Adding or debugging a publish channel |
| `references/product-sources.md` | Affiliate API integration, selection, dedup, deep paging |
| `references/ai-content.md` | AI copywriting, multi-provider fallback, tool-use agents, metering |
| `references/monetization.md` | Plans, feature gating, credits, checkout, attribution |
| `references/reliability.md` | Production hardening — read before first deploy |
| `references/frontend.md` | Next.js dashboard, API client, RTL, route groups |

## Adapting to a new client

The system is domain-shaped, not client-shaped. To re-target it:

- **Different product source** → new module implementing the source interface in
  `references/product-sources.md`. Selection, dedup, and scheduling are untouched.
- **Different channels** → new adapter per `references/publishing.md`.
- **Different language/market** → copy generation, currency conversion, and send windows are
  already parameterised per campaign. Don't hardcode a locale; the original system carries
  Hebrew UI + `Asia/Jerusalem` windows as *defaults*, not assumptions.
- **Internal tool instead of SaaS** → drop plans, credits, and checkout. Keep tenancy: even
  a single-client deployment benefits from it the first time they want a second brand.

## Working style inside this system

When extending a system built from this blueprint:

- Follow the module pattern (`entity → service → controller → module`) exactly. Consistency
  here is what makes the codebase navigable at 40+ modules.
- Put the *reasoning* in comments, not just the behaviour. This codebase's scheduler comments
  explain which production bug each guard prevents — that's why the guards survive refactors
  instead of being "simplified" away by the next person.
- Before changing pacing, dedup, or gating logic, check `references/reliability.md` for
  whether the behaviour you're about to "fix" is load-bearing.
