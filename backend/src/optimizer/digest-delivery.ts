/**
 * Did the morning digest actually REACH the owner?
 *
 * The delivery step used to swallow both channels' failures with a warning and return
 * void, so the caller stamped the day as sent whatever happened. A Telegram or SMTP blip
 * at 10:10 therefore cost the whole report — silently, with no retry and nothing in the UI
 * to show for it. "The full morning report didn't arrive again" was that, every time.
 *
 * Delivery is now an OUTCOME the caller can act on: one channel succeeding is enough (the
 * digest is the same text on both), and every channel failing means the day is not done
 * and the next hourly tick must try again.
 */

export interface ChannelResult {
  /** 'telegram' | 'email' — named so the failure reason says which one. */
  channel: string;
  /** Attempted at all? A channel the account never configured is not a failure. */
  attempted: boolean;
  ok: boolean;
  error?: string;
}

export interface DeliveryOutcome {
  delivered: boolean;
  /** Empty when delivered; otherwise why each attempted channel failed. */
  reason: string;
}

export function deliveryOutcome(results: ChannelResult[]): DeliveryOutcome {
  const attempted = results.filter((r) => r.attempted);
  if (attempted.some((r) => r.ok)) return { delivered: true, reason: '' };
  if (!attempted.length) {
    // Nothing was even tried: no email on file and no Telegram route. Retrying hourly
    // would never help, so this counts as delivered-as-far-as-possible — the owner has
    // no channel configured, which is a settings problem, not a transport failure.
    return { delivered: true, reason: '' };
  }
  return {
    delivered: false,
    reason: attempted.map((r) => `${r.channel}: ${r.error || 'נכשל'}`).join(' | '),
  };
}
