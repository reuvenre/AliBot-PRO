/**
 * Which image leads a FLYLINK gallery when the owner didn't hand-pick one.
 *
 * A Yupoo fashion album routinely OPENS with a size chart or color-code sheet, not the
 * product. That order was published as-is by the campaign's fresh-post path — and since
 * Facebook posts exactly ONE photo (gallery[0]), a group got a Height/Weight table as the
 * ad image (observed on מאמא, 06/08). The catalog COVER (product.image_url) is the curated
 * product shot — it's what the owner sees on the product card — so when there is no manual
 * selection, it leads and the album follows.
 *
 * An explicit owner selection never passes through here: their first pick IS the cover.
 */
export function coverFirst(gallery: string[], cover: string, max = 10): string[] {
  const full = (gallery || []).filter((u) => typeof u === 'string' && !!u);
  const lead = (cover || '').trim();
  const ordered = lead ? [lead, ...full.filter((u) => u !== lead)] : full;
  return ordered.slice(0, max);
}
