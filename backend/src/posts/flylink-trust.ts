/**
 * The FLYLINK trust trailer — the fixed block that answers the question every follower
 * silently asks before clicking a hidden-product link: "מה באמת יגיע לי?".
 *
 * Replica shoppers hesitate for trust reasons, not interest reasons. The two facts that
 * actually reassure are already true — the Yupoo photos ARE the warehouse photos of the
 * exact item, and the seller answers questions in the group — so this block states them
 * on every FLYLINK post, built in CODE like the price/proof block: fixed wording that can
 * never over-promise, drift, or get "improved" into a claim we can't stand behind.
 *
 * Deliberately absent: delivery-time promises (we don't control logistics), "identical to
 * the original" (an expectation no replica should be sold on), and brand-authenticity
 * claims of any kind. Honest framing converts BETTER here: a buyer who expected a good
 * replica and got one recommends the group; a buyer promised the world is a refund.
 *
 * Appended at SEND time (buildPostBody), not stored in generated_text — so old queued
 * posts and verbatim re-posts pick it up too, and a wording tweak here reaches the whole
 * catalog at once.
 */

/** FLYLINK posts are identified by their link, same as the coupon filter does. */
export function isFlylinkPost(affiliateUrl: string | null | undefined): boolean {
  return /flylink/i.test(String(affiliateUrl || ''));
}

/** First line doubles as the dedup marker in buildPostBody — keep it stable. */
export const FLYLINK_TRUST_MARK = '📸 מהמפעל ישירות לצרכן';

/** Where a post is going. Decides whether the replica line rides along. */
export type PostPlatform = 'telegram' | 'whatsapp' | 'facebook' | 'instagram' | 'pinterest';

/**
 * The owner's own wording. Says the thing out loud rather than letting a buyer discover
 * it after payment — the single biggest source of "this isn't what I ordered".
 */
export const FLYLINK_REPLICA_LINE = '🏷️ המוצר הינו רפליקה של המקור באיכות גבוהה';

/**
 * Which platforms carry the replica line.
 *
 * Only the owner's own group channels. Meta and Pinterest prohibit counterfeit and
 * replica goods outright, and a post that says "רפליקה" in plain Hebrew is the easiest
 * possible match for their automated enforcement — the line meant to protect the buyer
 * would be the thing that costs him the page. Unknown platform is treated as one of
 * those: the safe answer when we cannot tell where a post is going.
 */
const REPLICA_PLATFORMS = new Set<PostPlatform>(['telegram', 'whatsapp']);

export function showsReplicaLine(platform?: PostPlatform): boolean {
  return !!platform && REPLICA_PLATFORMS.has(platform);
}

/** The owner's wording (19.08) — questions go to DM. */
export function flylinkTrustBlock(platform?: PostPlatform): string {
  return [
    `${FLYLINK_TRUST_MARK} — מה שרואים בתמונות זה מה שמגיע`,
    // Right after the photo promise and before logistics: this is where a buyer decides
    // what he is actually buying.
    ...(showsReplicaLine(platform) ? [FLYLINK_REPLICA_LINE] : []),
    '📦 קבלת מספר מעקב ישירות למייל ומשלוח מהיר',
    '💬 מתלבטים? שלחו הודעה לפרטי לפני ההזמנה ונסייע בשמחה',
  ].join('\n');
}
