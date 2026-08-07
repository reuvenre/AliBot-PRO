import { MAX_SNAP_DELAY_MS, hourInTz, snapToHotHour } from './smart-timing';

// August → Israel is UTC+3. 2026-08-10T09:00Z = 12:00 in Asia/Jerusalem.
const IL = (utcHour: number, min = 0) => new Date(Date.UTC(2026, 7, 10, utcHour, min));

describe('hourInTz', () => {
  it('reads the audience clock, not the server clock', () => {
    expect(hourInTz(IL(9))).toBe(12);
    expect(hourInTz(IL(21))).toBe(0); // midnight wrap
  });
});

describe('snapToHotHour', () => {
  it('leaves a slot already inside a golden hour untouched', () => {
    const slot = IL(9, 4); // 12:04 IL
    expect(snapToHotHour(slot, [12, 20])).toBe(slot);
  });

  it('slides a cold-hour slot forward to the next golden hour', () => {
    const slot = IL(8, 0); // 11:00 IL, golden = 12
    const snapped = snapToHotHour(slot, [12]);
    expect(hourInTz(snapped)).toBe(12);
    expect(snapped.getTime()).toBeGreaterThan(slot.getTime());
    expect(snapped.getTime() - slot.getTime()).toBeLessThanOrEqual(MAX_SNAP_DELAY_MS);
  });

  it('never moves a slot earlier', () => {
    const slot = IL(10, 30); // 13:30 IL, golden hour 12 already passed today (next is tomorrow, out of range)
    expect(snapToHotHour(slot, [12]).getTime()).toBe(slot.getTime());
  });

  it('keeps the natural slot when no golden hour is reachable within the cap', () => {
    const slot = IL(6); // 09:00 IL; golden = 21 — 12h away, far past the 3h cap
    expect(snapToHotHour(slot, [21])).toBe(slot);
  });

  it('no golden hours (or garbage) → no change', () => {
    const slot = IL(9);
    expect(snapToHotHour(slot, [])).toBe(slot);
    expect(snapToHotHour(slot, [25, -3] as any)).toBe(slot);
  });
});
