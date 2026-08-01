import { nextRunAt } from './next-run';

describe('nextRunAt', () => {
  it('returns the next fire time for a valid expression', () => {
    const from = new Date('2026-08-01T10:00:00Z');
    // Every 3 hours on the hour → the next one after 10:00 is 12:00.
    expect(nextRunAt('0 */3 * * *', from)?.toISOString()).toBe('2026-08-01T12:00:00.000Z');
  });

  it('always looks forward, never at the fire time it was given', () => {
    // Called exactly on a fire minute, the answer must be the FOLLOWING one — otherwise a
    // run's cycle would be zero-length and it could book nothing beyond its first post.
    const onTheHour = new Date('2026-08-01T12:00:00Z');
    const next = nextRunAt('0 */3 * * *', onTheHour);
    expect(next!.getTime()).toBeGreaterThan(onTheHour.getTime());
    expect(next!.toISOString()).toBe('2026-08-01T15:00:00.000Z');
  });

  it('spans the gap a daily campaign actually has', () => {
    const next = nextRunAt('0 9 * * *', new Date('2026-08-01T10:00:00Z'));
    expect(next!.toISOString()).toBe('2026-08-02T09:00:00.000Z');
  });

  it('handles a cron that fires every minute', () => {
    expect(nextRunAt('* * * * *')).toBeInstanceOf(Date);
  });

  it('returns a future Date when given no starting point', () => {
    const next = nextRunAt('0 9 * * *');
    expect(next).toBeInstanceOf(Date);
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns null for an expression it cannot read', () => {
    // Null means "no cycle known" — the caller must fall back to the old, safer behaviour
    // rather than treat a broken cron as a reason to publish differently.
    for (const bad of ['', '   ', 'not a cron', '99 99 99 99 99',
      null as any, undefined as any]) {
      expect(nextRunAt(bad, new Date('2026-08-01T10:00:00Z'))).toBeNull();
    }
  });
});

/**
 * The stacking rule as the scheduler applies it: a campaign's own pending post blocks a
 * second one UNLESS the new slot still lands inside this run's cycle. This is the gate that
 * decides whether "2 posts per run" delivers two posts or silently delivers one.
 */
describe('stacking within a cycle', () => {
  const blocks = (myPendingMs: number, slotMs: number, stackUntil: Date | null) => {
    const stackable = !!stackUntil && slotMs < stackUntil.getTime();
    return myPendingMs > 0 && !stackable;
  };

  const run = new Date('2026-08-01T09:00:00Z').getTime();
  const cycleEnd = new Date('2026-08-01T12:00:00Z'); // a 3-hourly campaign
  const hour = 60 * 60_000;

  it('lets a second post through when it fits before the next run', () => {
    // Post 1 at 09:00, group interval 60m → post 2 at 10:00, still inside the cycle.
    expect(blocks(run, run + hour, cycleEnd)).toBe(false);
  });

  it('blocks a post that would land after the next run has already fired', () => {
    // A 4-hour-out slot belongs to the next run, not this one — this is what stops the
    // queue growing by one more post every cycle, forever.
    expect(blocks(run, run + 4 * hour, cycleEnd)).toBe(true);
  });

  it('blocks it at the cycle boundary exactly', () => {
    expect(blocks(run, cycleEnd.getTime(), cycleEnd)).toBe(true);
  });

  it('keeps the old one-per-run behaviour when the cycle is unknown', () => {
    // An unparseable cron must not become a reason to queue more, only less.
    expect(blocks(run, run + hour, null)).toBe(true);
  });

  it('never blocks the FIRST post of a run', () => {
    expect(blocks(0, run, cycleEnd)).toBe(false);
    expect(blocks(0, run + 9 * hour, null)).toBe(false);
  });
});
