/**
 * Suggested search keywords for an AliExpress bonus pool.
 *
 * The pools repeat month after month under the same handful of names, so the common ones
 * are answered from a table here: instant, free, and identical every time — no AI credit
 * spent on a question whose answer doesn't change. Anything unrecognised — or ambiguous —
 * falls through to the model (see IncentiveService.suggestKeywords).
 *
 * The lists are deliberately GENERIC category terms, never brand names: a keyword decides
 * what the autopilot searches, and a brand term drags the results toward listings whose
 * authenticity we can't vouch for — which is exactly the kind of post that costs a
 * Pinterest or Meta account.
 *
 * MATCHING IS THE HARD PART, and it was wrong. The table used to test naked substrings and
 * take the FIRST hit, which produced confident, wrong answers on real portal names:
 *
 *   "Home Textiles & Carpets"    → pet grooming tools   (car·PET·s)
 *   "Beauty & Personal Care"     → car accessories      (·CAR·e), had beauty not caught it
 *   "Sports Shoes"               → yoga mats            ("sport" beat "shoe" on order alone)
 *
 * Those suggestions land in the keyword field looking authoritative, the autopilot searches
 * them, and the pool's bonus is never earned — the products published were never in its
 * category. So matching is now on WORD boundaries (plural-aware), the MOST SPECIFIC match
 * wins rather than the earliest, and a genuinely ambiguous name is handed to the model
 * instead of guessed at. A wrong guess here costs a month of bonus; asking costs one call.
 */

export interface PoolSuggestion {
  keywords: string[];
  /** Where the answer came from — the UI says so, so the owner can judge it. */
  source: 'known' | 'ai';
  /**
   * Which known pool the NAME was recognised as, in Hebrew. Shown on the screen, because
   * no table will ever cover every pool the portal invents: seeing "זוהה כ־חיות מחמד" on a
   * textiles pool is how a mis-recognition gets caught before it costs a month.
   */
  matched?: string;
}

interface KnownPool {
  /** Owner-facing name of what was recognised. */
  label: string;
  /** Name fragments identifying this pool. Matched on word boundaries; the LONGEST
   *  fragment that matches is the entry's specificity score. */
  tokens: string[];
  keywords: string[];
}

/**
 * The recurring pools. Order no longer decides anything — specificity does — so entries can
 * be added without auditing what sits above them.
 */
