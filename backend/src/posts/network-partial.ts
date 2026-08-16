/**
 * Which "published partially" failures are safe for the system to retry BY ITSELF.
 *
 * A post that reached Telegram and lost Facebook stays `sent` with an error_message, so
 * nothing else notices it — the watchdog raises an issue and the owner presses retry by
 * hand. For one failure family that hand is pure ceremony: a connection that died at the
 * wire. Nothing reached Meta, so re-sending cannot duplicate, and the fix is simply to
 * try again a few minutes later when the network is back.
 *
 * The line this module draws is the whole safety argument:
 *   RETRYABLE — "החיבור נכשל ברמת הרשת": an AggregateError from Node's connect loop. The
 *               socket never opened. Provably nothing was published.
 *   NOT       — a TIMEOUT ("לא השיבה בזמן"). The request may have arrived and only the
 *               reply was lost; retrying would put the post on the page twice.
 *   NOT       — anything the owner must fix (token, permission, bad id). A retry fails
 *               identically and buries the real message under noise.
 */

/** Appended once a post has had its free automatic retry — the loop stop. */
export const AUTO_RETRY_MARK = ' · נוסה שוב אוטומטית';

/** The connect-phase wording facebook-errors.ts produces for a wire-level failure. */
const NETWORK_PHRASE = /נכשל ברמת הרשת/;

/** Wording that means "the request may have landed" — never auto-retried. */
const TIMEOUT_PHRASE = /לא השיבה בזמן|timeout/i;

export function isRetryableNetworkPartial(errorMessage: string | null | undefined): boolean {
  const text = String(errorMessage || '');
  if (!text.trim()) return false;
  if (text.includes(AUTO_RETRY_MARK)) return false; // already had its turn
  if (!NETWORK_PHRASE.test(text)) return false;
  // A mixed error ("Facebook: network … | Instagram: token expired") is NOT auto-retried:
  // one half would fail identically, and the owner needs to read the half that matters.
  return !TIMEOUT_PHRASE.test(text);
}
