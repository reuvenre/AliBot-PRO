import {
  DEFAULT_INSIGHTS_HOUR, DEFAULT_SUMMARY_HOUR, MIN_INSIGHTS_HOUR,
  clampInsightsHour, clampSummaryHour, reportDue,
} from './report-hours';

describe('clampSummaryHour', () => {
  it('accepts any hour of the day', () => {
    expect(clampSummaryHour(0)).toBe(0);
    expect(clampSummaryHour(9)).toBe(9);
    expect(clampSummaryHour(23)).toBe(23);
  });

  it('falls back for junk and bounds the extremes', () => {
    expect(clampSummaryHour(undefined)).toBe(DEFAULT_SUMMARY_HOUR);
    expect(clampSummaryHour('abc')).toBe(DEFAULT_SUMMARY_HOUR);
    expect(clampSummaryHour(-3)).toBe(0);
    expect(clampSummaryHour(99)).toBe(23);
    expect(clampSummaryHour(9.7)).toBe(9);
  });
});

describe('clampInsightsHour', () => {
  it('never lets the insights report run before the AliExpress accounting close', () => {
    expect(clampInsightsHour(6)).toBe(MIN_INSIGHTS_HOUR);
    expect(clampInsightsHour(0)).toBe(MIN_INSIGHTS_HOUR);
    expect(clampInsightsHour(10)).toBe(10);
    expect(clampInsightsHour(20)).toBe(20);
    expect(clampInsightsHour(undefined)).toBe(DEFAULT_INSIGHTS_HOUR);
  });
});

describe('reportDue', () => {
  const today = '2026-08-10';

  it('is due once the hour arrives', () => {
    expect(reportDue(9, 9, null, today)).toBe(true);
    expect(reportDue(8, 9, null, today)).toBe(false);
  });

  it('never sends twice on the same day', () => {
    expect(reportDue(11, 9, today, today)).toBe(false);
    expect(reportDue(11, 9, '2026-08-09', today)).toBe(true);
  });

  it('catches up after a missed tick instead of losing the day', () => {
    // Server was down at 09:00; the 14:00 tick still delivers.
    expect(reportDue(14, 9, '2026-08-09', today)).toBe(true);
  });
});
