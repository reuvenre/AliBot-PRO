import {
  FLYLINK_REPLICA_LINE, FLYLINK_TRUST_MARK, flylinkTrustBlock, isFlylinkPost, showsReplicaLine,
} from './flylink-trust';

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

  it('says out loud what the product is, on the owner\'s own channels', () => {
    expect(flylinkTrustBlock('telegram')).toContain(FLYLINK_REPLICA_LINE);
    expect(flylinkTrustBlock('whatsapp')).toContain(FLYLINK_REPLICA_LINE);
  });

  it('keeps the word off the platforms that ban replicas outright', () => {
    // Meta and Pinterest prohibit replica goods, and "רפליקה" in plain Hebrew is the
    // easiest possible match for their enforcement — the line that protects the buyer
    // would be the thing that costs the owner his page.
    for (const p of ['facebook', 'instagram', 'pinterest'] as const) {
      expect(flylinkTrustBlock(p)).not.toContain('רפליקה');
    }
    // Unknown platform is treated the same way: we cannot tell where this is going.
    expect(flylinkTrustBlock()).not.toContain('רפליקה');
    expect(showsReplicaLine(undefined)).toBe(false);
  });

  it('keeps the rest of the block identical on every platform', () => {
    const groups = flylinkTrustBlock('telegram').split('\n').filter((l) => l !== FLYLINK_REPLICA_LINE);
    expect(groups).toEqual(flylinkTrustBlock('facebook').split('\n'));
  });

  it('never over-promises — no delivery times, no authenticity claims', () => {
    const block = flylinkTrustBlock('telegram');
    // The one defect this block must never develop: a number or claim we can't stand
    // behind. Days-to-deliver and "מקורי"/"זהה" claims are the two ways that happens.
    expect(block).not.toMatch(/\d+\s*ימים/);
    expect(block).not.toMatch(/מקורי|זהה למקור|100%/);
  });
});
