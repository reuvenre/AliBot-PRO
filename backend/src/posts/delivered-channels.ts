/**
 * Where a post ACTUALLY published — as opposed to where it was aimed.
 *
 * The posts list labels each row with the post's `channel_override(s)`, which is the
 * TARGETING field: the group the post was created for. A manual "push now" to a different
 * group sends there but never touched that field, so a product pushed by hand to
 * "טקטי בקליק" kept reading "ALI4YOU" in the list — the record contradicted what the
 * owner had just done with his own hands.
 *
 * The fix is a separate, DISPLAY-ONLY record. Overwriting the targeting field would have
 * silently re-routed every later republish, retry and recycle of that post; this column
 * is read by the UI and by nothing that decides where anything is sent.
 */

/**
 * The delivery record after a push.
 *
 * @param wasSent      the post had already published before this push — then its original
 *                     targets are genuine deliveries and the pushed ones are ADDED to them.
 *                     A post that had never gone out has only intent to show, so the push
 *                     REPLACES it: nothing was ever delivered to the original group.
 * @param existing     the delivery record already stored, if any.
 * @param intended     the post's targeting field(s) — its original group(s).
 * @param pushed       groups this push actually reached (only confirmed successes).
 *
 * Returns null when there is nothing meaningful to record (a default-channel-only push),
 * leaving the UI on its existing fallback rather than writing an empty claim.
 */
export function mergeDeliveredChannels(input: {
  wasSent: boolean;
  existing: string[];
  intended: string[];
  pushed: string[];
}): string[] | null {
  const clean = (list: string[]) =>
    (list || []).map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean);

  const pushed = clean(input.pushed);
  if (!pushed.length) return null; // nothing confirmed → never rewrite the record

  const base = input.existing.length ? clean(input.existing)
    : (input.wasSent ? clean(input.intended) : []);
  const merged = Array.from(new Set([...base, ...pushed]));
  return merged.length ? merged : null;
}
