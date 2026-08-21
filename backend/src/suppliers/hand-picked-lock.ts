/**
 * A FLYLINK product the owner aimed at one group by hand must not be auto-published to a
 * different group by a campaign.
 *
 * The catalog is user-wide and every FLYLINK campaign rotates ALL of it, so an item picked
 * for one audience eventually surfaced in another campaign's group — a tactical holster
 * landing in the brands-for-moms group, which is not merely a repeat but the wrong shop.
 * The existing per-product `no_auto_post` switch prevents exactly this, but only if the
 * owner remembers to flip it on every item he ever hand-sends.
 *
 * So the intent is READ from what he already did: a manual post (no campaign_id) carries a
 * group he chose himself. Campaigns that don't publish to that group treat the product as
 * spoken for.
 */

/** One manual post's group targets — what the owner picked when he sent it by hand. */
export interface HandPick {
  productKey: string;
  channels: string[];
}

/**
 * Product keys this campaign must skip: those hand-sent ONLY to groups it does not target.
 *
 * A product hand-sent to a group the campaign DOES target is not locked — the campaign and
 * the owner agree on the audience there, and the existing per-group dedup already keeps it
 * from repeating too soon. The lock is about a different shop, not about frequency.
 */
export function handPickedElsewhere(picks: HandPick[], campaignTargets: string[]): Set<string> {
  const mine = new Set((campaignTargets || []).filter(Boolean));
  const locked = new Set<string>();
  const agreed = new Set<string>();

  for (const pick of picks || []) {
    const key = String(pick?.productKey || '').trim();
    if (!key) continue;
    const channels = (pick.channels || []).map((c) => String(c || '').trim()).filter(Boolean);
    if (!channels.length) continue; // default-channel send — no group intent to honour
    if (channels.some((c) => mine.has(c))) agreed.add(key);
    else locked.add(key);
  }

  // A product hand-sent to BOTH this campaign's group and another one stays available:
  // the owner already published it here himself, so the audience is not in question.
  for (const key of agreed) locked.delete(key);
  return locked;
}
