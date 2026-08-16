import { portalRangeEnd, portalRangeStart } from './portal-time';

describe('portal date-range boundaries', () => {
  it('starts the month on GMT+8 midnight, not UTC midnight', () => {
    // The bug this fixes: an order paid 2026-08-01 06:28 portal time is stored as
    // 2026-07-31 22:28 UTC. A UTC-midnight boundary dropped it from August — the whole
    // "portal 67 / system 66" gap, with nothing missing from the database.
    expect(portalRangeStart('2026-08-01')!.toISOString()).toBe('2026-07-31T16:00:00.000Z');
  });

  it('includes an order paid in the first eight hours of the portal day', () => {
    const paid = new Date('2026-07-31T22:28:31.000Z'); // = 2026-08-01 06:28 GMT+8
    expect(paid >= portalRangeStart('2026-08-01')!).toBe(true);
  });

  it('still excludes the day before on the portal clock', () => {
    const paid = new Date('2026-07-31T10:00:00.000Z'); // = 2026-07-31 18:00 GMT+8
    expect(paid >= portalRangeStart('2026-08-01')!).toBe(false);
  });

  it('ends inclusive of the whole picked day', () => {
    expect(portalRangeEnd('2026-08-31')!.toISOString()).toBe('2026-08-31T15:59:59.999Z');
  });

  it('keeps a same-day from/to range non-empty', () => {
    expect(portalRangeStart('2026-08-16')!.getTime()).toBeLessThan(portalRangeEnd('2026-08-16')!.getTime());
  });

  it('treats a missing or malformed bound as no bound', () => {
    expect(portalRangeStart(undefined)).toBeNull();
    expect(portalRangeStart('')).toBeNull();
    expect(portalRangeEnd('not-a-date')).toBeNull();
  });

  it('accepts a full ISO timestamp by reading its date part', () => {
    expect(portalRangeStart('2026-08-01T00:00:00Z')!.toISOString()).toBe('2026-07-31T16:00:00.000Z');
  });
});
