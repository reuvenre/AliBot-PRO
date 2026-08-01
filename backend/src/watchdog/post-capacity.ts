/**
 * How many posts a campaign can actually deliver per run — against how many it was set to.
 *
 * A campaign's "posts per run" is a promise the group's own publish interval may not be able
 * to keep. The scheduler places each post a full group interval behind the last, and stops
 * at the campaign's next cron fire, so a 3-hourly campaign on a 3-hour group has room for
 * exactly one post no matter what the setting says.
 *
 * That is correct behaviour — the group's rate is the owner's own decision and must win —
 * but it used to happen in silence, and the setting in the UI simply did not come true. This
 * is the check that says so out loud, because no other watchdog check can see it: nothing
 * fails, nothing is late, and the cadence matches the group's configured rate perfectly.
 *
 * Only the owner can resolve it (raise the group's rate, or lower the campaign's setting),
 * so it is reported as an action for them rather than as something to patch in code.
 */

/** One active campaign measured against the group it publishes to. */
export interface CampaignCadence {
  campaignId: string;
  campaignName: string;
  userId: string;
  groupId: string;
  groupName: string;
  /** Posts the campaign is configured to publish per run. */
  postsPerRun: number;
  /** Minutes between the campaign's own cron fires. */
  cycleMinutes: number;
  /** Minutes the target group enforces between posts. */
  groupIntervalMinutes: number;
}

/** A campaign whose setting the group's rate cannot honour. */
export interface CapacityShortfall extends CampaignCadence {
  /** How many posts actually fit in one cycle. */
  maxPostsPerCycle: number;
}

/**
 * How many posts fit in one cycle, mirroring the scheduler exactly.
 *
 * The scheduler books post i (0-based) at cycleStart + i × groupInterval and requires that
 * to fall STRICTLY before the next cron fire, so the count is ceil(cycle / interval). The
 * scheduler evaluates that per post rather than as a count, so this is a restatement of its
 * rule, not the rule itself — the spec pins the two together case by case, because a
 * watchdog that is wrong about the system's own behaviour is worse than no watchdog.
 */
export function maxPostsPerCycle(cycleMinutes: number, groupIntervalMinutes: number): number {
  const cycle = Number(cycleMinutes);
  const interval = Number(groupIntervalMinutes);
  // An unknown or nonsensical interval means no claim can be made. One post always fits.
  if (!Number.isFinite(cycle) || !Number.isFinite(interval) || cycle <= 0 || interval <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(cycle / interval));
}

/**
 * The campaigns asking for more posts per run than their group can carry, worst gap first.
 *
 * A campaign set to 1 post is never reported: it has promised nothing that could go unmet.
 */
export function detectCapacityShortfalls(rows: CampaignCadence[]): CapacityShortfall[] {
  const out: CapacityShortfall[] = [];

  for (const r of rows || []) {
    if (!r || !r.campaignId) continue;
    const wanted = Number(r.postsPerRun);
    if (!Number.isFinite(wanted) || wanted <= 1) continue;

    const fits = maxPostsPerCycle(r.cycleMinutes, r.groupIntervalMinutes);
    if (wanted <= fits) continue;

    out.push({ ...r, postsPerRun: wanted, maxPostsPerCycle: fits });
  }

  return out.sort((a, b) =>
    (b.postsPerRun - b.maxPostsPerCycle) - (a.postsPerRun - a.maxPostsPerCycle));
}

/** The group interval that would let a campaign deliver every post it was set to. */
export function requiredGroupInterval(cycleMinutes: number, postsPerRun: number): number {
  const cycle = Number(cycleMinutes);
  const posts = Number(postsPerRun);
  if (!Number.isFinite(cycle) || !Number.isFinite(posts) || cycle <= 0 || posts <= 1) return 0;
  // Post i lands at i × interval and the last one must sit strictly inside the cycle, so
  // the interval has to divide the cycle into at least `posts` parts. Floored, because a
  // rounded-up value would land the final post exactly on the boundary and be rejected.
  return Math.floor(cycle / posts);
}

/** The owner-facing line: what was asked, what arrives, and the setting that decides it. */
export function shortfallLine(s: CapacityShortfall): string {
  const needed = requiredGroupInterval(s.cycleMinutes, s.postsPerRun);
  return `"${s.campaignName}" מוגדר ל-${s.postsPerRun} פוסטים לריצה, אך הקבוצה "${s.groupName}" `
    + `מוגבלת ל-${s.groupIntervalMinutes} דק' בין פוסטים — בפועל יוצא ${s.maxPostsPerCycle}. `
    + `כדי לקבל ${s.postsPerRun}, המרווח בקבוצה צריך לרדת ל-${needed} דק' או פחות.`;
}
