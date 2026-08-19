import { FLYLINK_TRUST_MARK, flylinkTrustBlock, isFlylinkPost } from './flylink-trust';

describe('flylink trust trailer', () => {
  it('identifies FLYLINK posts by their link, like the coupon filter does', () => {
    expect(isFlylinkPost('https://www.flylink.io/p/abc123')).toBe(true);
    expect(isFlylinkPost('https://s.click.aliexpress.com/e/_x')).toBe(false);
    expect(isFlylinkPost('')).toBe(false);
    expect(isFlylinkPost(null)).toBe(false);
  });

  it('opens with the stable dedup marker', () => {
    expect(flylinkTrustBlock().startsWith(FLYLINK_TRUST_MARK)).toBe(true);
  });

  it('never over-promises — no delivery times, no authenticity claims', () => {
    const block = flylinkTrustBlock();
    // The one defect this block must never develop: a number or claim we can't stand
    // behind. Days-to-deliver and "מקורי"/"זהה" claims are the two ways that happens.
    expect(block).not.toMatch(/\d+\s*ימים/);
    expect(block).not.toMatch(/מקורי|זהה למקור|100%/);
  });
});
