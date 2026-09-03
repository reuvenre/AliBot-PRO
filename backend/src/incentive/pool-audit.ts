import { KNOWN_POOL_KEYWORD_INDEX, knownPoolKeywords } from './pool-keywords';

/**
 * Does each registered pool actually hold keywords from its own category?
 *
 * This exists because a broken matcher had already written wrong keywords into real pools
 * before it was fixed. Fixing the suggestion button does nothing for a pool that was filled
 * MONTHS ago — "Home Textiles & Carpets" is still sitting there holding `pet grooming tools`,
 * the autopilot is still searching for dog bowls, and AliExpress is still paying no bonus
 * because nothing published was in the pool's category. The fix has to be visible on the
 * screen or it does not reach the pools that need it.
 *
 * HOW A KEYWORD IS JUDGED, and why it is not the obvious way: running a keyword through the
 * NAME matcher looks right and is wrong — "pet grooming tools" scores higher on `tool` (4)
 * than on `pet` (3) and comes back as a hardware pool. Keywords are full of generic nouns
 * (tools, accessories, organizer) that the name matcher was never built to weigh.
 *
 * So a keyword is judged by EXACT membership in the table's own keyword lists. That is
 * narrow on purpose, and it is exactly the right net: the wrong keywords in the database got
 * there by being copied verbatim out of this table, so membership catches every one of them.
 * A keyword the owner typed himself ("dish rack") belongs to no list, cannot be judged, and
 * is left alone — a check that second-guesses hand-written keywords would cry wolf, and a
 * check that cries wolf gets ignored, at which point it protects nothing.
 */

export interface PoolAudit {
  /** The category the pool NAME reads as, in Hebrew. null = this name is not in the table. */
  nameCategory: string | null;
  /** What the suggestion button would offer for this name now. Empty when unrecognised. */
  suggested: string[];
  /** Saved keywords that verifiably belong to a DIFFERENT category, and to which. */
  offCategory: Array<{ keyword: string; category: string }>;
  /** Distinct categories the saved keywords read as — the useful signal when the name
   *  itself is unrecognised, because it says what the pool is currently CHASING. */
  keywordCategories: string[];
  /**
   * `mismatch` — the name is known and some keywords belong elsewhere: fix these.
   * `unrecognized` — the table does not know this name, so nothing can be asserted about
   *   its keywords; `keywordCategories` is offered for the owner to eyeball.
   * `ok` — the name is known and nothing contradicts it.
   */
  verdict: 'ok' | 'mismatch' | 'unrecognized';
}

/** The single category a keyword provably belongs to, or null when it cannot be judged —
 *  unknown to the table, or shared by two categories ("jewelry organizer"). */
export function categoryOfKeyword(keyword: string): string | null {
  const k = String(keyword || '').trim().toLowerCase();
  if (!k) return null;
  const labels = KNOWN_POOL_KEYWORD_INDEX.get(k);
  return labels && labels.length === 1 ? labels[0] : null;
}

export function auditPool(pool: { name: string; keywords: string[] }): PoolAudit {
  const match = knownPoolKeywords(pool.name);
  const nameCategory = match?.label ?? null;
  const suggested = match?.keywords ?? [];

  const offCategory: Array<{ keyword: string; category: string }> = [];
  const seenCategories: string[] = [];

  for (const raw of pool.keywords || []) {
    const keyword = String(raw || '').trim();
    if (!keyword) continue;
    const category = categoryOfKeyword(keyword);
    if (!category) continue;                                  // unjudgeable → left alone
    if (!seenCategories.includes(category)) seenCategories.push(category);
    if (nameCategory && category !== nameCategory) offCategory.push({ keyword, category });
  }

  const verdict: PoolAudit['verdict'] = !nameCategory
    ? 'unrecognized'
    : (offCategory.length ? 'mismatch' : 'ok');

  return { nameCategory, suggested, offCategory, keywordCategories: seenCategories, verdict };
}
