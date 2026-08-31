import {
  CampaignCtr, MIN_BASELINE_CLICKS, MIN_DROP_PERCENT, MIN_POSTS_PER_WINDOW,
  clicksMeasurable, detectCtrRegressions, regressionLine, windowsComparable,
} from './regression';

const row = (over: Partial<CampaignCtr> = {}): CampaignCtr => ({
  campaignId: 'c1',
  campaignName: 'טקטי בקליק',
  userId: 'u1',
  // A healthy baseline (0.5 clicks/post) that collapsed to 0.1 — an unambiguous drop.
  recentPosts: 40,
  recentClicks: 4,
  baselinePosts: 120,
  baselineClicks: 60,
  ...over,
});

describe('detectCtrRegressions', () => {
  it('reports a genuine collapse with the numbers behind it', () => {
    const [r] = detectCtrRegressions([row()]);
    expect(r).toMatchObject({
      campaignId: 'c1', recentRate: 0.1, baselineRate: 0.5, dropPercent: 80,
    });
  });

  it('reports a campaign that stopped converting entirely', () => {
    expect(detectCtrRegressions([row({ recentClicks: 0 })])[0].dropPercent).toBe(100);
  });

  it('ignores ordinary week-to-week movement', () => {
    // 0.5 → 0.4 is a slow week, not a regression. Reporting it trains the owner to
    // ignore the watchdog, at which point it protects nothing.
    expect(detectCtrRegressions([row({ recentPosts: 40, recentClicks: 16 })])).toEqual([]);
  });

  it('says nothing when a rate went UP', () => {
    expect(detectCtrRegressions([row({ recentClicks: 40 })])).toEqual([]);
  });

  it('refuses to compare windows without enough posts', () => {
    // Too few posts either side and the two rates are not measuring the same thing.
    const thin = MIN_POSTS_PER_WINDOW - 1;
    expect(detectCtrRegressions([row({ recentPosts: thin, recentClicks: 0 })])).toEqual([]);
    expect(detectCtrRegressions([row({ baselinePosts: thin, baselineClicks: 30 })])).toEqual([]);
  });

  it('refuses to call it a drop from a baseline that was never real', () => {
    // 2 clicks → 0 is "down 100%", which is a sentence about rounding, not the business.
    expect(detectCtrRegressions([row({
      baselinePosts: 120, baselineClicks: MIN_BASELINE_CLICKS - 1, recentClicks: 0,
    })])).toEqual([]);
  });

  it('says nothing about a campaign that never drew a click at all', () => {
    // Nothing to regress from — and the keyword loop already handles a quiet campaign.
    expect(detectCtrRegressions([row({ baselineClicks: 0, recentClicks: 0 })])).toEqual([]);
  });

  it('ranks the worst collapse first', () => {
    const out = detectCtrRegressions([
      row({ campaignId: 'mild', recentClicks: 10 }),   // 0.5 → 0.25, -50%
      row({ campaignId: 'severe', recentClicks: 0 }),  // 0.5 → 0,    -100%
    ]);
    expect(out.map((r) => r.campaignId)).toEqual(['severe', 'mild']);
  });

  it('judges each campaign against itself, not against the others', () => {
    // A small group at 0.1 is healthy for IT; a big group falling to 0.1 is not. Only the
    // one that fell is reported — cross-campaign comparison would flag the wrong group.
    const out = detectCtrRegressions([
      row({ campaignId: 'small', recentPosts: 40, recentClicks: 4, baselinePosts: 120, baselineClicks: 12 }),
      row({ campaignId: 'fell', recentPosts: 40, recentClicks: 4, baselinePosts: 120, baselineClicks: 60 }),
    ]);
    expect(out.map((r) => r.campaignId)).toEqual(['fell']);
  });

  it('survives empty and malformed input', () => {
    expect(detectCtrRegressions([])).toEqual([]);
    expect(detectCtrRegressions(undefined as any)).toEqual([]);
    expect(detectCtrRegressions([null as any, { campaignId: '' } as any])).toEqual([]);
  });

  it('sets a bar high enough to be worth waking someone for', () => {
    expect(MIN_DROP_PERCENT).toBeGreaterThanOrEqual(30);
  });
});

describe('regressionLine', () => {
  it('states what fell and by how much, in plain numbers', () => {
    const line = regressionLine(detectCtrRegressions([row()])[0]);
    expect(line).toContain('טקטי בקליק');
    expect(line).toContain('80%');
    expect(line).toContain('0.1');
    expect(line).toContain('0.5');
  });
});

describe('windowsComparable', () => {
  const FILTER = new Date('2026-07-31T11:00:00Z');

  it('holds the check while the baseline still spans the old click unit', () => {
    // Aug 2: the 28-day span reaches back to Jul 5 — three weeks of bot-inflated clicks.
    // This exact state produced a fabricated "-46% collapse" on the check's first firing.
    expect(windowsComparable(new Date('2026-08-02T06:00:00Z'), 7, 21, FILTER)).toBe(false);
  });

  it('resumes by itself once the full span is post-filter', () => {
    expect(windowsComparable(new Date('2026-08-28T12:00:00Z'), 7, 21, FILTER)).toBe(true);
  });

  it('flips exactly at the boundary, never a day early', () => {
    const boundary = new Date(FILTER.getTime() + 28 * 24 * 3600_000);
    expect(windowsComparable(new Date(boundary.getTime() - 60_000), 7, 21, FILTER)).toBe(false);
    expect(windowsComparable(boundary, 7, 21, FILTER)).toBe(true);
  });
});

/**
 * The real alert behind these tests: a Pinterest-only campaign reported "-100%" on 42 posts
 * with zero clicks. Nothing was broken — a pin links straight to AliExpress, so a click on
 * it never passes through our redirect and the rate is zero by construction.
 */
describe('clicksMeasurable — campaigns whose clicks can never reach the counter', () => {
  it('leaves a Pinterest-only campaign out of the scan entirely', () => {
    expect(clicksMeasurable('["pinterest"]')).toBe(false);
    expect(detectCtrRegressions([row({
      targetPlatforms: '["pinterest"]', recentPosts: 42, recentClicks: 0,
      baselinePosts: 55, baselineClicks: 13,
    })])).toEqual([]);
  });

  it('keeps a campaign that ALSO publishes where clicks ARE counted', () => {
    expect(clicksMeasurable('["pinterest","telegram"]')).toBe(true);
    expect(detectCtrRegressions([row({ targetPlatforms: '["telegram","pinterest"]' })]).length).toBe(1);
  });

  it('treats an unset platform list as measurable — that is the global fan-out', () => {
    expect(clicksMeasurable(null)).toBe(true);
    expect(clicksMeasurable('[]')).toBe(true);
    expect(clicksMeasurable(undefined)).toBe(true);
    expect(detectCtrRegressions([row()]).length).toBe(1);
  });

  it('does not let malformed JSON silence a real regression', () => {
    expect(clicksMeasurable('not json')).toBe(true);
  });
});
