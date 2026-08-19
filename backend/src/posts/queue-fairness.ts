/**
 * Who owns a group's next free send slot — the campaign chain or the manual queue?
 *
 * Both publish to the same group on the same one-per-interval clock, but they enter it
 * differently: campaign posts BOOK a concrete scheduled_at, while manual queue posts are
 * time-less (they wait for "the next free slot"). Because a time-less post occupies
 * nothing in the group's calendar, campaigns kept booking every single interval and the
 * queue never got a turn — the owner watched seven queued posts slide "~14:00 → ~15:00 →
 * ~16:00" forever, because the ETA is honest and the slot never came.
 *
 * The rule: while the manual queue has posts waiting (and its drip is actually enabled),
 * the group's slots ALTERNATE — a slot after a campaign send belongs to the queue, a slot
 * after a manual send belongs to the campaigns. One starving the other is impossible by
 * construction: each side can lose at most every second slot.
 */
export function manualQueueTurn(input: {
  /** Manual posts waiting in this group's queue bucket. */
  waiting: number;
  /** The queue drip that would take the slot is enabled (user + group toggles). */
  dripEnabled: boolean;
  /** campaign_id of the group's most recent SENT post — null/'' means it was manual. */
  lastSentCampaignId: string | null | undefined;
  /** Whether the group has any sent post at all. */
  hasSentAny: boolean;
}): boolean {
  if (input.waiting <= 0 || !input.dripEnabled) return false;
  // A fresh group has no turn order yet — the queue may open it.
  if (!input.hasSentAny) return true;
  // Last slot went to a campaign → this one is the queue's.
  return !!input.lastSentCampaignId;
}
