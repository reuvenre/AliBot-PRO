# Product Sources

## Source interface

Each source is a module exposing the same shape, selected by `campaign.source`:

```ts
interface ProductSource {
  search(keyword: string, filters: Filters, creds): Promise<Product[]>;
  // Product: { id, title, price, currency, images[], rating, discount, url, ... }
}
```

Production sources: `aliexpress` (keyword search), `amazon` (PA-API), `flylink`/supplier
(catalog rotation, not keyword search), plus a `discovery` module for trend-driven
suggestions. Adding a source should not touch selection, dedup, or scheduling.

## Affiliate API realities

These cost real time to discover. Assume they apply to any affiliate API until proven
otherwise.

**Filter params are often ignored.** AliExpress's product query accepts `min_discount` and
silently does nothing with it, and has no rating parameter at all. **Enforce every quality
filter on the fetched page**, against the fields the response actually returns
(`evaluate_rate` for rating, 0–5). Never assume the API honoured your filter.

**The affiliate catalog is much smaller than the consumer site.** The API returns a
best-seller-sorted slice, so page 1 of a keyword returns the same items forever, even though
the website shows thousands of matches. This is the single biggest cause of "the bot keeps
posting the same products".

**Request signing is bespoke per vendor.** Keep it in one utility per vendor
(`common/aliexpress-sign.ts`, `common/amazon-sign.ts`) with a unit test, because the failure
mode is an opaque auth error.

**Rate limits and transient failures are routine.** Retry with backoff; a keyword that fails
should be reported but must not abort the whole run.

## Widening reachable catalog: rotate sort AND page

Rotating only the page hits the end of a short affiliate result set quickly. Rotating both
the sort order and the page multiplies the reachable slice, because each `(sort, page)` combo
surfaces a different set:

```ts
const SORTS = ['LAST_VOLUME_DESC', 'LAST_VOLUME_ASC', 'SALE_PRICE_DESC'];
const pageSize   = Math.min(50, Math.max(30, needed * 20)); // widest net the API allows
const block      = Math.floor(postedForKeyword / pageSize); // page-fulls consumed
const sort       = SORTS[block % SORTS.length];
const page       = Math.min(10, Math.floor(block / SORTS.length) + 1);
```

This walks `sort0/p1 → sort1/p1 → sort2/p1 → sort0/p2 → …`, roughly 3×10 pages of distinct
items per keyword. Merge the rotated slice with that sort's page 1 (the reliable base) and
de-duplicate — deep pages can error with out-of-range, which must be caught, not fatal.

Fetch a **wide net** (≈10–20× the number of posts needed) so there is room to skip
already-posted products.

## Deduplication

A `posted_products` ledger: `(campaign_id, product_id, keyword, channel, created_at)`.

### Cooldown, not permanent exclusion

Permanent exclusion sounds right and is wrong: a keyword that exhausts its fresh stock goes
silent forever. Instead, allow re-posting after `PRODUCT_REPEAT_COOLDOWN_DAYS`:

```ts
const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000);
// only products posted WITHIN the cooldown are blocked
```

Followers never see the same item day after day, and an exhausted keyword recycles proven
performers instead of producing nothing. The deep-paging counter should also use only recent
posts, so a keyword walks back toward page 1 as its window clears.

### Cross-campaign, per-channel dedup

Two campaigns sharing a channel with overlapping keywords will post the *same product* to it
seconds apart. Per-campaign dedup does not catch this. Also exclude products that **any**
campaign posted to **this campaign's channels** within the cooldown.

Because campaigns run sequentially, this also catches a product a sibling campaign just
*queued* in the same tick.

### Ordering trap in the recycle fallback

When falling back to recycling, rank by "posted longest ago". Cross-campaign blocked products
are absent from your `postedAt` map, so they default to timestamp `0` — the *oldest* — and get
recycled **first**, re-posting the exact item the dedup was suppressing. Seed them as
just-posted:

```ts
for (const id of crossChannelPosted) postedAtMs.set(id, Date.now());
```

### Prune the ledger

A daily cron deletes rows older than the cooldown. Without it the table grows unbounded and
the per-run `find` gets slower every day.

## Selection pipeline

```
distinct keywords for this run (from cursor)
  └─ per keyword: fetch wide net at rotated (sort, page)
       └─ filter: rating ≥ min, discount ≥ min, price in range   [enforced locally]
            └─ exclude: campaign-posted within cooldown
                        cross-campaign channel-posted within cooldown
                 └─ rank and take N
                      └─ if empty: recycle tier (oldest-posted first)
```

A keyword returning nothing usable is **reported but not fatal** — its slot borrows from the
other keywords' pools. One dead keyword must not silence a whole run.

## Catalog sources (supplier feeds)

Catalog-based sources rotate a stored list rather than searching. Two things bite:

- **Cursor persistence.** Without a persisted rotation cursor the cron re-posts the first
  item every tick. This is the catalog equivalent of the dedup bug.
- **SKU matching.** Matching supplier items to marketplace listings needs a normalisation
  utility with tests — title formats vary wildly and naive matching attaches the wrong link
  to an album, which is worse than posting nothing.

Fetching supplier pages/images is a user-supplied-URL operation: SSRF guard, timeout, size cap.

## Seasonal and trend injection

A commercial calendar (Black Friday, Ramadan, back-to-school, local holidays) can inject
keywords into a run. Make it **per-campaign opt-in** — a client selling tactical gear does not
want Valentine's keywords, and silently mixing them in destroys the channel's identity. That
was a real complaint, and the fix was opt-in rather than smarter heuristics.
