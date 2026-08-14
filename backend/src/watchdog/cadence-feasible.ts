/**
 * The FEASIBLE median gap between a campaign's posts, given what it shares.
 *
 * The drift check compares real gaps to an expectation; for two rounds that expectation
 * was the naive share-adjusted cadence (base × competitors), and a healthy campaign on a
 * crowded group kept tripping it. The missing physics is PHASE SLIP: a group serves one
 * post per interval from ANY source, so when this campaign's turn arrives its own cron
 * tick may already have passed — it then waits for the NEXT tick. Every competitor ahead
 * of it can add up to one slot of that slippage per rotation.
 *
 *   feasible = base × competitors  +  (competitors − 1) × slot
 *
 * where base = max(cron, group interval) and slot = min(cron, group interval).
 *
 * The crucial property: an UNSHARED campaign (competitors = 1) gets zero slack — the
 * formula collapses to the plain cron interval, so the check keeps its full sensitivity
 * for the classic regression (a lone hourly campaign publishing every 2 hours). Only
 * genuinely shared groups earn the extra allowance.
 */
export function feasibleCadenceMin(
  cronMin: number,
  groupIntervalMin: number,
  competitors: number,
): number {
  const n = Math.max(1, Math.floor(competitors) || 1);
  const interval = Math.max(0, groupIntervalMin || 0);
  const base = Math.max(cronMin, interval);
  const slot = interval > 0 ? Math.min(cronMin, interval) : cronMin;
  return base * n + (n - 1) * slot;
}
