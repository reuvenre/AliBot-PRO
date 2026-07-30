import { KeywordPerformance, keywordWeight, weightedRotation } from './keyword-rotation';

const perf = (posts: number, clicks: number, revenue = 0): KeywordPerformance =>
  ({ posts, clicks, revenue });

describe('keywordWeight', () => {
  it('gives an earning keyword the most slots', () => {
    expect(keywordWeight(perf(8, 20, 45.5))).toBe(3);
  });

  it('gives a clicked keyword more than a dead one', () => {
    expect(keywordWeight(perf(8, 6))).toBe(2);
    expect(keywordWeight(perf(8, 0))).toBe(1);
  });

  it('treats a keyword with no history as unproven, not dead', () => {
    // "holographic sight" had never produced a post; it needs a chance to BE measured.
    expect(keywordWeight(undefined)).toBe(1);
    expect(keywordWeight(perf(0, 0))).toBe(1);
  });

  it('does not judge a keyword before it had a fair chance', () => {
    // 2 posts and no clicks is not evidence — same weight as never tried.
    expect(keywordWeight(perf(2, 0))).toBe(keywordWeight(undefined));
  });
});

describe('weightedRotation', () => {
  const KW = ['dead', 'clicked', 'earning', 'fresh'];
  const scores = new Map<string, KeywordPerformance>([
    ['dead', perf(9, 0)],
    ['clicked', perf(9, 5)],
    ['earning', perf(9, 12, 30)],
    // 'fresh' deliberately absent → unproven
  ]);

  it('never silences a keyword — every one still appears', () => {
    const rotation = weightedRotation(KW, scores);
    for (const kw of KW) expect(rotation).toContain(kw);
  });

  it('gives the winners a bigger share of the cycle', () => {
    const rotation = weightedRotation(KW, scores);
    const count = (kw: string) => rotation.filter((k) => k === kw).length;
    expect(count('earning')).toBe(3);
    expect(count('clicked')).toBe(2);
    expect(count('dead')).toBe(1);
    expect(count('fresh')).toBe(1);
  });

  it('spreads a winner\'s slots instead of grouping them back-to-back', () => {
    // Consecutive posts from one keyword read as repetition in the channel and compete
    // with each other in search, so the extra slots must be spread across the cycle.
    const rotation = weightedRotation(KW, scores);
    for (let i = 1; i < rotation.length; i++) {
      expect(rotation[i]).not.toBe(rotation[i - 1]);
    }
  });

  it('places copies at even spacing, deterministically', () => {
    expect(weightedRotation(KW, scores)).toEqual([
      'earning',            // 1/6 through the cycle
      'clicked',            // 1/4
      'dead', 'earning', 'fresh', // all at the midpoint, ordered by their campaign position
      'clicked',            // 3/4
      'earning',            // 5/6
    ]);
  });

  it('still spreads with many keywords, as a real campaign has', () => {
    // The production campaign carries 38 keywords; a couple of winners among them must not
    // end up adjacent just because the list is long.
    const many = Array.from({ length: 20 }, (_, i) => `kw${i}`);
    const s = new Map<string, KeywordPerformance>([
      ['kw3', perf(9, 10, 20)],
      ['kw11', perf(9, 4)],
    ]);
    const rotation = weightedRotation(many, s);
    expect(rotation.filter((k) => k === 'kw3')).toHaveLength(3);
    expect(rotation.filter((k) => k === 'kw11')).toHaveLength(2);
    for (let i = 1; i < rotation.length; i++) {
      expect(rotation[i]).not.toBe(rotation[i - 1]);
    }
  });

  it('is a plain round-robin when nothing has been measured yet', () => {
    expect(weightedRotation(KW, new Map())).toEqual(KW);
  });

  it('de-duplicates and drops blanks from the campaign list', () => {
    expect(weightedRotation(['a', 'a', ' ', '', 'b'], new Map())).toEqual(['a', 'b']);
  });

  it('returns empty for an empty keyword list', () => {
    expect(weightedRotation([], new Map())).toEqual([]);
  });
});
