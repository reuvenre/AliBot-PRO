/**
 * Which Telegram send failures are safe to send again.
 *
 * Render→Telegram drops a connection every few days. A single blip loses the whole post:
 * the scheduler has already consumed the group's slot, so the product is never published
 * and nothing comes back for it. One extra attempt fixes that — but only for failures
 * where the request provably never reached Telegram's application, because a retry of
 * anything else risks publishing the same product to the group twice.
 */

/**
 * Connection-level codes: DNS never resolved, the socket was refused, or it died before
 * any byte of a reply arrived. Telegram never saw the request, so a retry cannot duplicate.
 *
 * Timeout codes are deliberately absent — see `isTelegramConnectionError`.
 */
const CONNECTION_ERRORS = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH',
]);

/**
 * True when a failed Telegram send never reached Telegram and may be retried.
 *
 * Excluded on purpose:
 * - Anything carrying an HTTP response. Telegram answered; the answer is the verdict, and
 *   the caller's own handling (plain-text fallback on a 400 parse error, hard failure
 *   otherwise) must decide — not a blind retry.
 * - Timeouts (ECONNABORTED / ETIMEDOUT). This is the one case where Telegram may have
 *   published and only the reply was lost. Retrying posts the product twice, which is why
 *   the upload paths carry long timeouts instead of short ones with a retry.
 * - A delivery that Telegram did not confirm (`ok:false`). That is an application answer
 *   wearing a plain Error, and resending it would duplicate whatever did go out.
 */
export function isTelegramConnectionError(err: any): boolean {
  if (err?.response) return false;
  return CONNECTION_ERRORS.has(err?.code);
}
