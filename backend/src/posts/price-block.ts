/**
 * The price + social-proof block, built from DB facts instead of asked of the model.
 *
 * Rendering numbers was the copywriter model's weakest job and its most expensive to get
 * wrong: it produced posts with an unfilled "[מחיר]₪ בלבד", and it was handed the original
 * price, discount, rating and order count on every call yet the templates used none of them
 * — every post said "69₪ בלבד" with nothing to anchor it against.
 *
 * Numbers are pure data, so they are formatted here, deterministically, and appended to
 * whatever copy the model wrote. The model's job shrinks to the hook and the benefit lines.
 *
 * Markup is the Telegram parse_mode=HTML subset (<b>, <s>) that sendToTelegramChannel
 * whitelists — matching what defaultText already emits.
 */

/** Below this, an "instead of" anchor is noise rather than a saving worth naming. */
const MIN_ANCHOR_DISCOUNT = 15;
/** Below this, an order count undermines the product instead of vouching for it. */
const MIN_ORDERS_TO_SHOW = 50;
/** A rating this low is not proof — leave it out rather than argue against ourselves. */
const MIN_RATING_TO_SHOW = 3.9;

export interface PriceFacts {
  symbol: string;
  /** Already converted + formatted for display (integer string, as generateText builds it). */
  priceLocal: string;
  originalLocal: string;
  discount: number;
  rating?: number | null;
  ordersCount?: number | null;
  language: string;
}

const WORDS = {
  he: { instead: 'במקום', saves: 'חוסך', bought: 'קנו' },
  ar: { instead: 'بدلاً من', saves: 'توفير', bought: 'شاروا' },
  en: { instead: 'was', saves: 'save', bought: 'bought' },
};

function words(language: string) {
  return WORDS[language as keyof typeof WORDS] || WORDS.en;
}

/** "1.2K" once the count is big enough to round, otherwise the exact figure. */
export function formatOrders(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
}

/** The price line: an anchored saving when there is a real one, else just the price. */
export function priceLine(f: PriceFacts): string {
  const w = words(f.language);
  const price = `<b>${f.symbol}${f.priceLocal}</b>`;
  const original = Number(f.originalLocal);
  const sale = Number(f.priceLocal);
  const anchored = f.discount >= MIN_ANCHOR_DISCOUNT
    && Number.isFinite(original) && Number.isFinite(sale) && original > sale;

  return anchored
    ? `💰 ${price} ${w.instead} <s>${f.symbol}${f.originalLocal}</s> · ${w.saves} ${f.discount}%`
    : `💰 ${price}`;
}

/** The proof line, or '' when neither figure is strong enough to help. */
export function proofLine(f: PriceFacts): string {
  const w = words(f.language);
  const parts: string[] = [];
  const rating = Number(f.rating) || 0;
  const orders = Number(f.ordersCount) || 0;
  if (rating >= MIN_RATING_TO_SHOW) parts.push(`⭐ ${rating.toFixed(1)}`);
  if (orders >= MIN_ORDERS_TO_SHOW) parts.push(`🛒 ${formatOrders(orders)} ${w.bought}`);
  return parts.join(' · ');
}

/** The full block appended under the model's copy. */
export function priceProofBlock(f: PriceFacts): string {
  return [priceLine(f), proofLine(f)].filter(Boolean).join('\n');
}

/**
 * Does this copy already state the price itself?
 *
 * Templates are owner-editable rows in the DB, and the existing ones print the price in
 * their own fixed line. Appending the block unconditionally would show it twice, so the
 * block is added only when the copy left the price out — which lets the owner migrate a
 * template just by deleting its price line, with no code change and no flag.
 */
export function mentionsPrice(text: string, symbol: string, priceLocal: string): boolean {
  const t = text || '';
  if (!t) return false;
  // The exact figure, with or without the symbol attached ("69₪" and "₪69" both count).
  if (priceLocal && new RegExp(`\\b${escapeRegex(priceLocal)}\\s*${escapeRegex(symbol)}`).test(t)) return true;
  if (priceLocal && new RegExp(`${escapeRegex(symbol)}\\s*${escapeRegex(priceLocal)}\\b`).test(t)) return true;
  // Any currency symbol glued to digits — covers a template that rounded differently.
  return new RegExp(`${escapeRegex(symbol)}\\s*\\d`).test(t) || new RegExp(`\\d\\s*${escapeRegex(symbol)}`).test(t);
}

function escapeRegex(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
