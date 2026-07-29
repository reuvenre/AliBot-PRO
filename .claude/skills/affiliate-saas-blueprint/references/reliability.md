# Reliability and Production Hardening

Read before the first deploy. Every item here corresponds to a production incident.

## The cardinal failure mode: silent outage

This system's characteristic failure is not a crash — it is *nothing happening*, with a green
health check and no errors in the log. Design against silence specifically:

- **Every skip branch logs its reason.** "Channel busy until 15:00", "window closed",
  "0 products after dedup" — each is a distinct message. Without them you cannot separate
  "nothing to do" from "gate stuck closed" after the fact.
- **A watchdog measures output, not process liveness.** Alert when a channel has published
  nothing for a multiple of its expected interval.
- **Alert on the silent-outage causes specifically**: unrun migrations, credential decrypt
  failures, expired platform tokens. All three look identical to "nothing scheduled".

## Host suspension kills cron

On idle-scaling hosts the instance spins down after ~15 minutes without inbound HTTP, which
silently kills every `@Cron`. Self-ping every 10 minutes:

```ts
@Cron('0 */10 * * * *')
async keepAlive() {
  const base = process.env.BACKEND_URL;
  if (!base || /localhost|127\.0\.0\.1/.test(base)) return;   // no-op locally
  await axios.get(`${base.replace(/\/$/, '')}/health`, { timeout: 8000 })
    .catch(err => this.logger.warn(`keep-alive failed: ${err.message}`));
}
```

**This cannot wake an instance that already slept** — the ping comes from inside the sleeping
process. Pair it with an external uptime pinger as the cold-start backstop. Diagnostic tell:
if *every* campaign's `last_run_at` is stale by the same amount, it's the host, not the logic.

## Cache must never be a dependency

A dead Redis makes every `cache.get()` block on connection, which froze every endpoint
touching the FX/category cache while DB-only endpoints stayed fine. A cache is an
accelerator; if it doesn't answer fast, skip it:

```ts
const CACHE_TIMEOUT_MS = 1200;

export async function cacheGet<T>(cache: Cache, key: string): Promise<T | undefined> {
  try {
    return await Promise.race([
      cache.get<T>(key) as Promise<T | undefined>,
      new Promise<undefined>(r => setTimeout(() => r(undefined), CACHE_TIMEOUT_MS)),
    ]);
  } catch { return undefined; }
}
```

Route every cache access through this wrapper — a single direct `cache.get` reintroduces the
hang.

## Rate limits: honour the server's backoff

A 429 that falls through to a failed post, retried by the next-minute cron with no backoff,
deepens the flood limit. Install one global axios interceptor:

```ts
axios.interceptors.response.use(undefined, async (error) => {
  const cfg = error?.config, status = error?.response?.status;
  if (!cfg || status !== 429 || cfg.__retried429) return Promise.reject(error);

  const retryAfter = Number(
    error?.response?.data?.parameters?.retry_after ??   // Telegram
    error?.response?.headers?.['retry-after'],          // standard
  );
  const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter, 60) * 1000                   // cap: a hostile value can't hang us
    : 1000;
  cfg.__retried429 = true;
  await new Promise(r => setTimeout(r, waitMs));
  return axios(cfg);
});
```

Retry **once**. Unbounded retry on 429 is indistinguishable from an attack.

## SSRF: guard every user-supplied URL fetch

This system fetches user-supplied URLs in several places — supplier catalog pages, image
sources, relay webhooks. Each is an SSRF vector into your private network and cloud metadata.

```ts
// Block non-http(s) schemes and any host resolving to:
//   0.x, 10.x, 127.x, 255.x, 169.254.x (link-local + cloud metadata),
//   192.168.x, 172.16–31.x, 100.64–127.x (CGNAT), and IPv6 equivalents
```

Pair every guarded fetch with **`maxRedirects: 0`** — otherwise a public host 302s to
`169.254.169.254` *after* your check passes. Also cap response size and set a timeout.

## Rate limiting behind a proxy

Behind a reverse proxy or CDN, every request appears to come from the proxy's IP, so a naive
IP rate limiter either throttles all users together or does nothing. Use a proxy-aware guard
that reads the forwarded client IP, and configure `trust proxy` to the correct hop count —
trusting blindly lets a client spoof the header and bypass the limit entirely.

## Atomicity

Anything a retry or a second replica can touch needs a conditional write:

```sql
-- claim a post
UPDATE posts SET status='queued', pending_at=now() WHERE id=$1 AND status='scheduled' RETURNING *;
-- claim a payment
UPDATE payment_sessions SET status='claimed' WHERE id=$1 AND status='pending' RETURNING *;
-- spend credits
UPDATE users SET credits = credits - $2 WHERE id=$1 AND credits >= $2 RETURNING credits;
```

Read-modify-write in a per-minute cron with any concurrency will double-post and double-grant.

## Stuck work reclamation

Every claim needs a reaper. `pending_at` older than a threshold with status `queued` means a
worker died mid-send: reset to `scheduled` (or `failed` after N attempts) so the row isn't
stranded forever. Without this, one crash silently removes a channel from rotation — and
because a pending post also blocks the channel's pacing gate, one stranded row can stall the
entire channel indefinitely.

## Bounded scans

Every cron query that scans a growing table needs `take(N)` plus a warning when the cap is
hit. Unbounded `find()` in a per-minute job is a latent OOM that arrives on the day the
customer's backlog grows.

## Timeouts everywhere

No outbound call without an explicit timeout. Defaults are minutes long; a single hung
request stalls a cron tick, which stacks into the next one. Calibrate per operation — 5s for
a validation probe, 40s for a multi-image album upload.

## Degrade, don't fail

Every enhancement path needs a fallback: FX provider down → last-good rate; image enhancer
fails → original image; AI provider fails → next provider → template copy. A post going out
slightly worse beats no post.

## Secrets and CORS

- Never log decrypted credentials, tokens, or full API responses containing them.
- Restrict CORS to the known frontend origin in production; a permissive dev config shipped
  to production exposes authenticated endpoints to any site.
- Enable row-level security on managed Postgres where clients can reach the DB directly —
  application-level `user_id` filters don't protect a directly reachable database.

## Tests worth having

Full coverage isn't the goal; these specific areas are, because their failures are expensive
and silent:

- **Plan/feature gating** — every feature key maps to a plan; free tier unlocks nothing paid.
- **Credit accounting** — deduction, refund-on-failure, atomicity.
- **Crypto round-trip** — encrypt→decrypt, and that a tampered payload is rejected.
- **SSRF guard** — private ranges blocked, public allowed, redirect blocked.
- **Signing utilities** — one known-good vector per affiliate vendor.
- **Normalisation / SKU matching** — pure functions, cheap to test, expensive to get wrong.

Run them in CI. The gating and billing tests are the ones that stop a refactor from silently
giving away the product.
