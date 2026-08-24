/**
 * A product's name as a shopper should read it.
 *
 * Neither catalog stores one. A Yupoo album is titled the way the seller files it —
 * `6380-42.66-LHYF-High quality pure cotton solid color long-sleeved shirt`, where the
 * first number is a stock code and the second is the wholesale price. An AliExpress
 * title is written for AliExpress's own search box: a hundred and twenty characters of
 * every phrase a buyer might type, separated by commas.
 *
 * Both are correct as identifiers and unreadable as names, so a store card showed a code
 * or a paragraph. This turns them into something a person recognises, deterministically —
 * no model call, so a catalog of two thousand products costs nothing to render and the
 * same product is never named two different things on two page loads.
 */

/** How long a card's name may be before it is cut on a word boundary. */
export const NAME_MAX = 52;

/**
 * A price that rode along in the title, on either side of its symbol.
 *
 * Sellers write both — `$60` and `79.9$` — and the trailing form is the common one in
 * this catalog, so a pattern that only knew the leading one left "Rolex--6128-79.9$" on
 * a product card.
 */
const PRICE_RE = new RegExp(
  '(?:^|[\\s\\-_[({])'
  + '(?:'
  + '[$₪€£]\\s?\\d{1,6}(?:[.,]\\d{1,2})?'   // $60, ₪129.28
  + '|\\d{1,6}(?:[.,]\\d{1,2})?\\s?[$₪€£]'  // 79.9$, 60 ₪
  + '|\\d{1,6}[.,]\\d{2}'                   // 42.66 — two decimals is a price, not a model
  + ')(?=$|[\\s\\-_\\])}])',
  'g',
);

/** `size:36-45`, `Size 36-45`, `尺码36-45` — a variant hint, not part of the name. */
const SIZE_RE = /\b(?:size|sizes|尺码|码)\s*[:：]?\s*\d{1,3}\s*[-–]\s*\d{1,3}\b/gi;

/** A stock code: letters then digits, digits then letters, or a bare long digit run. */
const CODE_RE = /^(?:[A-Za-z]{1,6}[-_]?\d{3,}[A-Za-z0-9]*|\d{3,}[-_]?[A-Za-z]{0,6})$/;

/** Marketing noise AliExpress titles open or close with. */
const NOISE_RE = /\b(?:free\s+shipping|hot\s+sale|new\s+arrival|drop\s?shipping|wholesale|high\s+quality|2\d{3}\s+new)\b/gi;

/** Segment separators used by both catalogs. */
const SPLIT_RE = /[,，|/·•]+|\s[-–—]\s/;

/**
 * The shape a FLYLINK/Yupoo title actually arrives in: `CODE-PRICE-REST`, hyphen-joined
 * with no spaces — `6380-42.66-LHYF-High quality…`. Handled as one prefix rather than by
 * the generic price and code strippers, which each see only their own half and leave the
 * hyphens and the orphaned code behind.
 */
const LEAD_CODE_PRICE_RE = /^\s*[A-Za-z0-9]{2,15}(?:[-_][A-Za-z0-9]{1,8})?[-_]\d{1,6}[.,]\d{1,2}[-_](.+)$/;

