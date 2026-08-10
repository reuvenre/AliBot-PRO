/**
 * When each of the two scheduled reports goes out — chosen by the user, bounded by what
 * the data can actually support.
 *
 * The DAILY SUMMARY counts the local day so far (posts, failures, orders), so any hour is
 * legitimate: it simply reports less of the day when sent early.
 *
 * The INSIGHTS report (the learning engine's morning digest) is different. AliExpress
 * closes its accounting day at 10:00 Israel time, and only then does the previous day's
 * order data stop moving. A digest sent before that reports — and LEARNS FROM — a day that
 * hasn't settled, which is why the schedule originally sat at 10:10. Users pick the hour;
 * they don't get to pick numbers that aren't final yet, so the choice starts at 10:00.
 */

export const MIN_INSIGHTS_HOUR = 10;
export const DEFAULT_SUMMARY_HOUR = 9;
export const DEFAULT_INSIGHTS_HOUR = 10;

/** A whole hour inside [min, 23], or `fallback` for anything unusable. */
export function clampHour(value: unknown, min: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const whole = Math.trunc(n);
  if (whole < min) return min;
  if (whole > 23) return 23;
  return whole;
}

export const clampSummaryHour = (v: unknown) => clampHour(v, 0, DEFAULT_SUMMARY_HOUR);
export const clampInsightsHour = (v: unknown) => clampHour(v, MIN_INSIGHTS_HOUR, DEFAULT_INSIGHTS_HOUR);

/**
 * Is this report due on `today` for a user whose chosen hour is `hour`?
 *
 * Due means: the local clock has reached the hour, and nothing went out today yet. The
 * "reached" (>=) rather than "equals" matters — a tick missed because the server was
 * restarting, or a user who moved their hour earlier mid-day, still gets the report that
 * day instead of silently losing it.
 */
export function reportDue(nowHour: number, chosenHour: number, lastSentOn: string | null | undefined, today: string): boolean {
  if (lastSentOn === today) return false;
  return nowHour >= chosenHour;
}
