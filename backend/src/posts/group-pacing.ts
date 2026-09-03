/**
 * "Did this group already publish inside the current interval?"
 *
 * The answer decides whether a campaign run books a slot or skips, so getting it wrong
 * costs the group half its posts. It was wrong: the check measured from the post's ACTUAL
 * SEND time, while the spacing chain measures from its SLOT.
 *
 * Those two differ by however long the send took — and a FLYLINK/album post with AI image
 * redesign takes minutes, not seconds. An hourly campaign whose 10:00 post finished
 * uploading at 10:12 was still "within the interval" when its 11:00 run asked (11:00 −
 * 10:12 = 48 min, under the 51-minute bar), so that run skipped, the next one booked at
 * 12:00, and the campaign published every ~2 hours instead of hourly. The watchdog reported
 * exactly that — ~122 minutes against a 60-minute cadence — three days running.
 *
 * A slot is a slot: the post that occupied 10:00 leaves 11:00 free no matter when its bytes
 * finished. So the check anchors on the slot, and the grace stays only for cron/clock jitter.
 */

/**
 * Slack on the interval boundary, as a fraction of it. A campaign whose cron matches the
 * group interval fires a few seconds SHY of a full interval, and a strict "< interval"
 * comparison would then read every other run as too early.
 */
export const PACING_GRACE_RATIO = 0.15;

/** The interval every pacing decision falls back to when nothing is configured. */
export const DEFAULT_INTERVAL_MIN = 60;

/**
 * The interval this group is actually paced at: its own setting, else the ACCOUNT's, else
 * an hour.
 *
 * The account step is the one that was missing. A group's interval field is empty by
 * default and the groups screen labels that state "גלובלי", but the pacing gate fell
 * straight through to a hardcoded 60 — so lowering "מרווח בין פוסטים" in Settings changed
 * how the queue released posts and did NOT change how campaigns paced against the group.
 * A campaign set to every half hour went on publishing hourly, with both screens saying it
 * should not. Same chain as the scheduler's queue, on purpose: one group, one cadence,
 * however the post was released.
 */
export function pacingIntervalMinutes(
  groupInterval: number | null | undefined,
  accountInterval: number | null | undefined,
): number {
  const usable = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (usable(groupInterval)) return groupInterval;
  if (usable(accountInterval)) return accountInterval;
  return DEFAULT_INTERVAL_MIN;
}

/**
 * True when a post anchored at `anchorMs` still occupies the group's current interval.
 * `anchorMs` must be the post's SLOT (scheduled_at), falling back to its send time only
 * for posts that never had a slot — a manual one-off.
 */
export function occupiesCurrentInterval(anchorMs: number, nowMs: number, intervalMin: number): boolean {
  if (!(anchorMs > 0)) return false;
  const interval = intervalMin * 60_000;
  return nowMs - anchorMs < interval - interval * PACING_GRACE_RATIO;
}
