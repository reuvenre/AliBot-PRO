/**
 * How much louder a campaign gets while a commercial-calendar event is open.
 *
 * A holiday is the shortest window in the year and the one with the most buying intent in
 * it: the same product that sells once in March sells three times in the week before Rosh
 * Hashanah. The ordinary rotation treats that week like any other — the seasonal keywords
 * join the list, take one slot each in a long cycle, and the run publishes the same number
 * of posts it always does. By the time a holiday keyword comes around twice, the holiday is
 * over.
 *
 * So while a window is open, an opted-in campaign gets two things: one extra post per run,
 * and (in the rotation) a proven keyword's emphasis for the seasonal terms instead of an
 * unproven one's floor. Together those roughly triple the holiday products that actually
 * reach the group, without touching what the owner configured.
 *
 * Deliberately NOT written to the campaign row. `posts_per_run` is the owner's number and
 * the optimizer guarantees it never drifts more than ±1 from it; a boost that edited the
 * column would spend that budget and make the manager's arithmetic lie. This is computed
 * per run and disappears with the window, leaving nothing to switch off afterwards.
 */

/** Extra posts per run while an event window is open. */
export const SEASONAL_EXTRA_POSTS_PER_RUN = 1;

/**
 * Ceiling for the boosted value. A campaign already publishing heavily does not need the
 * extra slot as much as it needs the group not to read like a feed — and every post costs
 * an AI generation and a publish.
 */
export const MAX_SEASONAL_POSTS_PER_RUN = 6;

/**
 * Posts this run should produce: the owner's number, plus the seasonal slot while a window
 * is open — never above the ceiling, and never below 1.
 */
export function seasonalPostsPerRun(base: number, boosted: boolean): number {
  const own = Math.max(1, Math.floor(base) || 1);
  if (!boosted) return own;
  return Math.min(own + SEASONAL_EXTRA_POSTS_PER_RUN, Math.max(own, MAX_SEASONAL_POSTS_PER_RUN));
}
