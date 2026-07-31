/**
 * Business regressions — a campaign that still works but stopped performing.
 *
 * Everything else the watchdog looks for is a fault: posts stuck, sends failing, a campaign
 * that stopped running. All of it answers "is the machine broken?". None of it notices the
 * failure that actually costs money — the machine running perfectly while nobody clicks any
 * more. Posts go out, Telegram accepts them, no error is raised anywhere, and the group
 * quietly stops converting after a template edit, a keyword swap, or a change of voice.
 *
 * So this compares a campaign's recent click-through rate against its own recent past. Its
 * own, not another campaign's: groups have wildly different audiences and sizes, and the only
 * fair benchmark for a campaign is what that same campaign was doing two weeks ago.
 *
 * The bar for crying wolf is deliberately high. A watchdog that reports noise trains the
 * owner to ignore it, at which point it protects nothing.
 */

/** One campaign's click-through in two windows: the recent one and the baseline behind it. */
export interface CampaignCtr {
  campaignId: string;
  campaignName: string;
  userId: string;
  recentPosts: number;
  recentClicks: number;
  baselinePosts: number;
  baselineClicks: number;
}

/** A confirmed drop, with the numbers that justify calling it one. */
export interface CtrRegression {
  campaignId: string;
  campaignName: string;
  userId: string;
  /** Clicks per post, recent window. */
  recentRate: number;
  /** Clicks per post, baseline window. */
  baselineRate: number;
  /** How far the rate fell, as a percentage of the baseline (0–100). */
  dropPercent: number;
  recentPosts: number;
  recentClicks: number;
  baselinePosts: number;
  baselineClicks: number;
}

/** Posts needed in EACH window before the two are worth comparing. */
export const MIN_POSTS_PER_WINDOW = 10;
/**
 * Clicks the baseline must hold before a fall from it means anything.
 *
 * Without this the check fires on arithmetic: a campaign that drew 2 clicks and now draws 0
 * has "fallen 100%", which is a sentence about rounding, not about the business.
 */
export const MIN_BASELINE_CLICKS = 12;
/** How far the rate must fall to be reported. Well clear of ordinary week-to-week swing. */
export const MIN_DROP_PERCENT = 40;

/**
 * The campaigns whose click-through genuinely collapsed, worst first.
 *
 * Every gate has to pass together: enough posts in both windows to be comparing like with
 * like, a baseline strong enough to fall from, and a drop too large to be a quiet week.
 * A campaign that fails any of them is not reported — silence is the correct output when
 * the data cannot support the claim.
 */
export function detectCtrRegressions(rows: CampaignCtr[]): CtrRegression[] {
  const out: CtrRegression[] = [];

  for (const r of rows || []) {
    if (!r || !r.campaignId) continue;
    if (r.recentPosts < MIN_POSTS_PER_WINDOW || r.baselinePosts < MIN_POSTS_PER_WINDOW) continue;
    if (r.baselineClicks < MIN_BASELINE_CLICKS) continue;

    const baselineRate = r.baselineClicks / r.baselinePosts;
    const recentRate = r.recentClicks / r.recentPosts;
    if (baselineRate <= 0) continue;

    const dropPercent = ((baselineRate - recentRate) / baselineRate) * 100;
    if (dropPercent < MIN_DROP_PERCENT) continue;

    out.push({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      userId: r.userId,
      recentRate: +recentRate.toFixed(3),
      baselineRate: +baselineRate.toFixed(3),
      dropPercent: Math.round(dropPercent),
      recentPosts: r.recentPosts,
      recentClicks: r.recentClicks,
      baselinePosts: r.baselinePosts,
      baselineClicks: r.baselineClicks,
    });
  }

  return out.sort((a, b) => b.dropPercent - a.dropPercent);
}

/** The owner-facing line for one regression: what fell, by how much, in plain numbers. */
export function regressionLine(r: CtrRegression): string {
  return `${r.campaignName} — ההמרה ירדה ${r.dropPercent}% `
    + `(${r.recentRate} קליקים לפוסט מול ${r.baselineRate} קודם)`;
}
