/**
 * Is a quiet campaign actually STUCK, or simply between its runs?
 *
 * The silent-campaign check fires when an active campaign hasn't published for 3+ open-window
 * hours. For a campaign that publishes a few times a day that is the normal state, and the
 * proof is sitting in the queue: its next post already exists with a future scheduled_at.
 * The old check saw "1 post pending" and read it as evidence of a jam, so a healthy
 * low-frequency campaign (next slot 23:00) raised an issue every night — and an alert that
 * cries wolf nightly is an alert the owner stops reading, which costs more than it saves.
 *
 * A pending post whose time has PASSED is the opposite: that one really is stuck.
 */

export type PendingVerdict = 'booked' | 'overdue' | 'none';

/**
 * @param nextScheduledAtMs earliest scheduled_at among the campaign's pending posts (0/null
 *                          when it has none)
 * @param nowMs             current time
 */
export function pendingVerdict(nextScheduledAtMs: number | null | undefined, nowMs: number): PendingVerdict {
  if (!nextScheduledAtMs) return 'none';
  return nextScheduledAtMs > nowMs ? 'booked' : 'overdue';
}
