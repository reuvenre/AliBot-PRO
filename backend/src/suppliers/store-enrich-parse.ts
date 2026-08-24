import { normalizeCategory } from '../storefront/store-categories';

/**
 * Reading the enrichment agent's answer.
 *
 * The agent is asked for JSON and usually gives it, but "usually" is not a contract: the
 * answer arrives in a fenced block, with a sentence in front of it, with smart quotes, or
 * cut at the token budget. A parser that trusted the happy path would leave products
 * unnamed for reasons no one could see, so every failure here is a shrug — the field
 * comes back empty and the product keeps the name it already had.
 */

export interface Enrichment {
  /** The product's name in the shopper's language. */
  name: string;
  /** One of the fixed store categories, or '' when the agent named none of them. */
  category: string;
  /** The brand, or '' when the agent could not see one. */
  brand: string;
}

export const EMPTY_ENRICHMENT: Enrichment = { name: '', category: '', brand: '' };

/** How long a name may be before it stops fitting a card. */
export const NAME_LIMIT = 60;
export const BRAND_LIMIT = 30;

/** The first JSON object in a string, however it was wrapped. */
function firstJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, ' ');
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  // Scan for the matching brace rather than taking the last one: a trailing sentence
  // containing a brace would otherwise swallow the whole answer.
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function clean(value: unknown, limit: number): string {
  return String(value ?? '')
    .replace(/["'`״׳]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .trim();
}

/**
 * Words a model reaches for when it does not know, which must never become the answer.
 * "לא ידוע" printed as a brand on a product card is worse than no brand at all.
 */
const UNKNOWN_RE = /^(?:לא ידוע|לא זוהה|unknown|n\/?a|none|null|undefined|-)$/i;

export function parseEnrichment(raw: string): Enrichment {
  const obj = firstJsonObject(raw);
  if (!obj) return EMPTY_ENRICHMENT;

  const name = clean(obj.name ?? obj['שם'], NAME_LIMIT);
  const brand = clean(obj.brand ?? obj['מותג'], BRAND_LIMIT);

  return {
    name: UNKNOWN_RE.test(name) ? '' : name,
    // The category is matched against the fixed list, so an invented one lands as ''.
    category: normalizeCategory(obj.category ?? obj['קטגוריה']),
    brand: UNKNOWN_RE.test(brand) ? '' : brand,
  };
}

/** Did the agent produce anything worth writing down? */
export const hasAnything = (e: Enrichment): boolean => !!(e.name || e.category || e.brand);
