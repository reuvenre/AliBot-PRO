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

/** The owner's wording (19.08) — questions go to DM. */
export function flylinkTrustBlock(): string {
  return [
    `${FLYLINK_TRUST_MARK} — מה שרואים בתמונות זה מה שמגיע`,
    '📦 קבלת מספר מעקב ישירות למייל ומשלוח מהיר',
    '💬 מתלבטים? שלחו הודעה לפרטי לפני ההזמנה ונסייע בשמחה',
  ].join('\n');
}
