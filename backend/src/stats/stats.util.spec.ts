import { densify, deltaPct, startOfWeekUtc, sum, weekKeys } from './stats.util';

describe('stats.util', () => {
  describe('startOfWeekUtc', () => {
    it('snaps to Monday, matching Postgres date_trunc', () => {
      // 2026-07-29 is a Wednesday → Monday 2026-07-27.
      expect(startOfWeekUtc(new Date('2026-07-29T13:45:00Z')).toISOString().slice(0, 10))
        .toBe('2026-07-27');
    });

    it('treats Sunday as the END of its week, not the start', () => {
      // The off-by-one that silently shifts every bucket: Sunday is day 0 in JS.
      expect(startOfWeekUtc(new Date('2026-08-02T23:59:00Z')).toISOString().slice(0, 10))
        .toBe('2026-07-27');
    });
  });

  describe('weekKeys', () => {
    it('returns consecutive Mondays ending with the current week', () => {
      expect(weekKeys(new Date('2026-07-29T00:00:00Z'), 4))
        .toEqual(['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27']);
    });

    it('crosses a month boundary without drifting', () => {
      expect(weekKeys(new Date('2026-03-03T00:00:00Z'), 3))
        .toEqual(['2026-02-16', '2026-02-23', '2026-03-02']);
    });
  });

  describe('densify', () => {
    it('zero-fills weeks the query returned no rows for', () => {
      const keys = ['2026-07-06', '2026-07-13', '2026-07-20'];
      const rows = [{ bucket: '2026-07-20', value: 5 }, { bucket: '2026-07-06', value: 2 }];
      // Order comes from keys, not from the query — a quiet middle week must not collapse.
      expect(densify(rows, keys)).toEqual([2, 0, 5]);
    });

    it('accepts full timestamps from the driver, not just dates', () => {
      const rows = [{ bucket: '2026-07-06T00:00:00.000Z', value: 3 }];
      expect(densify(rows, ['2026-07-06'])).toEqual([3]);
    });

    it('coerces string counts, which is what COUNT(*) returns', () => {
      const rows = [{ bucket: '2026-07-06', value: '42' as any }];
      expect(densify(rows, ['2026-07-06'])).toEqual([42]);
    });
  });

  describe('deltaPct', () => {
    it('reports growth against the previous period', () => {
      expect(deltaPct(125, 100)).toBe(25);
    });

    it('reports a decline as negative', () => {
      expect(deltaPct(80, 100)).toBe(-20);
    });

    it('returns null with no baseline instead of inventing +100%', () => {
      // A first-week account has nothing to compare against; the UI hides the badge.
      expect(deltaPct(500, 0)).toBeNull();
    });
  });

  describe('sum', () => {
    it('trims float noise from the commission column', () => {
      expect(sum([0.1, 0.2])).toBe(0.3);
    });

    it('is zero for an empty series', () => {
      expect(sum([])).toBe(0);
    });
  });
});
