/**
 * Pure helpers behind the dashboard overview. They live apart from the service so the
 * bucketing and delta rules — the parts that quietly go wrong — are testable without a DB.
 */

/** Monday 00:00 UTC of the week containing `d`. Matches Postgres `date_trunc('week', …)`. */
export function startOfWeekUtc(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (out.getUTCDay() + 6) % 7; // Mon → 0 … Sun → 6
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

/** `count` consecutive week-start keys (YYYY-MM-DD) ending with the week containing `end`. */
export function weekKeys(end: Date, count: number): string[] {
  const last = startOfWeekUtc(end);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(last);
    d.setUTCDate(d.getUTCDate() - i * 7);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/**
 * Expand sparse SQL output into one value per key, zero-filling gaps.
 *
 * Grouped queries only return buckets that have rows, so a quiet week is simply absent.
 * Charting that directly draws a 12-week trend from 5 bars and silently misplaces them —
 * the gaps have to become explicit zeros before the series means anything.
 */
export function densify(rows: Array<{ bucket: string; value: number }>, keys: string[]): number[] {
  const found = new Map(rows.map((r) => [String(r.bucket).slice(0, 10), Number(r.value) || 0]));
  return keys.map((k) => found.get(k) ?? 0);
}

/**
 * Percentage change against the preceding period, or null when there's no baseline.
 *
 * Returning null rather than 0 or 100 matters: a first-week account has nothing to compare
 * against, and "+100%" on the dashboard would be an invented claim. The UI omits the badge
 * when this is null.
 */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Sum with float noise trimmed — commission_ils is a float column. */
export function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}
