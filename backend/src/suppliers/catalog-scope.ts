/**
 * Which supplier catalogs a FLYLINK campaign is allowed to rotate.
 *
 * A catalog carries a "קבוצה מקושרת" (`target_channel_id`) — the group its products belong
 * to. That field was read only by MANUAL sends from the catalog screen; the autopilot
 * ignored it and rotated every product the account owns, from every catalog at once.
 *
 * So the tactical campaign took brand items off the mama catalog, published them to the
 * tactical group, and the per-group dedup then locked the mama campaign out of the very
 * products it existed to publish. Whichever cron fired first won the item.
 *
 * A linked catalog has DECLARED whose shelf it is, and the autopilot has to honour that the
 * same way a manual send does. A catalog with no link has declared nothing and stays open to
 * every campaign — so an account that never linked one behaves exactly as it did before.
 */

export interface ScopedCatalog {
  id: string;
  target_channel_id?: string | null;
}

/**
 * Catalog ids this campaign may draw from, given the groups it publishes to.
 *
 * Returns [] only when every catalog is linked to a group this campaign does not publish
 * to — a real state worth naming out loud (the campaign has no shelf), never a silent
 * fallback to "then take anything".
 */
export function catalogsForCampaign(catalogs: ScopedCatalog[], targets: string[]): string[] {
  const mine = new Set((targets || []).map((t) => String(t || '').trim()).filter(Boolean));
  return (catalogs || [])
    .filter((c) => {
      const linked = String(c?.target_channel_id || '').trim();
      return !linked || mine.has(linked);
    })
    .map((c) => String(c.id));
}
