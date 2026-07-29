import { fallbackKeywords } from './posts.service';

/**
 * Regression test for a campaign losing whole hours to one dead keyword.
 *
 * Production symptom (29/07): the hourly "טקטי בקליק" campaign drew "holographic sight"
 * from its rotation, AliExpress returned zero products, and the WHOLE run aborted with
 * "אף מילת מפתח לא החזירה מוצרים" — no post that hour. Five of ten consecutive runs died
 * this way, so the campaign published at roughly half its configured rate.
 */
describe('fallbackKeywords', () => {
  const KW = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('continues the rotation after the slot keywords instead of restarting it', () => {
    // Slot used 'a' (cursor 0, one post) → the fallback starts at 'b', not back at 'a'.
    expect(fallbackKeywords(KW, 1, new Set(['a']), 3)).toEqual(['b', 'c', 'd']);
  });

  it('never re-searches a keyword this run already tried', () => {
    // A 2-post run whose both keywords were dry must not pay for those searches twice.
    expect(fallbackKeywords(KW, 2, new Set(['a', 'b']), 3)).toEqual(['c', 'd', 'e']);
  });

  it('wraps around the end of the list', () => {
    expect(fallbackKeywords(KW, 5, new Set(['e']), 3)).toEqual(['f', 'a', 'b']);
  });

  it('is bounded, so one dead run cannot chain into many API calls', () => {
    expect(fallbackKeywords(KW, 0, new Set(), 2)).toHaveLength(2);
  });

  it('never returns more than the list holds, even when max exceeds it', () => {
    const out = fallbackKeywords(KW, 0, new Set(['a']), 99);
    expect(out).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(new Set(out).size).toBe(out.length); // no repeats → no wasted searches
  });

  it('returns nothing when every keyword was already tried', () => {
    expect(fallbackKeywords(KW, 0, new Set(KW), 5)).toEqual([]);
  });

  it('handles a single-keyword campaign — there is nothing to fall back to', () => {
    expect(fallbackKeywords(['only'], 1, new Set(['only']), 5)).toEqual([]);
  });
});
