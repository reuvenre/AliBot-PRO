# Scheduling

The hardest part of this system. Almost every "the bot stopped posting" report traces back to
this file's subject matter. Read all of it before writing or modifying scheduler code.

## The three clocks

Confusing these is the root of most bugs. They are different things:

1. **Campaign cron** — how often a campaign *attempts* to produce posts (`schedule_cron`,
   e.g. `0 * * * *`).
2. **Channel interval** — how often a *destination* may receive a post, regardless of how
   many campaigns target it (`schedule_interval_minutes`, e.g. 60). This is a rate limit on
   the audience's behalf, so a group doesn't get spammed when three campaigns point at it.
3. **Send window** — the hours of day publishing is allowed (`start_hour`–`end_hour` in a
   timezone). Protects the audience from 3am notifications.

A campaign attempt is *converted* into a post only if the channel interval and the send
window both allow it. The campaign cron is a request; the channel is the authority.

## Cron inventory

The production system runs these. Notice how many are per-minute — that shapes the
overlap-guard requirement below.

| Schedule | Job |
|---|---|
| every minute | send due scheduled posts |
| every minute | process auto-send queue |
| every minute | run due campaigns |
| every minute | expire limited-time promo posts |
| every 10 min | self-ping health endpoint (keep-alive) |
| every 15 min | clean up stuck posts |
| every 15 min | watchdog: publishing-outage detection |
| hourly | sales-recovery push |
| every 3h / 6h | maintenance sweeps |
| daily 03:15 | learning optimizer |
| daily 04:20 | dedup ledger pruning |
| daily 05:30 | credential/token expiry warnings |
| daily 06:00 (local tz) | owner digest |

### Overlap guards are mandatory

Publishing is slow — a Telegram album upload can take 40 seconds, and a tick may process
many posts. A per-minute cron **will** re-enter before the previous run finishes.

```ts
@Cron(CronExpression.EVERY_MINUTE)
async sendScheduledPosts() {
  if (this.sending) return;      // instance-level guard
  this.sending = true;
  try { /* ... */ } finally { this.sending = false; }
}
```

The in-memory flag only protects a single instance. If you run more than one replica, you
also need an **atomic claim** in the database:

```sql
UPDATE posts SET status = 'queued', pending_at = now()
WHERE id = $1 AND status = 'scheduled'
RETURNING *;
```

Only the worker whose UPDATE returns a row proceeds. `pending_at` is what the stuck-post
cleanup cron uses to reclaim rows abandoned by a crashed worker.

### Run campaigns sequentially, not concurrently

Fire-and-forget parallel campaign runs cause a specific bug: two campaigns targeting the same
channel both read "next free slot" before either writes its post, both get the same slot, and
the channel receives two posts a minute apart. Awaiting each campaign makes the first one's
post visible to the second's spacing check.

## Campaign run gate

```ts
for (const campaign of activeCampaigns) {
  if (!campaign.next_run_at) continue;
  if (new Date(campaign.next_run_at) > now) continue;
  if (this.running.has(campaign.id)) continue;   // in-flight guard
  await this.campaigns.markRun(campaign.id).then(() => run(campaign));
}
```

`markRun` sets `last_run_at = now` and recomputes `next_run_at` from the cron expression
**before** the run starts. Marking first means a campaign that throws still advances its
schedule instead of retrying every minute forever.

## Send windows

```ts
resolveWindow(campaign, channel, account):
  campaign own window (with its own tz)  // per-campaign, e.g. a US-hours campaign
  ?? channel window
  ?? account window
  ?? { start: 9, end: 22 }
```

Timezone comes from the campaign's own setting, else `SCHEDULER_TZ`, else a sensible default.
Compute the hour *in that zone* — never with the server's local time, and never by adding a
fixed offset (DST will break it twice a year).

**The window must be enforced in both places**: when a post is created, and when it is
released. The production system originally checked only at creation; an overdue backlog then
fired at 00:24 despite a 23:00 cutoff, because releasing had no window check. Two enforcement
points, one shared helper.

`endHour` is inclusive of its top of hour — decide this once, document it, and use the same
comparison in both places.

## Channel pacing — the subtle part

When several campaigns publish to one channel, the channel's single rate must be shared.
The function that decides is `nextGroupSlot(userId, channelId, notBefore, campaignId)`,
returning `{ slot, skip }`.

It gathers, for that channel, per campaign:
- the latest **pending** (scheduled/queued) post, and
- the latest **sent** time within the current interval.

Then:

```ts
const graceMs  = intervalMin * 0.15 * 60_000;
const groupBusy = hasPending
  || (lastSentMs > 0 && now - lastSentMs < intervalMin * 60_000 - graceMs);
```

### Why the grace exists

