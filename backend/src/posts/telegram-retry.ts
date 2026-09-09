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
 * The failure and everything it wraps.
 *
 * axios does not re-throw the error it caught: it builds an AxiosError, copies `message` and
 * `code` across, and hangs the original off `cause`. So when the underlying failure is a
 * Happy Eyeballs AggregateError, what the caller receives has an EMPTY message (copied from
 * the aggregate), `code: 'ETIMEDOUT'` — and NO `errors` array, because that array never left
 * the original. Reading `err.errors` therefore sees an ordinary timeout and treats a
 * provably-safe connect failure as the one case that must never be retried.
 *
 * Bounded: a cause chain is two or three links in practice, and a cycle must not hang a send.
 */
function causeChain(err: any, max = 4): any[] {
  const chain: any[] = [];
  let cur = err;
  while (cur && chain.length < max && !chain.includes(cur)) {
    chain.push(cur);
    cur = cur.cause;
  }
  return chain;
}

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
  const chain = causeChain(err);
  if (chain.some((e) => CONNECTION_ERRORS.has(e?.code))) return true;
  // Node's Happy Eyeballs connect (v18+) tries IPv4 and IPv6 and, when EVERY attempt dies,
  // throws an AggregateError whose own `code` is unset and whose `message` is often EMPTY —
  // the real codes live in `errors[]`. This is still "the request never left the machine",
  // but the plain code check above missed it, so the one safe retry never happened and the
  // post's error_message read a blank "Telegram: ". Retryable only when every inner failure
  // is connection-level — a mix means something unknown happened, and unknown never retries.
  const aggregate = chain.find((e) => Array.isArray(e?.errors));
  if (!aggregate) return false;
  // Being an AggregateError is ITSELF the connect-phase proof — Node builds one nowhere
  // else — so a connect code anywhere in the chain (ETIMEDOUT included) is a handshake that
  // never completed, even when the inner failures carry no legible code of their own.
  //
  // Watchdog #69 was that shape one level up; #71 was the same failure wearing an AxiosError
  // (empty message, `code: 'ETIMEDOUT'`, aggregate hidden in `cause`), which is why looking
  // at `err.errors` alone kept missing it and the post was filed as "published partially"
  // while the group's slot was already spent.
  if (chain.some((e) => AGGREGATE_CONNECT_ERRORS.has(e?.code))) return true;
  return aggregate.errors.length > 0
    && aggregate.errors.every((e: any) => AGGREGATE_CONNECT_ERRORS.has(e?.code));
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
  // Empty message = the aggregate shape (its own message is ''). Its codes are the only
  // diagnosis there is, and they may be a level down in `cause` — look there too rather
  // than reporting a bare "connection failure" for a failure that named itself.
  const inner = causeChain(err).find((e) => Array.isArray(e?.errors))?.errors;
  const codes = Array.isArray(inner)
    ? Array.from(new Set(inner.map((e: any) => e?.code || e?.message).filter(Boolean)))
    : [];
  const code = err?.code || codes.join(', ');
  return code
    ? `שגיאת חיבור לטלגרם (${code})${tag}`
    : `שגיאת חיבור לטלגרם — הבקשה לא הגיעה לשרתי טלגרם${tag}`;
}
