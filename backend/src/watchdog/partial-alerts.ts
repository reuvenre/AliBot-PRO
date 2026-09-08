/**
 * Which "published partially" records are worth waking someone over.
 *
 * A partial publish is a discrete EVENT on one post: a channel failed at a moment in time.
 * The scan that finds them, though, is a rolling 6-hour window over `error_message`, so the
 * same failed post keeps answering the query for six hours after it happened — long after
 * it was reported, read and fixed.
 *
 * The platform-set throttle key does not hold that line. It is built from the platforms
 * present in the CURRENT window, so as companions age out the key changes underneath the
 * same post and every subset dodges the throttle afresh. Watchdog #68 → #69 → #70 were
 * three issues for two failures: `partial_publish:Instagram`, then
 * `partial_publish:Instagram,Telegram`, then `partial_publish:Telegram` — the last two
 * naming a post already fixed and closed.
 *
 * So the memory is kept per POST, not per key: a post is reported once, and never again.
 */

/** How long a reported post id is remembered. Comfortably longer than the 6h scan window,
 *  so an id is forgotten only once it can no longer be found by the query at all. */
export const PARTIAL_MEMORY_MS = 24 * 60 * 60 * 1000;

/** Drop ids that have aged past the scan window, so the memory of a long-lived process
 *  stays bounded by the traffic of one day rather than growing forever. */
export function forgetOldPartials(reported: Map<string, number>, now: number): void {
  for (const [id, at] of reported) {
    if (now - at > PARTIAL_MEMORY_MS) reported.delete(id);
  }
}

/**
 * The records nobody has been told about yet.
 *
 * Read-only on purpose: an id is remembered when the alert actually GOES OUT, not when it
 * is composed — an alert dropped by the key throttle must still be reportable later.
 */
export function unreportedPartials<T extends { id: string }>(
  partials: T[],
  reported: ReadonlyMap<string, number>,
): T[] {
  return partials.filter((p) => !reported.has(String(p.id)));
}
