/**
 * A rolling, COUNTABLE trail of campaign runs that produced nothing because of failures.
 *
 * A failed generation deliberately leaves no post row (the fail-loudly path in
 * generateText: better no post than a generic template in a live group). But that means
 * the drift check's "failed runs" query — post rows with status='failed' — comes back 0,
 * and the hole such a run leaves between two healthy posts reads as a PACING fault:
 * issue #60 reported "מוגדר ~120 בפועל ~240" for a campaign that was pacing exactly
 * right around the hole issue #59's judge failures had left.
 *
 * `last_run_note` can't serve here — it remembers only the latest run. This log keeps an
 * ISO timestamp per nothing-produced run, pruned to 24h, so the drift check can count
 * how many holes the last 12h actually contain.
 */

export const RUN_LOG_RETENTION_MS = 24 * 3600_000;

/** Sanitize + drop entries older than the retention window (and any garbage/future rows). */
export function pruneRunLog(log: unknown, now: Date): string[] {
  const arr = Array.isArray(log) ? log : [];
  return arr
    .map((t) => String(t))
    .filter((t) => {
      const ms = Date.parse(t);
      return Number.isFinite(ms) && ms <= now.getTime() && now.getTime() - ms <= RUN_LOG_RETENTION_MS;
    })
    .slice(-50); // hard cap — a minute-cron gone wild must not grow the row unbounded
}

/** The log with this run's failure appended (pruned first, so it never grows stale). */
export function recordFailedRun(log: unknown, now: Date): string[] {
  return [...pruneRunLog(log, now), now.toISOString()];
}

/** How many nothing-produced runs fall inside the given trailing window. */
export function countRecentFailedRuns(log: unknown, now: Date, windowMs: number): number {
  return pruneRunLog(log, now).filter((t) => now.getTime() - Date.parse(t) <= windowMs).length;
}
