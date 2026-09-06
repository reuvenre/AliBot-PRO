import { TOKEN_WARN_DAYS, daysUntil, tokenNeedsWarning } from './meta-token';

/**
 * The rule that decides whether an owner gets woken about a Meta token.
 *
 * Its most important property is what it does with a token whose expiry is UNKNOWN — a
 * token that never expires, or one Graph could not be asked about. "Unknown" must read as
 * silence, never as "expired": the alternative is emailing someone that their publishing is
 * about to break because Graph had a bad minute.
 */
describe('daysUntil', () => {
  const NOW = new Date('2026-09-06T12:00:00Z');

  it('counts whole days ahead', () => {
    expect(daysUntil(new Date('2026-09-20T12:00:00Z'), NOW)).toBe(14);
    expect(daysUntil(new Date('2026-09-07T12:00:00Z'), NOW)).toBe(1);
  });

  it('goes negative once the token is already dead', () => {
    expect(daysUntil(new Date('2026-09-04T12:00:00Z'), NOW)).toBe(-2);
  });

  it('keeps null as null — unknown is not a number', () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
  });
});

describe('tokenNeedsWarning', () => {
  const NOW = new Date('2026-09-06T12:00:00Z');

  it('warns inside the window and after expiry', () => {
    expect(tokenNeedsWarning(new Date('2026-09-10T12:00:00Z'), NOW)).toBe(true);   // 4 days
    expect(tokenNeedsWarning(new Date('2026-09-01T12:00:00Z'), NOW)).toBe(true);   // already gone
  });

  it('stays quiet on a healthy token', () => {
    expect(tokenNeedsWarning(new Date('2026-11-01T12:00:00Z'), NOW)).toBe(false);
  });

  it('flips exactly at the threshold, not a day early', () => {
    const boundary = new Date(NOW.getTime() + TOKEN_WARN_DAYS * 86_400_000);
    expect(tokenNeedsWarning(boundary, NOW)).toBe(true);
    expect(tokenNeedsWarning(new Date(boundary.getTime() + 86_400_000), NOW)).toBe(false);
  });

  it('NEVER warns on an unknown expiry', () => {
    // A token that does not expire reports null, and so does a Graph lookup that failed.
    // Treating either as "expiring" would email an owner that their publishing is about to
    // break — on no evidence at all.
    expect(tokenNeedsWarning(null, NOW)).toBe(false);
    expect(tokenNeedsWarning(undefined, NOW)).toBe(false);
  });
});
