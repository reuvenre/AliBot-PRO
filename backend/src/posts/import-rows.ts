/**
 * Importing the owner's OLD product file — a spreadsheet of hand-written copy.
 *
 * The file carries, per product: a Hebrew name, up to three hand-written benefit lines,
 * an optional search keyword, and a shortened AliExpress affiliate link. That copy was
 * written by the owner for these exact products — so the import composes the post FROM IT
 * (the classic 🔥/✔️ template) instead of burning AI credits rewriting it. Price/image are
 * enriched from the affiliate API when the short link resolves to a product id.
 */

export interface ImportRowInput {
  keyword?: string;
  title: string;
  benefits: string[];
  link: string;
}

/** A usable row needs a name and an http(s) link — anything less can't become a post. */
export function validImportRow(r: any): r is ImportRowInput {
  return !!r
    && typeof r.title === 'string' && !!r.title.trim()
    && typeof r.link === 'string' && /^https?:\/\//i.test(r.link.trim());
}

/**
 * The post body, composed from the file's own copy in the classic template:
 *
 *     🔥 {name}
 *
 *     ✔️ benefit
 *     ✔️ benefit
 *
 *     💥 מחיר מבצע: ₪X בלבד!
 *     מהרו לפני שנגמר ←
 *
 * The price line appears only when the API actually resolved a price — a made-up number
 * must never reach a channel. The affiliate link is NOT embedded here: the send pipeline
 * attaches the tracked short link in the standard 🔗 form.
 */
export function composeImportText(row: ImportRowInput, priceIls?: number | null): string {
  const lines: string[] = [`🔥 ${row.title.trim()}`];
  const benefits = (row.benefits || []).map((b) => String(b || '').trim()).filter(Boolean);
  if (benefits.length) {
    lines.push('');
    for (const b of benefits) lines.push(`✔️ ${b}`);
  }
  if (priceIls && priceIls > 0) {
    lines.push('');
    lines.push(`💥 מחיר מבצע: ₪${priceIls} בלבד!`);
  }
  lines.push('מהרו לפני שנגמר ←');
  return lines.join('\n');
}

/**
 * The numeric AliExpress product id inside a (resolved) URL, or null.
 *
 * Redirect hops often carry the real item URL percent-encoded inside a query param
 * (star.aliexpress.com/share/share.htm?...&redirectUrl=https%3A%2F%2F...%2Fitem%2F100500....html),
 * so the decoded form is scanned too — without it the whole short-link chain "resolves"
 * to nothing and every imported row stays image-less.
 */
export function extractAliProductId(url: string): string | null {
  const s = String(url || '');
  const candidates = [s];
  try {
    const decoded = decodeURIComponent(s);
    if (decoded !== s) candidates.push(decoded);
  } catch { /* malformed % sequence — raw form only */ }
  for (const c of candidates) {
    const item = c.match(/\/item\/(?:[^/]*\/)?(\d{6,})(?:\.html|\b)/i);
    if (item) return item[1];
    const param = c.match(/[?&](?:productId|productIds|itemId)=(\d{6,})/i);
    if (param) return param[1];
  }
  return null;
}

/**
 * The product id inside an HTML page body. The last hop of an AliExpress short link is
 * frequently a page that redirects via JavaScript (no Location header) — the item URL
 * is only present in the markup, raw or percent-encoded.
 */
export function extractAliProductIdFromHtml(html: string): string | null {
  const s = String(html || '');
  const item = s.match(/\/item\/(?:[^/"'\\\s]*\/)?(\d{6,})(?:\.html)?/i);
  if (item) return item[1];
  const encoded = s.match(/%2Fitem%2F(?:[^"'\\\s&]*%2F)?(\d{6,})/i);
  if (encoded) return encoded[1];
  const prop = s.match(/["']?(?:productId|itemId)["']?\s*[:=]\s*["']?(\d{6,})/i);
  if (prop) return prop[1];
  return null;
}
