import { countRecentFailedRuns, pruneRunLog, recordFailedRun } from './run-failure-log';

const NOW = new Date('2026-08-18T22:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe('run-failure-log', () => {
  it('records a failed run on top of the pruned history', () => {
    const log = recordFailedRun([hoursAgo(2)], NOW);
    expect(log).toEqual([hoursAgo(2), NOW.toISOString()]);
  });

  it('prunes entries older than 24h — yesterday cannot explain today', () => {
    expect(pruneRunLog([hoursAgo(30), hoursAgo(3)], NOW)).toEqual([hoursAgo(3)]);
  });

  it('survives garbage in the column — a corrupt row must not crash a cron', () => {
    expect(pruneRunLog(null, NOW)).toEqual([]);
    expect(pruneRunLog('not-an-array', NOW)).toEqual([]);
    expect(pruneRunLog(['garbage', 42, hoursAgo(1)], NOW)).toEqual([hoursAgo(1)]);
  });

  it('counts only the window the drift check asks about', () => {
    // The issue #60 shape: two judge-failed runs earlier tonight, both inside 12h —
    // exactly the two merged intervals behind "מוגדר ~120 בפועל ~240".
    const log = [hoursAgo(20), hoursAgo(5), hoursAgo(3)];
    expect(countRecentFailedRuns(log, NOW, 12 * 3600_000)).toBe(2);
  });

  it('ignores future timestamps — clock skew must not inflate the count', () => {
    expect(pruneRunLog([hoursAgo(-2)], NOW)).toEqual([]);
  });
});
