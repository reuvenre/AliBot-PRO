/**
 * Suggested search keywords for an AliExpress bonus pool.
 *
 * The pools repeat month after month under the same handful of names, so the common ones
 * are answered from a table here: instant, free, and identical every time — no AI credit
 * spent on a question whose answer doesn't change. Anything unrecognised falls through to
 * the model (see IncentiveService.suggestKeywords).
 *
 * The lists are deliberately GENERIC category terms, never brand names: a keyword decides
 * what the autopilot searches, and a brand term drags the results toward listings whose
 * authenticity we can't vouch for — which is exactly the kind of post that costs a
 * Pinterest or Meta account.
 */

export interface PoolSuggestion {
  keywords: string[];
  /** Where the answer came from — the UI says so, so the owner can judge it. */
  source: 'known' | 'ai';
}

/** name-fragment → keywords. Matched case-insensitively on the pool's name. */
const KNOWN_POOLS: Array<{ match: RegExp; keywords: string[] }> = [
  {
    match: /home\s*&?\s*living|home\s*and\s*living|בית/i,
    keywords: ['storage box', 'kitchen organizer', 'closet organizer', 'bathroom organizer', 'home decor', 'laundry basket'],
  },
  {
    match: /beauty|fashion|יופי|אופנה/i,
    keywords: ['makeup organizer', 'skincare tools', 'hair styling tools', 'jewelry organizer', 'nail art kit'],
  },
  {
    match: /toy|collectib|צעצוע/i,
    keywords: ['educational toys', 'kids building blocks', 'outdoor toys', 'puzzle games', 'sensory toys'],
  },
  {
    match: /watch|eyewear|glasses|שעון|משקפ/i,
    keywords: ['tactical watch', 'digital sport watch', 'polarized sunglasses', 'military watch', 'smart watch band'],
  },
  {
    match: /fitness|wellness|sport|gym|כושר|ספורט/i,
    keywords: ['fitness equipment', 'resistance bands', 'gym accessories', 'sports water bottle', 'yoga mat'],
  },
  {
    match: /mom\s*&?\s*baby|mother|תינוק|אמא/i,
    keywords: ['baby carrier', 'nursing accessories', 'baby feeding set', 'kids storage', 'stroller accessories'],
  },
  {
    match: /shoe|hat|wig|נעל|כובע/i,
    keywords: ['running sneakers', 'canvas sneakers', 'bucket hat', 'baseball cap', 'winter beanie'],
  },
  {
    match: /electronic|gadget|phone|אלקטרוניקה|גאדג/i,
    keywords: ['phone accessories', 'wireless charger', 'bluetooth earbuds', 'car phone holder', 'led strip lights'],
  },
  {
    match: /tool|improvement|garden|כלי\s*עבודה|גינה/i,
    keywords: ['hand tools set', 'garden tools', 'measuring tools', 'drill accessories', 'workshop organizer'],
  },
  {
    match: /pet|חיות/i,
    keywords: ['pet grooming tools', 'dog accessories', 'cat toys', 'pet feeding bowl'],
  },
  {
    match: /auto|car|motor|רכב/i,
    keywords: ['car accessories', 'car organizer', 'car cleaning tools', 'dash cam'],
  },
];

/** The prompt for the fallback. Kept here beside the table it backs up. */
export const POOL_KEYWORDS_SYSTEM =
  'You map an AliExpress affiliate bonus-pool name to product SEARCH KEYWORDS.\n'
  + 'Answer with ONLY a JSON array of 4-6 lowercase English search phrases, 2-3 words each.\n'
  + 'Rules: generic product categories a shopper would type; NEVER brand names, never '
  + '"official"/"authentic"/"replica"; no punctuation; no explanation outside the array.\n'
  + 'Example for "Home & Living Pool": ["storage box","kitchen organizer","closet organizer","home decor"]';

/** A pool this system already knows, or null when the model should answer instead. */
export function knownPoolKeywords(name: string): string[] | null {
  const n = String(name || '').trim();
  if (!n) return null;
  for (const entry of KNOWN_POOLS) if (entry.match.test(n)) return [...entry.keywords];
  return null;
}

/**
 * Parse the model's reply into keywords. Fail-CLOSED: anything unparseable returns an
 * empty list, so the owner writes their own rather than getting junk typed in for them.
 * Brand-ish terms are dropped even if the model produced them — the rule above matters
 * more than the answer.
 */
export function parsePoolKeywords(raw: string | null | undefined): string[] {
  const text = String(raw || '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let arr: unknown;
  try { arr = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const banned = /official|authentic|genuine|replica|original\b|copy/i;
  const out: string[] = [];
  for (const item of arr) {
    const k = String(item || '').trim().toLowerCase().replace(/["'.,]/g, '');
    if (!k || k.length > 40 || k.split(/\s+/).length > 4) continue;
    if (banned.test(k)) continue;
    if (!out.includes(k)) out.push(k);
    if (out.length >= 6) break;
  }
  return out;
}
