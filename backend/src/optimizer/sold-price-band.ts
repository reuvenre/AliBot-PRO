/**
 * The account's PROVEN price band — what its buyers actually pay.
 *
 * Categories already feed the keyword rotation (order-learning.ts); price is the other
 * strong axis of "what sells here". Every attributed order carries its amount, so the band
 * where most purchases land is directly measurable — and a candidate product inside that
 * band is a better bet than an equally-shiny one far outside it.
 *
 * Used as a PREFERENCE, never a filter: in-band products are ranked first, out-of-band
 * ones still follow (exploration must survive, and a thin day must not go silent because
 * nothing matched the band).
 */

export interface PriceBand {
  /** USD bounds most purchases fall between (p20–p80 of order amounts). */
  low: number;
  high: number;
  median: number;
  /** How many orders the band is based on. */
  orders: number;
}

/** Below this many orders in the window there is no band — a handful of purchases is
 *  taste, not proof. */
export const MIN_ORDERS_FOR_BAND = 10;

/** The percentile band kept: wide enough to cover most real purchases, tight enough to
 *  mean something. */
const P_LOW = 0.2;
const P_HIGH = 0.8;

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/** The proven band, or null when the data is too thin to claim one. */
export function soldPriceBand(amountsUsd: Array<number | string | null>): PriceBand | null {
  const amounts = (amountsUsd || [])
    .map((a) => Number(a))
    .filter((a) => Number.isFinite(a) && a > 0)
    .sort((a, b) => a - b);
  if (amounts.length < MIN_ORDERS_FOR_BAND) return null;
  return {
    low: +percentile(amounts, P_LOW).toFixed(2),
    high: +percentile(amounts, P_HIGH).toFixed(2),
    median: +percentile(amounts, 0.5).toFixed(2),
    orders: amounts.length,
  };
}

/** Is this price inside the band, with a small tolerance so edge prices aren't penalized
 *  for a few cents? */
export function inBand(priceUsd: number, band: PriceBand): boolean {
  const p = Number(priceUsd);
  if (!Number.isFinite(p) || p <= 0) return false;
  return p >= band.low * 0.9 && p <= band.high * 1.1;
}

/**
 * Stable partition: in-band products first, everything else after — RELATIVE ORDER
 * PRESERVED within each part, so the upstream ranking (best-sellers, tier logic) still
 * decides among equals and nothing is ever dropped.
 */
export function preferInBand<T>(products: T[], priceOf: (p: T) => number, band: PriceBand | null): T[] {
  if (!band) return products;
  const inside: T[] = [];
  const outside: T[] = [];
  for (const p of products || []) (inBand(priceOf(p), band) ? inside : outside).push(p);
  return [...inside, ...outside];
}
