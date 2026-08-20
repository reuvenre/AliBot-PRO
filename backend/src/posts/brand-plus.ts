/**
 * The Brand+ authenticity line.
 *
 * AliExpress marks official brand-store listings with a "Brand+ / Certified Original"
 * badge (platform_product_type TMALL in the affiliate API), and for a follower whose
 * hesitation is "is this original?" that badge IS the reason to buy. Code-built like the
 * price block and the FLYLINK trust trailer: fixed wording that can never over-promise,
 * attached at send time so already-queued posts and verbatim re-posts carry it too.
 */

/** Dedup guard — the badge name itself, present in both language variants. */
export const BRAND_PLUS_MARK = 'Brand+';

export function brandPlusLine(hebrew: boolean): string {
  return hebrew
    ? '🏆 <b>Brand+ | מוצר מקורי 100%</b> — נמכר בחנות הרשמית של המותג באלי אקספרס'
    : "🏆 <b>Brand+ | Certified Original</b> — sold by the brand's official store on AliExpress";
}
