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
 * Codes acceptable INSIDE an AggregateError. Node aggregates errors in exactly one place —
 * the Happy Eyeballs CONNECT loop — so an inner ETIMEDOUT is a connect-phase timeout: the
 * TCP handshake never completed and the request provably never left the machine, making a
 * retry safe. A TOP-LEVEL ETIMEDOUT stays non-retryable (see below): on an established
 * socket it can mean the reply was lost after Telegram already published.
 */
const AGGREGATE_CONNECT_ERRORS = new Set([...CONNECTION_ERRORS, 'ETIMEDOUT']);

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
  if (CONNECTION_ERRORS.has(err?.code)) return true;
  // Node's Happy Eyeballs connect (v18+) tries IPv4 and IPv6 and, when EVERY attempt dies,
  // throws an AggregateError whose own `code` is unset and whose `message` is often EMPTY —
  // the real codes live in `errors[]`. This is still "the request never left the machine",
  // but the plain code check above missed it, so the one safe retry never happened and the
  // post's error_message read a blank "Telegram: ". Retryable only when every inner failure
  // is connection-level — a mix means something unknown happened, and unknown never retries.
  const inner = (err as AggregateError)?.errors;
  return Array.isArray(inner) && inner.length > 0
    && inner.every((e: any) => AGGREGATE_CONNECT_ERRORS.has(e?.code));
}

/**
 * The one-line reason a Telegram send failed, for error_message / the UI — NEVER empty.
 *
 * `description || message` was the old formula, and an AggregateError (empty message, codes
 * buried in `errors[]`) reduced it to nothing: the owner and the watchdog both saw a bare
 * "Telegram: " with no way to tell a dead token from a network blip. Walk every place a
 * reason can hide, and when all are empty say "connection failure" explicitly — because
 * with no HTTP response, that is exactly what it was.
 */
/**
 * Stamped onto an error the sender PROVED never reached the platform. The auto-retry keys
 * on this, not on wording: "שגיאת חיבור לטלגרם (ETIMEDOUT)" is produced both by a
 * connect-phase failure (safe — nothing was sent) and by a top-level timeout on an open
 * socket (unsafe — Telegram may have published). Only the sender, holding the error
 * object, can tell them apart, so it records the verdict here.
 */
export const NET_SAFE_TAG = '[net]';

export function telegramErrorText(err: any): string {
  const tag = isTelegramConnectionError(err) ? ` ${NET_SAFE_TAG}` : '';
  const desc = err?.response?.data?.description;
  // A response means Telegram answered — never taggable, whatever it says.
  if (desc) return String(desc);
  if (err?.message) return `${String(err.message)}${tag}`;
  const inner = (err as AggregateError)?.errors;
  const codes = Array.isArray(inner)
    ? Array.from(new Set(inner.map((e: any) => e?.code || e?.message).filter(Boolean)))
    : [];
  const code = err?.code || codes.join(', ');
  return code
    ? `שגיאת חיבור לטלגרם (${code})${tag}`
    : `שגיאת חיבור לטלגרם — הבקשה לא הגיעה לשרתי טלגרם${tag}`;
}