function tidy(text: string): string {
  return text
    .replace(/[\s_]+/g, ' ')
    .replace(/\s*[-–—]\s*$/g, '')
    .replace(/^\s*[-–—]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Is this token a stock code rather than a word? */
export function isCodeToken(token: string): boolean {
  const t = token.replace(/[^A-Za-z0-9-_]/g, '');
  if (!t) return false;
  // A word with no digit is a word, however odd it looks.
  if (!/\d/.test(t)) return false;
  // A model number a shopper actually says out loud — "9060", "Air Max 90" — is short.
  if (/^\d{1,4}$/.test(t)) return false;
  return CODE_RE.test(t);
}

/**
 * The readable name inside a raw catalog title.
 *
 * `brand` is passed so it can be dropped from the name: the card prints it on its own
 * line above, and "COACH COACH shoulder bag" is what happens when it isn't.
 */
export function productDisplayName(raw: string, brand?: string | null, max = NAME_MAX): string {
  const source = String(raw || '');
  if (!source.trim()) return '';

  // The `CODE-PRICE-…` prefix goes first and whole; what follows is the actual title.
  let text = source.replace(LEAD_CODE_PRICE_RE, '$1')
    // A RUN of dashes is punctuation the seller used as a separator ("Rolex--6128"), so
    // it becomes a space. A SINGLE hyphen between letters is part of a word and stays —
    // "long-sleeved" must survive this.
    .replace(/[-–—]{2,}/g, ' ');

  // The brand often opens that remainder, hyphen-joined to the first word ("LHYF-High
  // quality…"). Strip it here, where it is still anchored — once the hyphen is gone it is
  // just another word and can no longer be told from part of the name.
  const brandName = String(brand || '').trim();
  if (brandName) {
    const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^\\s*${escaped}[-_\\s]+`, 'i'), '');
  }

  // Strip the things that are never part of a name, before splitting — a price or a size
  // range contains separators of its own and would otherwise fragment the title.
  text = text.replace(SIZE_RE, ' ').replace(PRICE_RE, ' ').replace(NOISE_RE, ' ');

  // Keep the LONGEST segment: an AliExpress title's first comma-separated chunk is often
  // a bare keyword ("2 Pcs"), while the real description sits further along.
  const segments = text.split(SPLIT_RE).map(tidy).filter(Boolean);
  if (segments.length > 1) {
    const worded = segments.filter((s) => s.split(' ').some((w) => !isCodeToken(w) && /[A-Za-z֐-׿一-鿿]/.test(w)));
    text = (worded.length ? worded : segments).sort((a, b) => b.length - a.length)[0];
  } else {
    text = segments[0] || '';
  }

  const brandWords = brandName.toLowerCase().split(/\s+/).filter(Boolean);
  const words = tidy(text).split(' ').filter((w) => {
    if (!w) return false;
    if (isCodeToken(w)) return false;
    // The brand is printed on its own line; repeating it here is noise.
    return !brandWords.includes(w.toLowerCase().replace(/[^\w֐-׿]/g, ''));
  });

  const name = tidy(words.join(' '));
  if (!name) return '';

  if (name.length <= max) return name;
  // Cut on a word boundary when one is close enough to the limit; a name chopped
  // mid-word reads as broken, and the ellipsis is what tells the reader it was cut.
  const cut = name.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

/**
 * A brand label fit to stand in a filter list.
 *
 * The supplier catalog's brand is whatever was left of the album title after the code was
 * taken out, so it arrives carrying the wreckage: `POLO- -5349`, `CHANEL $`, `Rolex-- -6128`,
 * `alo-Top-tier ALO Set-`. As a label under a product that is untidy; as a FILTER it is
 * worse than untidy, because every one of those is a separate entry and the shopper gets
 * a menu of forty near-duplicates instead of a list of brands.
 */
export function brandDisplayName(raw: string | null | undefined): string {
  let text = String(raw || '')
    .replace(/\*+/g, ' ')                      // **LUN1478 HMS** — emphasis from the album title
    .replace(SIZE_RE, ' ')
    .replace(PRICE_RE, ' ')
    .replace(/[$₪€£]/g, ' ')
    .replace(/[-–—_]+/g, ' ');                 // POLO- -5349 → POLO 5349

  // Anything past the brand itself — a code, a model, a leftover word like "Set" — is not
  // part of the name a shopper filters by.
  const words: string[] = [];
  for (const word of tidy(text).split(' ')) {
    if (!word) continue;
    if (/\d/.test(word)) break;                // the first number ends the brand
    if (words.length >= 3) break;              // "Polo Ralph Lauren" is as long as brands get
    words.push(word);
  }
  text = tidy(words.join(' '));
  // A one-letter remnant ("א" off a truncated Hebrew title) is not a brand.
  return text.length >= 2 ? text : '';
}

/** Case-insensitive identity, so `CHANEL` and `Chanel` are one filter and not two. */
export const brandKey = (name: string): string => brandDisplayName(name).toLowerCase();

/**
 * The name a card actually shows, with the fallbacks that keep a card from being blank.
 *
 * A Yupoo album titled with nothing but its code — `MM-2642001DP`, the common case in a
 * hidden-brand catalog — has no readable name to find. The brand alone beats printing
 * the code, and the code beats printing nothing at all.
 */
export function storeCardName(raw: string, brand?: string | null, max = NAME_MAX): string {
  const name = productDisplayName(raw, brand, max);
  if (name) return name;
  const b = String(brand || '').trim();
  if (b) return b;
  return tidy(String(raw || '')).slice(0, max) || 'מוצר';
}