const KNOWN_POOLS: KnownPool[] = [
  {
    label: 'בית, מטבח וסידור',
    // NOTE: no bare "home". "Home Improvement" is a tools pool and "Home Textiles" is
    // neither; a bare token here would drag both in on four characters.
    tokens: ['home living', 'home and living', 'home decor', 'home storage', 'home organization',
      'home and kitchen', 'kitchen and dining', 'household', 'kitchen', 'furniture', 'bedding',
      'בית', 'מטבח', 'ריהוט'],
    keywords: ['storage box', 'kitchen organizer', 'closet organizer', 'bathroom organizer', 'home decor', 'laundry basket'],
  },
  {
    label: 'יופי, טיפוח ואופנה',
    tokens: ['beauty', 'fashion', 'personal care', 'skin care', 'skincare', 'makeup', 'cosmetic',
      'hair care', 'יופי', 'אופנה', 'טיפוח', 'קוסמטיקה'],
    keywords: ['makeup organizer', 'skincare tools', 'hair styling tools', 'jewelry organizer', 'nail art kit'],
  },
  {
    label: 'צעצועים ותחביבים',
    tokens: ['toy', 'collectible', 'hobbies', 'hobby', 'puzzle', 'צעצוע'],
    keywords: ['educational toys', 'kids building blocks', 'outdoor toys', 'puzzle games', 'sensory toys'],
  },
  {
    label: 'שעונים ומשקפיים',
    tokens: ['watch', 'eyewear', 'glasses', 'sunglass', 'שעון', 'משקפי שמש', 'משקפיים'],
    keywords: ['digital sport watch', 'smart watch band', 'polarized sunglasses', 'watch strap', 'waterproof wrist watch'],
  },
  {
    label: 'ספורט וכושר',
    tokens: ['fitness', 'wellness', 'gym', 'workout', 'yoga', 'sport', 'כושר', 'ספורט'],
    keywords: ['fitness equipment', 'resistance bands', 'gym accessories', 'sports water bottle', 'yoga mat'],
  },
  {
    label: 'אמא, תינוק וילדים',
    tokens: ['mom and baby', 'mother and kids', 'mother', 'baby', 'infant', 'toddler', 'nursery',
      'תינוק', 'אמא', 'ילדים'],
    keywords: ['baby carrier', 'nursing accessories', 'baby feeding set', 'kids storage', 'stroller accessories'],
  },
  {
    label: 'נעליים וכובעים',
    // "sports shoes" is spelled out so it outranks the bare "sport" in the fitness entry —
    // that pool sells footwear, not yoga mats.
    tokens: ['sports shoes', 'shoe', 'sneaker', 'footwear', 'hat', 'cap', 'wig', 'beanie',
      'נעליים', 'כובע', 'פאה'],
    keywords: ['running sneakers', 'canvas sneakers', 'bucket hat', 'baseball cap', 'winter beanie'],
  },
  {
    label: 'אלקטרוניקה וגאדג׳טים',
    tokens: ['consumer electronics', 'electronic', 'gadget', 'phone', 'telecommunication',
      'computer', 'audio', 'אלקטרוניקה', 'גאדגט', 'מחשב'],
    keywords: ['phone accessories', 'wireless charger', 'bluetooth earbuds', 'car phone holder', 'led strip lights'],
  },
  {
    label: 'כלי עבודה, שיפוץ וגינה',
    tokens: ['home improvement', 'improvement', 'tool', 'garden', 'lighting', 'hardware',
      'כלי עבודה', 'גינה', 'שיפוץ'],
    keywords: ['hand tools set', 'garden tools', 'measuring tools', 'drill accessories', 'workshop organizer'],
  },
  {
    label: 'חיות מחמד',
    tokens: ['pet supplies', 'pet', 'dog', 'cat', 'aquarium', 'חיות מחמד', 'חיות'],
    keywords: ['pet grooming tools', 'dog accessories', 'cat toys', 'pet feeding bowl'],
  },
  {
    label: 'רכב ואופנוע',
    tokens: ['automotive', 'motorcycle', 'vehicle', 'car', 'motor', 'רכב', 'אופנוע'],
    keywords: ['car accessories', 'car organizer', 'car cleaning tools', 'dash cam'],
  },
  {
    label: 'תיקים ומזוודות',
    tokens: ['luggage', 'backpack', 'suitcase', 'bag', 'wallet', 'תיקים', 'מזוודות'],
    keywords: ['travel backpack', 'laptop bag', 'crossbody bag', 'packing cubes', 'luggage organizer'],
  },
  {
    label: 'תכשיטים',
    // NOT "accessories" — it would beat "phone" on length and turn a phone-accessories
    // pool into a jewellery one.
    tokens: ['jewelry', 'jewellery', 'earring', 'necklace', 'bracelet', 'תכשיטים'],
    keywords: ['stainless steel necklace', 'hoop earrings', 'minimalist ring', 'bracelet set', 'jewelry organizer'],
  },
  {
    label: 'ביטחון והגנה',
    tokens: ['security', 'protection', 'tactical', 'ביטחון', 'הגנה', 'טקטי'],
    keywords: ['tactical flashlight', 'multi tool knife', 'tactical backpack', 'security camera', 'smart door lock'],
  },
];

