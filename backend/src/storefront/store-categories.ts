/**
 * The categories a shopper browses by.
 *
 * A FIXED list, not whatever a model invents per product. Free-form categories look fine
 * on one product and ruin the filter across a catalog: "נעליים", "נעל", "סניקרס" and
 * "הנעלה" become four menu entries holding a quarter of the shoes each, and no shopper
 * ever sees the whole shelf. The agent picks from this list or picks nothing.
 */

export const STORE_CATEGORIES = [
  'נעליים',
  'תיקים',
  'ארנקים',
  'שעונים',
  'תכשיטים',
  'משקפיים',
  'בשמים',
  'חולצות',
  'טי-שירטים',
  'ג\'קטים',
  'מעילים',
  'מכנסיים',
  'חצאיות',
  'שמלות',
  'סטים',
  'חליפות',
  'הלבשה תחתונה',
  'בגדי ים',
  'גרביים',
  'כובעים',
  'חגורות',
  'צעיפים',
  'כפפות',
  'מוצרי חשמל',
  'ציוד ספורט',
  'אביזרים',
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number];

/**
 * The list entry a model's answer refers to, or '' when it refers to none.
 *
 * Matching is forgiving about the ways an answer drifts — quotes, a definite article, a
 * trailing full stop, Latin transliteration — because rejecting a good answer over its
 * punctuation costs a real product its category. It is NOT forgiving about inventing:
 * an answer outside the list returns empty, and the product simply stays uncategorised
 * until someone decides.
 */
export function normalizeCategory(answer: unknown): string {
  const raw = String(answer ?? '')
    .replace(/["'`״׳.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return '';

  const candidates = [raw, raw.replace(/^ה/, '')];
  for (const candidate of candidates) {
    const hit = STORE_CATEGORIES.find((c) => c === candidate);
    if (hit) return hit;
  }
  // Same word, different spacing or hyphenation ("טי שירטים" for "טי-שירטים").
  const loose = (s: string) => s.replace(/[\s-]/g, '');
  for (const candidate of candidates) {
    const hit = STORE_CATEGORIES.find((c) => loose(c) === loose(candidate));
    if (hit) return hit;
  }
  return '';
}

/** The category list as the model is shown it. */
export const CATEGORY_LIST_PROMPT = STORE_CATEGORIES.join(' | ');
