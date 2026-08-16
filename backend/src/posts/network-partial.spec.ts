import { AUTO_RETRY_MARK, isRetryableNetworkPartial } from './network-partial';

describe('isRetryableNetworkPartial', () => {
  const NET = 'Facebook: החיבור לשרתי מטא נכשל ברמת הרשת (ETIMEDOUT) — תקלה זמנית, נסה שוב.';

  it('retries a connection that died at the wire — nothing was published', () => {
    expect(isRetryableNetworkPartial(NET)).toBe(true);
  });

  it('never retries a TIMEOUT — the post may already be on the page', () => {
    // The whole safety argument: a timeout means the request may have arrived and only
    // the reply was lost. Retrying it publishes twice.
    expect(isRetryableNetworkPartial('Facebook: פייסבוק לא השיבה בזמן. הפרסום יינסה שוב בריצה הבאה.')).toBe(false);
  });

  it('leaves alone what only the owner can fix', () => {
    expect(isRetryableNetworkPartial('Facebook: (#190) טוקן הפייסבוק פג תוקף או בוטל.')).toBe(false);
    expect(isRetryableNetworkPartial('Instagram: (#10) חסרה ההרשאה instagram_content_publish.')).toBe(false);
  });

  it('gives each post exactly ONE automatic attempt', () => {
    // Without this a channel that is genuinely down would spin the scheduler forever.
    expect(isRetryableNetworkPartial(`${NET}${AUTO_RETRY_MARK}`)).toBe(false);
  });

  it('skips a MIXED failure — half of it would fail identically', () => {
    expect(isRetryableNetworkPartial(`${NET} | Instagram: אינסטגרם לא השיבה בזמן`)).toBe(false);
  });

  it('treats an empty error as nothing to do', () => {
    expect(isRetryableNetworkPartial('')).toBe(false);
    expect(isRetryableNetworkPartial(null)).toBe(false);
    expect(isRetryableNetworkPartial('   ')).toBe(false);
  });
});
