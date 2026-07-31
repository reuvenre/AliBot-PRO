import {
  CampaignCtr, MIN_BASELINE_CLICKS, MIN_DROP_PERCENT, MIN_POSTS_PER_WINDOW,
  detectCtrRegressions, regressionLine,
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
