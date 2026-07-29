# Monetization

## Plans as a single source of truth

One constants file defines plans and what each unlocks. The frontend fetches it via
`GET /subscription/plans` — **never hardcode plan numbers or feature lists in the UI**, or
the pricing page and the enforcement drift apart, and customers pay for features they
don't receive.

```ts
export type PlanId = 'free' | 'starter' | 'growth' | 'autopilot' | 'scale';

export interface PlanDef {
  id: PlanId;
  name: string;
  price_monthly: number;
  price_annual: number;      // effective monthly when billed yearly (~20% off)
  monthly_credits: number;
  max_groups: number | null; // null = unlimited
  popular: boolean;
}

export const PLAN_ORDER: PlanId[] = ['free', 'starter', 'growth', 'autopilot', 'scale'];
export const DEFAULT_PLAN: PlanId = 'free';
```

Include a **genuine free tier** — one channel, the primary product source, a low credit cap.
It converts far better than a time-limited trial, and it gives you a safe default when a
subscription lapses.

## Feature gating

A flat map from feature key to the *minimum* plan that unlocks it. Tiers are cumulative.

```ts
export const FEATURE_MIN_PLAN = {
  platform_telegram:  'free',
  platform_facebook:  'growth',
  platform_instagram: 'growth',
  platform_pinterest: 'growth',
  platform_whatsapp:  'growth',

  source_aliexpress:  'free',
  source_amazon:      'autopilot',
  source_flylink:     'autopilot',

  ai_agents:          'autopilot',
  winner_recycling:   'autopilot',
  seasonal_calendar:  'autopilot',
  campaign_window_tz: 'autopilot',
  learning_optimizer: 'autopilot',
  sales_recovery:     'autopilot',

  attribution_report: 'growth',
  image_enhancer:     'growth',

  token_tracking:     'scale',
  english_campaigns:  'scale',
  paid_boost:         'scale',
} as const;

export type FeatureKey = keyof typeof FEATURE_MIN_PLAN;

export function planAllows(plan: string | null, feature: FeatureKey): boolean {
  return PLAN_ORDER.indexOf(planOf(plan).id) >= PLAN_ORDER.indexOf(FEATURE_MIN_PLAN[feature]);
}
```

Derive the pricing page's per-plan "what you unlock" list *from this map* by filtering on
`FEATURE_MIN_PLAN[k] === plan.id`. Then the marketing page cannot promise an ungated feature.

### Two enforcement points

```ts
allows(userId, feature): Promise<boolean>   // silent — for fan-out and background jobs
requireFeature(userId, feature): Promise<void>  // throws with an upgrade message — for endpoints
```

Use `requireFeature` at user-facing entry points so the user gets an actionable error naming
the required plan. Use `allows` in loops and crons where an exception would abort a batch.

### Defence in depth in the scheduler

A campaign created while the plan allowed a feature keeps running after a downgrade unless
the *scheduler* re-checks. Re-check at run time, and choose the degradation per feature:

- Paid **source** (Amazon, supplier feeds) has no cheaper equivalent → skip the run, notify
  the owner once per tick.
- Paid **enhancement** (agents) → fall back to the free path; the campaign is still valid.

### Fail closed

```ts
async allows(userId, feature) {
  try { /* load user, check plan */ }
  catch (err) { this.logger.warn(`allows(${feature}) DB error → denying`); return false; }
}
```

A database blip must not hand out paid features. Note the deliberate asymmetry with caching,
which fails *open* (see `reliability.md`) — money denies on error, performance degrades on
error.

The one place to fail *open* is a missing user row in a high-frequency fan-out path, where
denying would silently stop all publishing. Decide per call site and comment why.

## Credits

Credits meter consumption within a plan (posts, AI generations, image enhancements).

- Grant `monthly_credits` on renewal.
- Define costs in one `CREDIT_COSTS` map.
- Sell top-up packs (`CREDIT_PACKS`) for users who hit the cap mid-cycle.
- **Refund on failure.** Charging for a post that failed to publish generates support tickets
  that cost more than the credit.
- Deduct atomically (`UPDATE ... SET credits = credits - $n WHERE credits >= $n RETURNING`),
  never read-modify-write.

## Payments

Keep checkout **provider-neutral**: a `PaymentSession` entity, a create-session endpoint, and
a signed-webhook handler. Local markets often need a local processor, and a client will
change processors at least once.

- **Verify the webhook signature.** An unsigned webhook endpoint is a free-subscription API.
- **Claim atomically** — a conditional UPDATE on the session row — so a retried webhook
  doesn't grant the plan twice.
- Treat the webhook as the source of truth; the browser redirect is a UX convenience that may
  never arrive.

## Attribution

The chain that proves ROI, built in three phases:

**1. Short links.** A `LinkTarget` row per generated link with a short code, resolved at
`/r/[code]` on the frontend, which records a `LinkClick` (code, timestamp, referrer, coarse
UA) and redirects to the affiliate URL. Every published link goes through this — strip inline
raw affiliate URLs so nothing bypasses it.

**2. Revenue attribution.** Import earnings from the affiliate network, match orders to
products and to the click that generated them, and write `Earning` rows carrying
`post_id` / `campaign_id` / `keyword`.

**3. The report.** Revenue per campaign, per keyword, per channel, per hour-of-day. This
answers the only question the customer actually has: *which posts make money?*

Guard the report: require **proven ownership** of a channel before reporting its revenue, or
a user can point a campaign at someone else's group id and read their numbers.

Phase 3 also feeds the learning optimizer — attribution is what makes automated keyword
retirement possible rather than guesswork.
