/**
 * Is a campaign's widened gap a PACING fault, or just the hole a failed run left?
 *
 * The drift check measures the median gap between posts that actually went out. A run that
 * produced nothing — the AI judge rejected the copy, the product search came back empty —
 * leaves no post, so the two surviving neighbours sit a double interval apart and the
 * arithmetic reads as "publishing at half speed".
 *
 * That is a real problem, but not THIS one: it is generation, already reported by the
 * silent-campaign check and by the run's own note. Filing it again under "publishes slower
 * than configured" points the investigation at nextGroupSlot and the send window, where
 * nothing is wrong — which is exactly the hunt issue #57 started.
 *
 * So a gap that failed runs can account for is not called drift. Nothing is lost: the
 * failures alert on their own, and once they stop, genuine drift surfaces on the next
 * sweep with a clean measurement behind it.
 */

export type DriftVerdict = 'drift' | 'explained-by-failures' | 'ok';

/** The multiple of the expected gap above which a campaign counts as drifting. */
export const DRIFT_FACTOR = 1.7;

export function driftVerdict(input: {
  /** Median gap actually observed, in open-window minutes. */
  medianMin: number;
  /** The gap the configuration implies, in minutes. */
  expectedMin: number;
  /** Runs in the measured window that produced no post. */
  failedRuns: number;
}): DriftVerdict {
  const { medianMin, expectedMin, failedRuns } = input;
  if (!(expectedMin > 0)) return 'ok';
  if (medianMin <= expectedMin * DRIFT_FACTOR) return 'ok';

  // Each missing post merges two intervals into one. N failures can stretch a healthy gap
  // to (N+1)× — anything within that is fully accounted for by them.
  if (failedRuns > 0 && medianMin <= expectedMin * (failedRuns + 1)) return 'explained-by-failures';
  return 'drift';
}
