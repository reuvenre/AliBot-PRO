import {
  AUTO_RETRY_MARK, MAX_AUTO_RETRIES, NET_SAFE_TAG, autoRetryCount, isRetryableNetworkPartial,
} from './network-partial';

describe('isRetryableNetworkPartial', () => {
  const FB = `Facebook: החיבור לשרתי מטא נכשל ברמת הרשת (ETIMEDOUT) ${NET_SAFE_TAG}`;
  const TG = `Telegram: שגיאת חיבור לטלגרם (ETIMEDOUT) ${NET_SAFE_TAG}`;

  it('retries a failure the sender PROVED never left the machine', () => {
    expect(isRetryableNetworkPartial(FB)).toBe(true);
    expect(isRetryableNetworkPartial(TG)).toBe(true);
  });

  it('does not retry the same wording WITHOUT the tag', () => {
    // The whole reason the tag exists: this exact sentence is also what a timeout on an
    // open socket produces, and there the post may already be live. Wording cannot decide.
    expect(isRetryableNetworkPartial('Telegram: שגיאת חיבור לטלגרם (ETIMEDOUT)')).toBe(false);
  });

  it('leaves alone what only the owner can fix', () => {
    expect(isRetryableNetworkPartial('Facebook: (#190) טוקן הפייסבוק פג תוקף או בוטל.')).toBe(false);
  });

  it('skips a MIXED failure — half of it would fail identically', () => {
    expect(isRetryableNetworkPartial(`${TG} | Instagram: (#10) חסרה ההרשאה`)).toBe(false);
  });

  it('retries a multi-platform failure when EVERY half is wire-safe', () => {
    expect(isRetryableNetworkPartial(`${TG} | ${FB}`)).toBe(true);
  });

  it('allows a few attempts — a blip can outlast one', () => {
    expect(isRetryableNetworkPartial(`${FB}${AUTO_RETRY_MARK}`)).toBe(true);
    expect(isRetryableNetworkPartial(`${FB}${AUTO_RETRY_MARK.repeat(MAX_AUTO_RETRIES - 1)}`)).toBe(true);
  });

  it('stops at the cap, so a dead channel cannot spin the scheduler', () => {
    expect(isRetryableNetworkPartial(`${FB}${AUTO_RETRY_MARK.repeat(MAX_AUTO_RETRIES)}`)).toBe(false);
  });

  it('still honours rows written before the tag existed', () => {
    expect(isRetryableNetworkPartial('Facebook: החיבור לשרתי מטא נכשל ברמת הרשת (ETIMEDOUT)')).toBe(true);
  });

  it('treats an empty error as nothing to do', () => {
    expect(isRetryableNetworkPartial('')).toBe(false);
    expect(isRetryableNetworkPartial(null)).toBe(false);
  });
});

describe('autoRetryCount', () => {
  it('counts the attempts already spent', () => {
    expect(autoRetryCount('x')).toBe(0);
    expect(autoRetryCount(`x${AUTO_RETRY_MARK}${AUTO_RETRY_MARK}`)).toBe(2);
  });
});