/** The prompt for the fallback. Kept here beside the table it backs up. */
export const POOL_KEYWORDS_SYSTEM =
  'You map an AliExpress affiliate bonus-pool name to product SEARCH KEYWORDS.\n'
  + 'Answer with ONLY a JSON array of 4-6 lowercase English search phrases, 2-3 words each.\n'
  + 'Rules: generic product categories a shopper would type; NEVER brand names, never '
  + '"official"/"authentic"/"replica"; no punctuation; no explanation outside the array.\n'
  + 'Example for "Home & Living Pool": ["storage box","kitchen organizer","closet organizer","home decor"]';

const HEBREW = /[֐-׿]/;

/**
 * A word-boundary matcher for one name fragment.
 *
 * English fragments allow an English plural (`toy`→`toys`, `watch`→`watches`) and flexible
 * separators inside a phrase, so "Home & Living", "Home and Living" and "home-living" all
 * read the same. Critically, `\b` is what stops `pet` from matching `carpet` and `car` from
 * matching `care` — the whole class of bug this file exists to prevent.
 *
 * Hebrew needs its own boundary: JS `\b` is defined on `[A-Za-z0-9_]`, so `\bבית\b` matches
 * nothing at all. The Hebrew-block lookaround below is the equivalent.
 */
function fragmentRe(fragment: string): RegExp {
  const parts = fragment.trim().split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (HEBREW.test(fragment)) {
    const body = parts.join('[\\s&-]+');
    return new RegExp(`(?:^|[^\\u0590-\\u05FF])${body}(?:$|[^\\u0590-\\u05FF])`, 'i');
  }
  const body = parts.join('[\\s&-]*');
  return new RegExp(`\\b${body}(?:e?s)?\\b`, 'i');
}

/**
 * keyword → the labels whose list contains it. Built once from the table above.
 *
 * Read by pool-audit.ts to answer "which category does this saved keyword belong to". A
 * keyword in two lists ("jewelry organizer" is both beauty and jewellery) stays ambiguous
 * there rather than being resolved arbitrarily.
 */
export const KNOWN_POOL_KEYWORD_INDEX: ReadonlyMap<string, string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const pool of KNOWN_POOLS) {
    for (const k of pool.keywords) {
      const key = k.trim().toLowerCase();
      const labels = index.get(key);
      if (labels) { if (!labels.includes(pool.label)) labels.push(pool.label); }
      else index.set(key, [pool.label]);
    }
  }
  return index;
})();

/** Compiled once — this runs on every suggestion click. */
const COMPILED: Array<{ pool: KnownPool; res: Array<{ re: RegExp; len: number }> }> =
  KNOWN_POOLS.map((pool) => ({
    pool,
    res: pool.tokens.map((t) => ({ re: fragmentRe(t), len: t.length })),
  }));

export interface KnownPoolMatch {
  label: string;
  keywords: string[];
}

/**
 * The pool this system recognises in `name`, or null when the model should answer instead.
 *
 * "Or null" covers two cases, and the second one is the point: a name nothing matches, AND
 * a name where two different categories match equally well ("Beauty & Home Pool"). Guessing
 * between them would be a coin flip presented as a fact, and the cost of getting it wrong is
 * a month of bonus spent on the wrong category. One model call is cheaper.
 */
export function knownPoolKeywords(name: string): KnownPoolMatch | null {
  const n = String(name || '').trim();
  if (!n) return null;

  // Each entry scores by its LONGEST matching fragment: "home improvement" (16) beats a
  // "kitchen" (7) elsewhere in the name, so the specific reading wins over the incidental.
  const hits: Array<{ pool: KnownPool; score: number }> = [];
  for (const { pool, res } of COMPILED) {
    let score = 0;
    for (const { re, len } of res) if (len > score && re.test(n)) score = len;
    if (score) hits.push({ pool, score });
  }
  if (!hits.length) return null;

  hits.sort((a, b) => b.score - a.score);
  // A tie between two DIFFERENT categories is ambiguity, not a winner.
  if (hits.length > 1 && hits[1].score === hits[0].score) return null;

  return { label: hits[0].pool.label, keywords: [...hits[0].pool.keywords] };
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
