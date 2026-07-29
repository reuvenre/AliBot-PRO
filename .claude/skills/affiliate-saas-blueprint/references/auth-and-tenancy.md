# Auth, Tenancy, and Credentials

## Auth model

Passport JWT with refresh rotation.

- **Access token**: 15 minutes, sent as `Authorization: Bearer`.
- **Refresh token**: 30 days, persisted in the DB *and* set as an httpOnly `refresh_token`
  cookie. Persisting server-side is what lets you revoke a session; the cookie alone can't.
- **Guards**: `@UseGuards(JwtAuthGuard)` on protected routes.
- **`req.user` is the full `User` entity** (the JWT strategy loads it), so `req.user.id` is
  the authenticated user id and plan/credit checks need no extra query.

Loading the full user in the strategy costs one query per request but removes an entire class
of bug where a handler trusts a stale claim in the token (e.g. a plan the user no longer has).
For this product shape that trade is correct — gating decisions must reflect the database,
not a token minted 14 minutes ago.

Social login (Google OAuth) lands on a backend callback that mints the same token pair and
redirects to a frontend `/google/success` page which stores the access token.

Also implement: password reset by emailed token, optional TOTP two-factor, and a
`SecurityEvent` audit row for logins, admin actions, and credential changes.

## Multi-tenancy

**Every domain entity carries `user_id`.** Every service method takes `userId` as its first
argument and filters on it. Every cron job iterates users or joins through an entity that
carries the tenant.

The dangerous cases are the background jobs, because there is no request context to remind
you. A cron that does `postRepo.find({ where: { status: 'scheduled' } })` and then publishes
using "the" Telegram token will publish tenant A's products with tenant B's bot the moment
you have two customers. Make the tenant explicit in the query, and resolve credentials from
the row you loaded — never from ambient state.

Admin endpoints are the deliberate exception. Gate them on a role flag, and log every action
to `SecurityEvent`.

## Encrypted credentials

Per-user third-party secrets (affiliate API keys, bot tokens, page tokens, AI keys) are
AES-256-GCM encrypted at rest in a `credential_sets` row.

### Storage shape

Columns are suffixed `_enc` for anything encrypted, plain otherwise:

```
aliexpress_app_key            (plain — an identifier, not a secret)
aliexpress_app_secret_enc     (encrypted)
telegram_bot_token_enc        (encrypted)
telegram_channel_id           (plain)
anthropic_api_key_enc / openai_api_key_enc / gemini_api_key_enc
facebook_page_token_enc, instagram_business_id, pinterest_access_token_enc, ...
```

The suffix convention means a reviewer can spot an unencrypted secret by reading the entity
alone. Keep it.

### Crypto implementation

```ts
const ALGO = 'aes-256-gcm';   // authenticated — detects tampering, unlike CBC
const IV_LEN = 16, TAG_LEN = 16;

// stored payload = base64( iv || authTag || ciphertext )
```

Key comes from `ENCRYPTION_KEY` (64 hex chars). In production, a missing or wrong-length key
**throws at startup**. In development it may fall back to a deterministic key so contributors
aren't blocked — but that fallback must be unreachable in production, or you will ship
customer secrets encrypted with a key that is in the repo.

### Access pattern

One accessor returns the whole decrypted bundle:

```ts
const creds = await this.credentials.getRaw(userId);  // DecryptedCredentials | null
```

Callers pass `creds` down rather than each calling `getRaw` again — decryption plus a DB
round trip inside a per-minute loop over every post is measurable.

**Decrypt failures must fail safe, loudly.** If the key rotates or a row is corrupt,
`getRaw` returning `null` silently turns into "user has no integrations configured", and
publishing stops with no error anywhere. Log it, raise a watchdog alert, and surface it in
the UI as a credentials problem — not as an empty state.

### Credential validation

Give each integration a "test connection" endpoint that performs a real call:

| Integration | Validation call |
|---|---|
| Telegram | `getMe` |
| Facebook page | `GET /{page_id}?fields=name,tasks` |
| Instagram | `GET /{ig_business_id}?fields=username` |
| Meta ads | `GET /{ad_account}?fields=name,account_status` |
| AI provider | a real minimal generation, not a model-list call |

The AI case is the instructive one: listing models succeeds with a key that lacks generation
permission or has no billing attached. Validate the capability you actually depend on.

Also track token expiry where the platform has it (Meta long-lived tokens): store
`*_token_expires_at`, run a daily cron that warns the owner before expiry, and record
`*_token_notified_at` so they get one warning rather than a daily nag.

## Credential-driven defaults

The credential row is also the natural home for account-level defaults that individual
campaigns and channels can override:

```
schedule_enabled, schedule_start_hour, schedule_end_hour,
schedule_interval_minutes, schedule_last_sent_at
publish_telegram / publish_facebook / publish_instagram / ...
currency_pair, price_markup_pct, price_shipping_buffer_ils, price_rounding_mode
```

Resolution order, used consistently everywhere: **campaign → channel → account → hardcoded
default**. Implement it once as a helper. When two code paths resolve the same setting with
different fallback orders, posts get created under one window and released under another, and
they either never send or send outside the allowed hours.
