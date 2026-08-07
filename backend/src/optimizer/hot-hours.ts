/**
 * A group's GOLDEN HOURS — when its audience actually clicks.
 *
 * Posts go out on a fixed cadence across the whole send window, but clicks don't arrive
 * uniformly: each group's audience has its own rhythm (lunch-break scrollers, evening
 * browsers). Every recorded click carries a timestamp, so the hours that actually convert
 * are measurable per group — this module is that measurement, pure and testable. Phase 1
 * of the timing project surfaces the result (digest, UI); phase 2 lets the scheduler
 * concentrate posts inside these hours for groups that opt in.
 *
 * Honesty floor: below MIN_CLICKS_FOR_HOT_HOURS clicks in the window, the answer is null —
 * "not enough data yet" — because three clicks at 14:00 are an anecdote, not a rhythm.
 */

export interface HourClicks {
  /** Local hour 0–23 (Asia/Jerusalem — the audience's clock, not the server's). */
  hour: number;
  clicks: number;
}

export interface HotHoursResult {
  /** The golden hours, ascending (e.g. [12, 20, 21]). */
  hours: number[];
  /** Share of ALL the group's clicks that landed inside those hours (0–1). */
  share: number;
  /** Total clicks the verdict is based on. */
  total: number;
}

/** Below this many clicks in the window, no verdict — an anecdote is not a rhythm. */
export const MIN_CLICKS_FOR_HOT_HOURS = 25;
/** At most this many golden hours per group — beyond that "hot" stops meaning anything. */
export const MAX_HOT_HOURS = 4;
/** Stop adding hours once they jointly cover this share of the clicks. */
export const TARGET_SHARE = 0.6;

/**
 * Pick a group's golden hours from its per-hour click histogram: strongest hours first,
 * until they jointly cover TARGET_SHARE of all clicks or MAX_HOT_HOURS is reached.
 * Null = not enough data to say anything (the caller reports that honestly).
 */
export function hotHours(rows: HourClicks[]): HotHoursResult | null {
  const clean = (rows || []).filter(
    (r) => Number.isInteger(r?.hour) && r.hour >= 0 && r.hour <= 23 && Number(r?.clicks) > 0,
  );
  const total = clean.reduce((s, r) => s + Number(r.clicks), 0);
  if (total < MIN_CLICKS_FOR_HOT_HOURS) return null;

  const sorted = [...clean].sort((a, b) => b.clicks - a.clicks || a.hour - b.hour);
  const picked: HourClicks[] = [];
  let covered = 0;
  for (const r of sorted) {
    if (picked.length >= MAX_HOT_HOURS) break;
    picked.push(r);
    covered += Number(r.clicks);
    if (covered / total >= TARGET_SHARE) break;
  }

  return {
    hours: picked.map((p) => p.hour).sort((a, b) => a - b),
    share: +(covered / total).toFixed(2),
    total,
  };
}

/** "12:00, 20:00" — the digest/UI form of a golden-hours list. */
export function formatHours(hours: number[]): string {
  return hours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ');
}
