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
