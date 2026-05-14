import { CronTime } from 'cron';

function nextRun(cron: string): Date | null {
  try {
    const ct = new CronTime(cron);
    const next = ct.sendAt();
    return next.toJSDate ? next.toJSDate() : (next as any).toDate?.() ?? null;
  } catch {
    return null;
  }
}

describe('nextRun (cron helper)', () => {
  it('returns a future Date for a valid cron expression', () => {
    const result = nextRun('0 9 * * *'); // every day at 9 AM
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns null for an invalid cron expression', () => {
    expect(nextRun('not a cron')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(nextRun('')).toBeNull();
  });

  it('handles a cron that fires every minute', () => {
    const result = nextRun('* * * * *');
    expect(result).toBeInstanceOf(Date);
  });
});
