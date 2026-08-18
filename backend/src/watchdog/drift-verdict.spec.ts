import { driftVerdict } from './drift-verdict';

describe('driftVerdict', () => {
  const base = { medianMin: 120, expectedMin: 120, failedRuns: 0 };

  it('says nothing when the campaign paces as configured', () => {
    expect(driftVerdict(base)).toBe('ok');
    expect(driftVerdict({ ...base, medianMin: 180 })).toBe('ok'); // 1.5× — a slow stretch
  });

  it('reports genuine drift when nothing failed', () => {
    expect(driftVerdict({ ...base, medianMin: 240 })).toBe('drift');
  });

  it('blames the failed run, not the pacing, for the hole it left', () => {
    // Issue #57 exactly: 120 configured, 240 observed — because the AI judge rejected one
    // run's copy and no post went out. Filing that as "publishes too slowly" sent the
    // investigation into nextGroupSlot and the send window, where nothing was wrong.
    expect(driftVerdict({ medianMin: 240, expectedMin: 120, failedRuns: 1 }))
      .toBe('explained-by-failures');
  });

  it('still reports drift that failures cannot account for', () => {
    // One failure explains up to a doubled gap. A quadrupled one is something else.
    expect(driftVerdict({ medianMin: 500, expectedMin: 120, failedRuns: 1 })).toBe('drift');
  });

  it('scales the allowance with the number of failures', () => {
    expect(driftVerdict({ medianMin: 350, expectedMin: 120, failedRuns: 2 }))
      .toBe('explained-by-failures');
  });

  it('refuses to judge without a real expectation', () => {
    expect(driftVerdict({ medianMin: 240, expectedMin: 0, failedRuns: 0 })).toBe('ok');
  });
});
