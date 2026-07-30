/**
 * Learning from what people actually BOUGHT, rather than from what the autopilot posted.
 *
 * The obvious loop — "which of my posts led to orders" — is near-empty on a real account:
 * of 513 distinct products sold here, only 8 had ever been published by the autopilot. Orders
 * arrive through the owner's other traffic too, all credited to the same affiliate tracking
 * id, so per-post attribution sees ~2% of the truth and ranking keywords by it is noise.
 *
 * Aggregating one level up fixes that. A product id resolves to a real AliExpress CATEGORY,
 * and categories have enough orders behind them to rank. "Sold 9 items across Tools →
 * Multitools" is a signal; "post 1005009142104929 got one order" is not.
 *
 * The output is candidate KEYWORDS — category names as the affiliate search indexes them —
 * which is why nothing here invents wording: a category name is already a search term that
 * demonstrably returns products.
 */

/** One sold product, resolved to its category. */
export interface SoldProduct {
  productId: string;
  orders: number;
  commissionIls: number;
  category?: string | null;
  subcategory?: string | null;
}

/** A category ranked by what it actually sold. */
export interface CategoryScore {
  keyword: string;
  orders: number;
  commissionIls: number;
  products: number;
}

/** A category needs this many distinct products sold before it is more than a coincidence. */
const MIN_PRODUCTS = 2;
/** ...or this many orders, which lets a single repeatedly-bought product qualify. */
const MIN_ORDERS = 3;

/**
 * Rank the categories behind a set of sold products.
 *
 * The SUBcategory is preferred over the top-level one: "Multitools" finds the thing that
 * sold, while its parent "Tools" is broad enough to return anything. The parent is kept as a
 * fallback for products the feed only classified loosely.
 */
export function scoreCategories(sold: SoldProduct[]): CategoryScore[] {
  const byKeyword = new Map<string, CategoryScore>();

  for (const p of sold || []) {
    const keyword = (p.subcategory || p.category || '').trim();
    if (!keyword) continue;
    const cur = byKeyword.get(keyword)
      || { keyword, orders: 0, commissionIls: 0, products: 0 };
    cur.orders += Number(p.orders) || 0;
    cur.commissionIls += Number(p.commissionIls) || 0;
    cur.products += 1;
    byKeyword.set(keyword, cur);
  }

  return Array.from(byKeyword.values())
    .map((c) => ({ ...c, commissionIls: +c.commissionIls.toFixed(2) }))
    .filter((c) => c.products >= MIN_PRODUCTS || c.orders >= MIN_ORDERS)
    // Commission first — the point is earnings, not order count — then orders as a tie-break.
    .sort((a, b) => (b.commissionIls - a.commissionIls) || (b.orders - a.orders));
}

/**
 * Which ranked categories are worth ADDING to a campaign, in order.
 *
 * Excludes anything the campaign already searches (including a keyword it retired — the
 * optimizer put it there for a reason, and re-adding it would fight the owner's own history)
 * and caps how many arrive per run, because each new keyword changes what reaches a real
 * channel and a slow drip stays reviewable.
 */
export function newKeywordsFor(
  scored: CategoryScore[],
  campaignKeywords: string[],
  retiredKeywords: string[],
  max: number,
): CategoryScore[] {
  const known = new Set(
    [...(campaignKeywords || []), ...(retiredKeywords || [])]
      .map((k) => String(k || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const out: CategoryScore[] = [];
  for (const c of scored) {
    if (out.length >= max) break;
    if (known.has(c.keyword.toLowerCase())) continue;
    known.add(c.keyword.toLowerCase());
    out.push(c);
  }
  return out;
}
