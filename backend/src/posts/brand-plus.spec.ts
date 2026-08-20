import { BRAND_PLUS_MARK, brandPlusLine } from './brand-plus';

describe('brandPlusLine', () => {
  it('both language variants carry the dedup mark', () => {
    expect(brandPlusLine(true)).toContain(BRAND_PLUS_MARK);
    expect(brandPlusLine(false)).toContain(BRAND_PLUS_MARK);
  });

  it('claims exactly what the badge certifies — an official brand store, nothing more', () => {
    // No invented guarantees (warranty, returns, delivery promises) may ride this line:
    // it renders on every Brand+ post, and an over-claim would be repeated at scale.
    for (const line of [brandPlusLine(true), brandPlusLine(false)]) {
      expect(line).not.toMatch(/אחריות|החזר|warranty|refund|guarantee/i);
    }
  });

  it('is bold — the whole point is emphasis', () => {
    expect(brandPlusLine(true)).toMatch(/<b>.*<\/b>/);
  });
});
