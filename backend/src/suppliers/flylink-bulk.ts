/**
 * Reading a batch of FLYLINK links the owner pasted in one go.
 *
 * FLYLINK has no search API and its affiliate links are opaque per-product tokens
 * (`https://s.flylinking.com/g-XKBRBNHMUD` — a fixed prefix and ten random characters,
 * carrying nothing about the product). Nothing can generate one, so a human generates
 * each on FLYLINK's site. What CAN be removed is the round trip after that: linking a
 * hundred products meant a hundred passes through a form, one album and one link at a
 * time.
 *
 * So this accepts whatever shape the copy-paste arrives in. People paste a column of
 * links, or a code and a link per line, or a two-column selection out of a table — the
 * order of the two varies, the separator varies, and stray text rides along. Rejecting a
 * batch over its formatting would defeat the point of the batch.
 *
 * A line with no code is legitimate: the importer resolves the link server-side and reads
 * the code off the destination. The code here is only what the owner ALREADY typed.
 */

export interface BulkEntry {
  /** The affiliate link. */
  url: string;
  /** The product code beside it, when the paste carried one. */
  code: string;
  /** 1-based line number in the pasted text — so a failure names the line he can see. */
  line: number;
}

export interface BulkParse {
  entries: BulkEntry[];
  /** Lines that carried no link at all, for a "3 lines were skipped" note. */
  skipped: number[];
  /** Links that appeared more than once — kept once, reported so the count adds up. */
  duplicates: number;
}

/** Any http(s) URL in a line. */
const URL_RE = /https?:\/\/[^\s,;'"<>()\]]+/i;

/**
 * A product code: letters then digits, optionally hyphenated (MM-2642001DP, AP12681).
 * Deliberately strict about the digits — a bare word like "COACH" is a brand, not a code,
 * and guessing one would silently link a link to the wrong album.
 */
const CODE_RE = /\b([A-Za-z]{1,6}[-_]?\d{3,}[A-Za-z0-9-]*)\b/;

/** Trailing punctuation a paste drags along ("…MUD," / "…MUD)."). */
function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:'"’”)\]}]+$/, '');
}

export function parseBulkLinks(text: string): BulkParse {
  const entries: BulkEntry[] = [];
  const skipped: number[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;                    // blank lines are formatting, not failures

    const urlMatch = trimmed.match(URL_RE);
    if (!urlMatch) { skipped.push(line); return; }

    const url = cleanUrl(urlMatch[0]);
    // The code is looked for in what is left AFTER removing the URL — otherwise the random
    // token in the link itself ("g-XKBRBNHMUD") reads as a product code.
    const rest = trimmed.replace(urlMatch[0], ' ');
    const code = rest.match(CODE_RE)?.[1] || '';

    const key = url.toLowerCase();
    if (seen.has(key)) { duplicates += 1; return; }
    seen.add(key);

    entries.push({ url, code, line });
  });

  return { entries, skipped, duplicates };
}

/**
 * The product code hiding in a resolved FLYLINK destination URL.
 *
 * The SHORT link carries nothing, but the page it redirects to is a real product URL, and
 * whatever identifies the product there is what lets a bare list of links be matched to
 * albums with no typing at all. Path segments are searched before query values: a query
 * string is mostly tracking parameters, and a campaign id shaped like a code would win a
 * whole-string search.
 */
export function codeFromResolvedUrl(url: string): string {
  if (!url) return '';
  let parsed: URL;
  try { parsed = new URL(url); } catch { return ''; }

  for (const seg of parsed.pathname.split('/').reverse()) {
    const decoded = decodeURIComponent(seg);
    // The shortener's own token would match CODE_RE's shape on some stores; never read a
    // code off the short link itself.
    if (/^g-[A-Z0-9]{6,}$/i.test(decoded)) continue;
    const hit = decoded.match(CODE_RE)?.[1];
    if (hit) return hit;
  }
  // Explicit product parameters only — never a blind sweep of the query string.
  for (const key of ['code', 'sku', 'product', 'productCode', 'product_code', 'itemCode', 'spu']) {
    const v = parsed.searchParams.get(key);
    const hit = v?.match(CODE_RE)?.[1];
    if (hit) return hit;
  }
  return '';
}
