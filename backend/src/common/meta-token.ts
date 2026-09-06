import axios from 'axios';

/**
 * When a Meta Page Access Token dies.
 *
 * Shared because there are TWO places that hold one: the account-level token in
 * credential_sets, and a per-group token on any channel publishing to its own Facebook page.
 * Only the first was ever tracked, so a group token could expire in silence and take that
 * group's Facebook and Instagram publishing with it — no banner, no email, just posts that
 * stopped working. Two copies of this lookup would have been two chances to drift apart on
 * a question ("is this token still good?") that has one right answer.
 */

const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v21.0';

/**
 * The token's real expiry per Graph `debug_token` — a token can debug itself, so no app
 * secret is needed.
 *
 * Returns null both for a token that never expires (Graph reports `expires_at: 0`) and for
 * a lookup that failed, and callers must treat null as "unknown", never as "expired":
 * expiry tracking is a courtesy and must never block saving a credential or disable a
 * working integration because Graph was briefly unreachable.
 */
export async function resolveMetaTokenExpiry(token: string): Promise<Date | null> {
  if (!String(token || '').trim()) return null;
  try {
    const res = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`,
      { params: { input_token: token, access_token: token }, timeout: 8000, validateStatus: () => true },
    );
    const exp = res.data?.data?.expires_at;
    return typeof exp === 'number' && exp > 0 ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

/** Whole days until `exp`, floored. Negative once it has passed. Null stays null. */
export function daysUntil(exp: Date | null | undefined, now: Date = new Date()): number | null {
  if (!exp) return null;
  const ms = new Date(exp).getTime() - now.getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
}

/** The window in which a token is worth warning about — Meta's own tokens last ~60 days. */
export const TOKEN_WARN_DAYS = 7;

/** Should this token raise a warning now? Unknown expiry never warns (see above). */
export function tokenNeedsWarning(
  exp: Date | null | undefined, now: Date = new Date(), warnDays = TOKEN_WARN_DAYS,
): boolean {
  const days = daysUntil(exp, now);
  return days !== null && days <= warnDays;
}
