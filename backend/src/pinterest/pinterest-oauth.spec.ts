import {
  PINTEREST_SCOPES, basicAuth, buildAuthUrl, needsRefresh, signState, verifyState,
} from './pinterest-oauth';

const SECRET = 'app-secret-value';
const USER = '3f1a2b7c-0000-4444-8888-abcdefabcdef';
const NOW = Date.UTC(2026, 7, 11, 12, 0, 0);

describe('state signing', () => {
  it('round-trips the user id', () => {
    expect(verifyState(signState(USER, SECRET, NOW), SECRET, NOW + 1000)).toBe(USER);
  });

  it('rejects a state signed with a different secret — the callback is a public URL', () => {
    const forged = signState(USER, 'attacker-secret', NOW);
    expect(verifyState(forged, SECRET, NOW + 1000)).toBeNull();
  });

  it('rejects a tampered payload (binding someone else\'s account)', () => {
    const good = signState(USER, SECRET, NOW);
    const [, sig] = good.split('.');
    const swapped = `${Buffer.from('victim-user-id.' + NOW).toString('base64url')}.${sig}`;
    expect(verifyState(swapped, SECRET, NOW + 1000)).toBeNull();
  });

  it('expires — a stale approval link cannot be replayed later', () => {
    const s = signState(USER, SECRET, NOW);
    expect(verifyState(s, SECRET, NOW + 14 * 60_000)).toBe(USER);
    expect(verifyState(s, SECRET, NOW + 16 * 60_000)).toBeNull();
  });

  it('rejects a future-dated state and malformed input', () => {
    expect(verifyState(signState(USER, SECRET, NOW + 5 * 60_000), SECRET, NOW)).toBeNull();
    expect(verifyState('', SECRET, NOW)).toBeNull();
    expect(verifyState('garbage', SECRET, NOW)).toBeNull();
    expect(verifyState('a.b.c', SECRET, NOW)).toBeNull();
  });
});

describe('buildAuthUrl', () => {
  it('asks for exactly the publishing scopes', () => {
    const url = buildAuthUrl('1593115', 'https://x.co/api/pinterest/callback', 'st');
    expect(url).toContain('client_id=1593115');
    expect(url).toContain('response_type=code');
    expect(decodeURIComponent(url)).toContain(PINTEREST_SCOPES.join(','));
    expect(decodeURIComponent(url)).toContain('pins:write');
    // We never read the owner's profile, so we never ask to.
    expect(decodeURIComponent(url)).not.toContain('user_accounts:read');
  });

  it('url-encodes the redirect so Pinterest gets it intact', () => {
    const url = buildAuthUrl('1', 'https://x.co/api/pinterest/callback?a=b', 's');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fx.co%2Fapi%2Fpinterest%2Fcallback%3Fa%3Db');
  });
});

describe('basicAuth', () => {
  it('encodes app id and secret', () => {
    expect(basicAuth('id', 'secret')).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
  });
});

describe('needsRefresh', () => {
  it('refreshes ahead of expiry, not after it', () => {
    expect(needsRefresh(new Date(NOW + 30 * 60 * 60_000), NOW)).toBe(false); // 30h out
    expect(needsRefresh(new Date(NOW + 60 * 60_000), NOW)).toBe(true);       // 1h out
    expect(needsRefresh(new Date(NOW - 1000), NOW)).toBe(true);              // already dead
  });

  it('treats an unknown expiry as due — refreshing a live token is the cheap mistake', () => {
    expect(needsRefresh(null, NOW)).toBe(true);
    expect(needsRefresh(undefined, NOW)).toBe(true);
  });
});
