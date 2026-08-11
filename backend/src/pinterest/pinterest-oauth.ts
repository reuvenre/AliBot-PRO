/**
 * The Pinterest OAuth handshake, as pure functions.
 *
 * Why OAuth at all: the token the developer portal hands out by button carries read-only
 * scopes and expires in 24 hours. Publishing needs `pins:write`, and an unattended
 * publisher needs a credential that renews itself — neither exists outside this flow.
 *
 * The pieces that decide correctness (which scopes we ask for, how the callback state is
 * signed and verified, when a token counts as due for refresh) live here so they can be
 * tested without a browser or a live Pinterest account.
 */

import * as crypto from 'crypto';

export const PINTEREST_AUTH_URL = 'https://www.pinterest.com/oauth/';
export const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';

/**
 * Exactly what the publisher uses, and nothing more:
 *   boards:read  — list boards for the settings picker
 *   boards:write — required to CREATE a pin, despite the name
 *   pins:read    — read back a Pin's analytics (the learning engine's click signal)
 *   pins:write   — publish
 * user_accounts:read is deliberately absent: we never read the owner's profile.
 *
 * boards:write is the counter-intuitive one, and leaving it out is what got the first pin
 * rejected. Creating a pin writes to a board, so Pinterest checks the board scope too —
 * `pins:write` alone yields "your token does not have sufficient permissions", naming
 * scopes without naming WHICH. We never create or modify boards ourselves; this is asked
 * for solely because publishing a pin does not work without it.
 */
export const PINTEREST_SCOPES = ['boards:read', 'boards:write', 'pins:read', 'pins:write'];

/** Refresh this far BEFORE expiry — a token that dies mid-campaign costs a publish. */
export const REFRESH_MARGIN_MS = 6 * 60 * 60 * 1000;

/**
 * Sign the callback state with the app secret.
 *
 * The state round-trips through Pinterest and comes back on a PUBLIC callback URL, so it
 * cannot be trusted on its own: without a signature anyone could call the callback with a
 * chosen user id and bind their own Pinterest account to that user's credentials. The
 * payload carries the user id and a timestamp; the signature proves we issued it.
 */
export function signState(userId: string, secret: string, issuedAtMs: number): string {
  const payload = `${userId}.${issuedAtMs}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** The user id inside a state we signed, or null — expired, forged and malformed all null. */
export function verifyState(state: string, secret: string, nowMs: number, maxAgeMs = 15 * 60_000): string | null {
  const parts = String(state || '').split('.');
  if (parts.length !== 2) return null;
  let payload: string;
  try { payload = Buffer.from(parts[0], 'base64url').toString('utf8'); } catch { return null; }
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  // Constant-time compare — a length-varying early return would leak the signature.
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const sep = payload.lastIndexOf('.');
  if (sep <= 0) return null;
  const userId = payload.slice(0, sep);
  const issuedAt = Number(payload.slice(sep + 1));
  if (!userId || !Number.isFinite(issuedAt)) return null;
  if (nowMs - issuedAt > maxAgeMs || issuedAt > nowMs + 60_000) return null;
  return userId;
}

/** The URL the owner is sent to in order to approve the connection. */
export function buildAuthUrl(appId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PINTEREST_SCOPES.join(','),
    state,
  });
  return `${PINTEREST_AUTH_URL}?${params.toString()}`;
}

/** Basic auth header for the token endpoint — Pinterest wants app id:secret, base64. */
export function basicAuth(appId: string, appSecret: string): string {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`;
}

/** Is this access token due for renewal? Unknown expiry counts as due — refreshing a live
 *  token is harmless, publishing with a dead one is not. */
export function needsRefresh(expiresAt: Date | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - nowMs < REFRESH_MARGIN_MS;
}
