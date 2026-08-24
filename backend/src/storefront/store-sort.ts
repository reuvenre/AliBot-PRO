/**
 * How the shelf is ordered, and where the price slider's ends sit.
 *
 * Both are pure so the wrong-order bugs are catchable without a database: a store that
 * sorts "cheapest first" and shows the most expensive product at the top is the kind of
 * thing a shopper notices immediately and an author never does.
 */

import type { StoreProduct } from './storefront.service';

/** The orderings the store offers, in the order the panel lists them. */
export const SORTS = ['newest', 'oldest', 'price_asc', 'price_desc'] as const;
export type Sort = typeof SORTS[number];

export const DEFAULT_SORT: Sort = 'newest';

export function normalizeSort(value: unknown): Sort {
  const v = String(value || '').trim();
  return (SORTS as readonly string[]).includes(v) ? (v as Sort) : DEFAULT_SORT;
}

/**
 * A comparator for the chosen ordering.
 *
 * Undated products sort LAST under both date orderings rather than winning "oldest" —
 * a supplier row that has never been posted has no date, and letting absence mean
 * "ancient" would park the newest, unpublished half of a catalog at the front of the
 * oldest-first list.
 */
export function sorter(sort?: unknown): (a: StoreProduct, b: StoreProduct) => number {
  const mode = normalizeSort(sort);
  return (a, b) => {
    switch (mode) {
      case 'price_asc': return a.price - b.price;
      case 'price_desc': return b.price - a.price;
      case 'oldest': {
        if (!a.at && !b.at) return 0;
        if (!a.at) return 1;
        if (!b.at) return -1;
        return a.at.localeCompare(b.at);
      }
      default: {
        if (!a.at && !b.at) return 0;
        if (!a.at) return 1;
        if (!b.at) return -1;
        return b.at.localeCompare(a.at);
      }
    }
  };
}

/**
 * The lowest and highest price in the catalog, rounded OUTWARD to whole units.
 *
 * Rounding inward would put the cheapest product outside its own slider — the shopper
 * drags to the floor and the item that defined the floor disappears.
 */
export function priceBounds(products: Array<{ price: number }>): { min: number; max: number } {
  const prices = products.map((p) => Number(p.price) || 0).filter((n) => n > 0);
  if (!prices.length) return { min: 0, max: 0 };
  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  };
}
