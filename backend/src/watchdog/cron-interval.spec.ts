import { cronBaseIntervalMin, cronTypicalIntervalMin } from './cron-interval';

const AT = new Date('2026-08-01T00:00:00Z');

describe('a REGULAR schedule — both readings agree', () => {
  it.each([
    ['0 * * * *', 60],
    ['0 */3 * * *', 180],
    ['*/30 * * * *', 30],
    ['0 9 * * *', 1440],
  ])('%s → %i minutes', (expr, minutes) => {
    expect(cronBaseIntervalMin(expr, AT)).toBe(minutes);
    expect(cronTypicalIntervalMin(expr, AT)).toBe(minutes);
  });
});

describe('an IRREGULAR schedule — the two readings must differ', () => {
  // Fires at 09,10,13,16,19,22: one 60-minute gap, the rest ~3 hours. This exact shape is
  // what the drift check misread — it took the 60 as the expectation and called a campaign
  // publishing every ~3 hours, exactly as its owner intended, a 3× drift.
  const irregular = '0 9,10,13,16,19,22 * * *';

  it('reports the TIGHTEST gap as the base interval', () => {
    expect(cronBaseIntervalMin(irregular, AT)).toBe(60);
  });

  it('reports the TYPICAL gap as roughly three hours', () => {
    expect(cronTypicalIntervalMin(irregular, AT)).toBe(180);
  });

  it('does not let one long overnight gap set the expectation', () => {
    // 22:00 → 09:00 is an 11-hour gap. The median must ignore it, or an office-hours
    // campaign would be expected to publish once every 11 hours and real stalls would hide.
    expect(cronTypicalIntervalMin(irregular, AT)).toBeLessThan(300);
  });
});

describe('unreadable expressions', () => {
  it.each(['', '   ', 'every 3 hours', '99 99 99 99 99', null as any, undefined as any])(
    'returns null for %p', (bad) => {
      expect(cronBaseIntervalMin(bad, AT)).toBeNull();
      expect(cronTypicalIntervalMin(bad, AT)).toBeNull();
    },
  );
});

describe('stability', () => {
  it('gives the same answer whatever moment it is asked', () => {
    // A cadence expectation that shifts with the clock would make the drift check fire and
    // clear on its own, with nothing about the campaign having changed.
    for (const at of ['2026-08-01T00:00:00Z', '2026-08-01T09:30:00Z', '2026-12-31T23:59:00Z']) {
      expect(cronTypicalIntervalMin('0 */3 * * *', new Date(at))).toBe(180);
    }
  });

  it('never returns zero or a negative interval', () => {
    for (const expr of ['* * * * *', '0 * * * *', '0 9 * * 1']) {
      expect(cronBaseIntervalMin(expr, AT)!).toBeGreaterThan(0);
      expect(cronTypicalIntervalMin(expr, AT)!).toBeGreaterThan(0);
    }
  });
});
