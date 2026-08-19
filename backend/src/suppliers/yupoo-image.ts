/**
 * De-duplicating a Yupoo product gallery.
 *
 * A Yupoo album page renders the SAME photo several times at different sizes — the album
 * URL is `photo.yupoo.com/{store}/{photoId}/{size}.jpg`, where only the last segment
 * changes (small / medium / big / square / thumb / original). The scraper collected every
 * <img> it saw and de-duplicated by exact URL, so one photo entered the catalog two or
 * three times. The owner then saw a gallery of duplicates — and the low-res variants,
 * blown up to post size, looked blurry next to their sharp twins.
 *
 * The identity of a photo is its DIRECTORY (store + photo id); the filename is just the
 * rendition. So: group by identity, keep the sharpest rendition of each, preserve first-
 * appearance order (the album's own order, which the owner curates).
 */

/** Renditions, best first. Unknown names sort between medium and small — a size we don't
 *  recognise is more likely a real variant than a thumbnail, but never beats `big`. */
const SIZE_RANK: Record<string, number> = {
  original: 100, orig: 95, big: 90, large: 85, medium: 70, small: 40, square: 30, thumb: 20,
};
const UNKNOWN_RANK = 60;

/**
 * Unwrap our own hotlink proxy (`…/suppliers/image?url=<encoded photo url>`) — the UI works
 * in proxied URLs, so they are what a manual selection sends back. Identity and rank must
 * see the PHOTO underneath: splitting a proxied URL on '?' throws the photo away, which
 * collapsed every image of an album to ONE key — so whatever the owner picked, the saved
 * gallery came out as a single (arbitrary) image ("התמונות שבחרתי לא נשמרו").
 */
export function unwrapImageProxy(url: string): string {
  const raw = String(url || '').trim();
  if (!/\/suppliers\/image\?/i.test(raw)) return raw;
  const m = raw.match(/[?&]url=([^&#]+)/i);
  if (!m) return raw;
  try { return decodeURIComponent(m[1]); } catch { return raw; }
}

/** `https://photo.yupoo.com/store/abc123/big.jpg?x=1` → `photo.yupoo.com/store/abc123`. */
export function yupooPhotoKey(url: string): string {
  const raw = unwrapImageProxy(url);
  if (!raw) return '';
  if (!/photo\.yupoo\.com/i.test(raw)) return raw; // non-Yupoo → identity is the URL itself
  const noQuery = raw.split(/[?#]/)[0];
  const withoutScheme = noQuery.replace(/^https?:\/\//i, '');
  const slash = withoutScheme.lastIndexOf('/');
  return (slash > 0 ? withoutScheme.slice(0, slash) : withoutScheme).toLowerCase();
}

/** How sharp this rendition is — higher wins. Non-Yupoo URLs all rank equal. */
export function yupooSizeRank(url: string): number {
  const file = unwrapImageProxy(url).split(/[?#]/)[0].split('/').pop() || '';
  const name = file.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  return SIZE_RANK[name] ?? UNKNOWN_RANK;
}

/**
 * One entry per real photo, sharpest rendition of each, in first-appearance order.
 * Safe on already-clean galleries and on non-Yupoo URLs (exact-duplicate removal only).
 */
export function dedupeProductImages(urls: Array<string | null | undefined>): string[] {
  const bestByKey = new Map<string, { url: string; rank: number; order: number }>();
  let order = 0;
  for (const raw of urls || []) {
    const url = String(raw || '').trim();
    if (!url) continue;
    const key = yupooPhotoKey(url);
    const rank = yupooSizeRank(url);
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, { url, rank, order: order++ });
    } else if (rank > existing.rank) {
      // Keep the sharper rendition — but at the ORIGINAL position, so the album's order
      // (and therefore the cover) is not reshuffled by which size happened to load first.
      bestByKey.set(key, { url, rank, order: existing.order });
    }
  }
  return Array.from(bestByKey.values())
    .sort((a, b) => a.order - b.order)
    .map((e) => e.url);
}
