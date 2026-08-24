/**
 * The line that invites a follower from one post into the whole catalog.
 *
 * A post is a single product in a river of them. The store is the shelf, and this line is
 * the only bridge between the two — so it has to survive being appended to thousands of
 * posts without ever reading like a sixth call to action bolted on the end.
 *
 * Kept deliberately plain and short. The post already carries a price block, a buy link,
 * sometimes a trust block and a coupon; another loud banner competes with the one thing
 * the post is actually for, which is the product.
 */

/**
 * Marks a body that already carries the line, so a verbatim repost — or a queued post
 * passing through the composer a second time — never stacks two of them.
 */
export const STORE_LINE_MARK = '🛍️';

export interface StoreLineInput {
  /** The store's public address. */
  url: string;
  /** The store's name, as the owner set it. */
  name?: string | null;
  /** Hebrew body (the default) or an English one. */
  hebrew?: boolean;
}

export function storeLine({ url, name, hebrew = true }: StoreLineInput): string {
  const clean = (url || '').trim();
  if (!clean) return '';
  const shop = (name || '').trim();
  return hebrew
    ? `${STORE_LINE_MARK} כל המוצרים שלנו במקום אחד${shop ? ` — ${shop}` : ''}:\n${clean}`
    : `${STORE_LINE_MARK} All our products in one place${shop ? ` — ${shop}` : ''}:\n${clean}`;
}

/** Does this body already carry a store line? */
export function hasStoreLine(body: string, url: string): boolean {
  const text = String(body || '');
  const clean = (url || '').trim();
  // Either marker is enough: the emoji catches a line whose address was since renamed,
  // and the address catches a line pasted by hand into a template without the emoji.
  return text.includes(STORE_LINE_MARK) || (!!clean && text.includes(clean));
}
