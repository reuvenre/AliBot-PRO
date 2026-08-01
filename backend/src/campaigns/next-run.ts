import { CronTime } from 'cron';

/**
 * When a campaign's cron fires next, after `from`.
 *
 * Used as a campaign's CYCLE END: the point by which everything this run queued should
 * already have gone out, because the next run is about to queue more. Anything a run wants
 * to book beyond that point belongs to the next run, not this one.
 *
 * Returns null for an unparseable expression, and callers must treat that as "no cycle
 * known" rather than as a zero-length one — a bad cron must never silently become a reason
 * to publish differently.
 */
export function nextRunAt(cron: string, from: Date = new Date()): Date | null {
  const expr = String(cron || '').trim();
  if (!expr) return null;
  try {
    const next = new CronTime(expr).getNextDateFrom(from).toJSDate();
    return next && next.getTime() > from.getTime() ? next : null;
  } catch {
    return null;
  }
}

/** The send window a campaign's posts actually leave in, resolved by the caller
 *  (campaign override → group → account global → default). */
export interface PublishWindow {
  startHour: number;
  endHour: number;
  /** IANA zone the hours are read in, e.g. 'Asia/Jerusalem'. */
  tz: string;
}

const hourInZone = (d: Date, tz: string): number =>
  +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false }).format(d) % 24;
const minuteInZone = (d: Date, tz: string): number =>
  +new Intl.DateTimeFormat('en-GB', { timeZone: tz, minute: 'numeric' }).format(d);

/**
 * When the next post will actually LEAVE: the campaign's next cron fire, walked forward
 * hour-by-hour until it lands inside the send window.
 *
 * This exists for the UI. "ריצה הבאה: 01:00" was technically true — the cron ticks around
 * the clock — but posts created by a night run are scheduled to the window's opening, so
 * the owner read "01:00", saw nothing publish at 01:00, and reasonably concluded the
 * system was broken. The next PUBLISH is the number they were asking for.
 *
 * The walk mirrors campaignScheduleTimes exactly — one-hour steps (DST-safe), minutes
 * preserved, the end hour itself allowed only at minute zero — so this prediction and the
 * scheduler's behaviour cannot drift apart. An unreadable cron returns null; a degenerate
 * window (start ≥ end) means 24h publishing and returns the fire as-is.
 */
export function nextPublishAt(
  cron: string, window: PublishWindow, from: Date = new Date(),
): Date | null {
  const fire = nextRunAt(cron, from);
  if (!fire) return null;
  const { startHour, endHour, tz } = window;
  if (startHour >= endHour) return fire;

  let t = fire;
  for (let i = 0; i < 48; i++) {
    const h = hourInZone(t, tz);
    const inWindow = h >= startHour
      && (h < endHour || (h === endHour && minuteInZone(t, tz) === 0));
    if (inWindow) return t;
    t = new Date(t.getTime() + 3600_000);
  }
  // 48 hourly steps cover any window/DST combination; reaching here means the window data
  // is nonsense — fall back to the raw fire rather than showing nothing.
  return fire;
}
