/**
 * How long to hold a WhatsApp message before sending it.
 *
 * Green API drives a REAL WhatsApp account over the multi-device protocol — there is no
 * "business sender" status behind it. WhatsApp's own anti-spam looks at behaviour, and the
 * behaviour that gets a number restricted is machine-shaped: messages that leave at the
 * exact same second as another platform's post, several in a row within one minute, always
 * carrying a link. Nothing about the CONTENT is the problem; the CADENCE is.
 *
 * So every WhatsApp send is paced:
 *   • a random jitter, so posts don't leave on the round minute the scheduler fired on;
 *   • a minimum gap since the previous WhatsApp message, so a burst (manual push of four
 *     posts, or a campaign catching up) trickles instead of machine-gunning.
 *
 * The wait is CAPPED — a manual push is a live HTTP request, and a caller waiting three
 * minutes for a response is a worse bug than a fast send. Beyond the cap the send goes
 * anyway; pacing is harm reduction, not a queue.
 */

export const WA_MIN_GAP_MS = 90_000;
export const WA_JITTER_MS = 30_000;
export const WA_MAX_WAIT_MS = 100_000;

/**
 * @param lastSentAt when the previous WhatsApp message left (ms), or null for the first
 * @param now        current time (ms)
 * @param rand       a [0,1) roll — injected so the test is deterministic
 */
export function waDelayMs(lastSentAt: number | null, now: number, rand: number): number {
  const jitter = Math.round(Math.min(Math.max(rand, 0), 0.999) * WA_JITTER_MS);
  // A clock that jumped backwards (or a bogus future timestamp) must not park a send for
  // hours — clamp the gap to the configured minimum.
  const sinceLast = lastSentAt === null ? Infinity : now - lastSentAt;
  const gap = sinceLast >= WA_MIN_GAP_MS ? 0 : Math.min(WA_MIN_GAP_MS, WA_MIN_GAP_MS - Math.max(sinceLast, 0));
  return Math.min(WA_MAX_WAIT_MS, gap + jitter);
}
