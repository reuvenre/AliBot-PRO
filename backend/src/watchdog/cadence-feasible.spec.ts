import { feasibleCadenceMin } from './cadence-feasible';

describe('feasibleCadenceMin', () => {
  it('an unshared campaign gets NO slack — the classic regression must still alert', () => {
    // The original bug: a lone hourly campaign publishing every ~2h. feasible stays 60,
    // the 1.7x threshold fires at 102 — sensitivity unchanged where it matters most.
    expect(feasibleCadenceMin(60, 60, 1)).toBe(60);
    expect(feasibleCadenceMin(60, 0, 1)).toBe(60);
  });

  it('models the incident: hourly cron, hourly group, three sharers', () => {
    // "מאמא - אלי אקספרס": measured ~419 min and reported as drift against a naive
    // expectation of 180. With phase slip the feasible median is 300 — 419 sits under
    // the 1.7x line (510), which is the correct verdict: crowded, not broken.
    const feasible = feasibleCadenceMin(60, 60, 3);
    expect(feasible).toBe(300);
    expect(419 < feasible * 1.7).toBe(true);
  });

  it('still catches a REAL failure on a shared group', () => {
    // Sharing explains ~419; it does not explain ~600+. A genuine stall must clear the
    // shared allowance and alert.
    expect(600 > feasibleCadenceMin(60, 60, 3) * 1.7).toBe(true);
  });

  it('slack uses the SLOT size, not the base, when cron is slower than the group', () => {
    // cron 180 on a 60-min group with one sibling: base 180 ×2 + one 60-min slot = 420.
    expect(feasibleCadenceMin(180, 60, 2)).toBe(420);
  });

  it('survives degenerate inputs', () => {
    expect(feasibleCadenceMin(60, 60, 0)).toBe(60);
    expect(feasibleCadenceMin(60, 60, NaN as any)).toBe(60);
  });
});
