import { CronTime } from 'cron';

/**
 * How often a cron expression fires — measured two different ways, because the watchdog asks
 * two different questions about it.
 *
 * A regular schedule ("0 * * * *") answers both identically. An irregular one does not:
 * "0 9,10,13,16,19,22 * * *" has a TIGHTEST gap of 60 minutes and a TYPICAL gap of 180, and
 * confusing the two is how the cadence-drift check came to report a campaign publishing
 * exactly as its owner intended. It compared a real median gap of ~3h against the 60-minute
 * minimum and called a 3× drift.
 *
 * So: the tightest gap is the right question for "can the group's rate keep up with the
 * fastest this campaign ever wants to fire?", and the typical gap is the right question for
 * "is this campaign publishing as often as it normally should?".
 */

/** Fires sampled for the typical gap — a full day of an hourly schedule, and enough of a
 *  sparse one to see its shape rather than one lucky pair. */
const SAMPLE_FIRES = 24;

/** Gaps in minutes between the next `count` fires after `from`, in chronological order. */
function fireGaps(expr: string, count: number, from: Date): number[] | null {
  const clean = String(expr || '').trim();
  if (!clean) return null;
  try {
    const ct = new CronTime(clean);
    const gaps: number[] = [];
    let cursor = from;
    let prev = ct.getNextDateFrom(cursor).toJSDate();
    for (let i = 0; i < count; i++) {
      const next = ct.getNextDateFrom(new Date(prev.getTime() + 1000)).toJSDate();
      const gap = (next.getTime() - prev.getTime()) / 60_000;
      if (!Number.isFinite(gap) || gap <= 0) return null;
      gaps.push(gap);
      prev = next;
      cursor = next;
    }
    return gaps.length ? gaps : null;
  } catch {
    return null;
  }
}

/**
 * The TIGHTEST interval the expression ever fires at, in minutes.
 *
 * Use when the question is about a ceiling — whether some other rate limit (a group's publish
 * interval) is slower than the fastest this campaign asks for.
 */
export function cronBaseIntervalMin(expr: string, from: Date = new Date()): number | null {
  const gaps = fireGaps(expr, 8, from);
  if (!gaps) return null;
  return Math.round(Math.min(...gaps));
}

/**
 * The TYPICAL interval between fires, in minutes — the median gap over a day's worth.
 *
 * Use when the question is about normal behaviour: "should a post have gone out by now?".
 * The median, not the mean, so one long overnight gap in an office-hours schedule does not
 * drag the expectation upward and mask a real slowdown.
 */
export function cronTypicalIntervalMin(expr: string, from: Date = new Date()): number | null {
  const gaps = fireGaps(expr, SAMPLE_FIRES, from);
  if (!gaps) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)]);
}