An hourly campaign publishing to a 60-minute channel sends a few seconds *shy* of a full
interval before its next run (cron fires at :00:0x, the previous send completed at :01:1x —
58m56s elapsed, not 60m). A strict `< interval` check marks the channel busy and skips every
*other* run, so the channel posts every two hours instead of every hour. 15% of the interval
absorbs cron and send jitter. **Do not remove this.**

### Landmine: unbounded `hasPending`

`hasPending` treats *any* future scheduled post as "channel is busy". A manual post scheduled
five hours out therefore silences every campaign on that channel for five hours. Worse, if
the post fans out to several channels (`channel_overrides` containing multiple ids), it
silences all of them.

This was a real, diagnosed production outage. The fix is to bound it to the current interval:

```ts
const pendingSoon = latestPendingMs > 0
  && latestPendingMs <= now + intervalMin * 60_000;
const groupBusy = pendingSoon || (lastSentMs > 0 && now - lastSentMs < interval - grace);
```

Be careful: the booked-ahead behaviour is *partly deliberate*. The scheduled-post release job
deliberately re-spaces an overdue backlog into future slots (`now + N·interval`) so that an
over-subscribed channel can't accumulate. Bounding to one interval keeps that back-pressure
working (a re-spaced backlog is exactly one interval out) while stopping arbitrary future
posts from freezing everything. Verify both behaviours after changing this.

### Landmine: fair-share and non-campaign posts

Fair-share gives the free slot to the most-behind campaign:

```ts
for (const [cid, last] of lastSentByCampaign) {
  if (cid === campaignId) continue;
  if (last < mine || (last === mine && cid < campaignId)) { notMyTurn = true; break; }
}
```

Manual posts have no `campaign_id`, so they land under key `''` — and `'' < <any-uuid>` is
always true, so a manual post wins every tie-break and starves the campaigns. **Exclude
`campaign_id IS NULL` rows from the fair-share loop.** One-off posts have no cadence to catch
up on; they should consume the slot they use and nothing more.

### Landmine: platform-filtered campaigns consuming a channel's rate

A campaign filtered to Instagram-only still carries the channel id for targeting, but never
reaches that channel's Telegram audience. If it counts toward the Telegram rate, it halves
the actual Telegram posting frequency. Filter the pacing query by whether the campaign
actually publishes to the platform in question:

```sql
AND (p.campaign_id IS NULL
     OR c.target_platforms IS NULL
     OR c.target_platforms LIKE '%telegram%')
```

## Draining a backlog

When posts are overdue, release **the oldest one per channel per tick** and re-space the rest
into future slots. Using `scheduled_at` as the pacing source — an immutable column nothing
external can freeze — fixes three symptoms at once: a stuck backlog drains one per interval
instead of freezing on a shared clock; the "two posts a minute apart" double disappears
because the second overdue post is pushed to the next interval; and runaway pile-up stops
because the future `scheduled_at` makes the pacing check report booked-ahead.

Cap the due-scan (`take(1000)`) so a per-minute cron can never load unbounded rows, and warn
when the cap is hit so a draining backlog is visible.

## Keyword rotation

`keyword_cursor` is a monotonically increasing integer; the active keyword is
`keywords[cursor % keywords.length]`. Increment by `posts_per_run` each run.

**Where you increment determines what you can debug.** In the production system the increment
happens *after* the window check but *before* the channel-pacing check. That means two
campaigns with the same cron and the same cursor value have had the same number of
past-window runs — so if one produced far fewer posts, the losses are provably at the pacing
gate, not at the window or at keyword exhaustion. That property turned a multi-hour
investigation into a two-minute one. Pick a position deliberately and write down why.

## Diagnosing "it stopped posting"

Work down this list; it is ordered by how often each one is the answer.

1. **Is the process alive?** Idle-scaling hosts suspend it and every cron dies silently.
   Check `last_run_at` across campaigns — if *all* are stale, it's the host, not the logic.
2. **Pending posts blocking the channel.** Query for `status IN ('scheduled','queued')` and
   look at `scheduled_at` and `channel_overrides`. One far-future or stuck row explains a
   total stall across every channel it names.
3. **Window closed.** Compute the current hour in the campaign's timezone, not yours.
4. **Pacing gate.** Compare `keyword_cursor` between a healthy and an unhealthy campaign with
   the same cron — equal cursors with unequal post counts localises the loss to the gate.
5. **Source exhaustion.** Every candidate product was already posted within the cooldown.
6. **Credentials.** Decrypt failure or an expired platform token, failing quietly.

## Watchdog

A scheduler that stops is invisible without one. Every 15 minutes, check whether each active
channel has published within a multiple of its expected interval; alert the owner if not.

Two refinements learned in production: count **manual** posts as channel activity (otherwise
a manually-posted channel raises a false alarm), and alert on **missing migrations or
credential decrypt failures** specifically, since those produce a silent outage that looks
identical to "nothing scheduled".
