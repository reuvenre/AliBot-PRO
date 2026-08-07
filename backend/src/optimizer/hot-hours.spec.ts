import { formatHours, hotHours, MIN_CLICKS_FOR_HOT_HOURS } from './hot-hours';

describe('hotHours', () => {
  it('returns null below the data floor — an anecdote is not a rhythm', () => {
    expect(hotHours([{ hour: 14, clicks: 3 }])).toBeNull();
    expect(hotHours([])).toBeNull();
  });

  it('picks the strongest hours until they cover the target share', () => {
    // 100 clicks: 20:00 and 21:00 dominate (60 together = 60% share) → exactly those two.
    const rows = [
      { hour: 9, clicks: 10 }, { hour: 12, clicks: 15 }, { hour: 15, clicks: 15 },
      { hour: 20, clicks: 35 }, { hour: 21, clicks: 25 },
    ];
    const r = hotHours(rows)!;
    expect(r.hours).toEqual([20, 21]);
    expect(r.share).toBe(0.6);
    expect(r.total).toBe(100);
  });

  it('caps at four hours even when clicks are spread flat', () => {
    // 8 hours × 10 clicks — no hour dominates, so the cap decides.
    const rows = Array.from({ length: 8 }, (_, i) => ({ hour: 10 + i, clicks: 10 }));
    const r = hotHours(rows)!;
    expect(r.hours).toHaveLength(4);
    expect(r.share).toBe(0.5);
  });

  it('returns hours ascending regardless of click ranking', () => {
    const rows = [
      { hour: 21, clicks: 40 }, { hour: 9, clicks: 30 }, { hour: 15, clicks: 5 },
    ];
    expect(hotHours(rows)!.hours).toEqual([9, 21]);
  });

  it('ignores malformed rows and zero-click hours', () => {
    const rows = [
      { hour: 12, clicks: MIN_CLICKS_FOR_HOT_HOURS },
      { hour: 25, clicks: 50 }, { hour: -1, clicks: 50 }, { hour: 13, clicks: 0 },
    ] as any;
    const r = hotHours(rows)!;
    expect(r.hours).toEqual([12]);
    expect(r.total).toBe(MIN_CLICKS_FOR_HOT_HOURS);
  });
});

describe('formatHours', () => {
  it('renders zero-padded local times', () => {
    expect(formatHours([9, 12, 21])).toBe('09:00, 12:00, 21:00');
  });
});
