import { BadRequestException } from '@nestjs/common';

/**
 * SSRF guard for server-side fetches of user-supplied URLs. Blocks non-http(s) schemes and
 * any host that points at the machine itself or a private/internal network — the classic
 * SSRF targets (cloud metadata 169.254.169.254, localhost, 10./172.16./192.168., etc.).
 * Pair every guarded fetch with `maxRedirects: 0` so a public host can't 30x into an
 * internal one after the check.
 */

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return false;
  const [a, b] = o;
  return (
    a === 0 || a === 10 || a === 127 || a === 255 ||
    (a === 169 && b === 254) ||           // link-local (incl. cloud metadata)
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127)    // CGNAT
  );
}

function isBlockedHost(hostname: string): boolean {
  let h = hostname.toLowerCase();
  const isV6 = h.includes(':') || (h.startsWith('[') && h.endsWith(']'));
  h = h.replace(/^\[|\]$/g, '');

  if (isV6) {
    if (h === '::1' || h === '::') return true;                 // loopback / unspecified
    if (h.startsWith('fe80:')) return true;                     // link-local
    if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;              // unique-local fc00::/7
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
    if (mapped && isPrivateIpv4(mapped[1])) return true;
    return false;
  }

  // Internal / loopback names, and single-label hosts (localhost, decimal-IP shorthands).
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (!h.includes('.')) return true;
  return isPrivateIpv4(h);
}

/**
 * Throw unless `url` is a safe PUBLIC http(s) URL. Pass `allowHost` to additionally require a
 * specific domain (e.g. only *.yupoo.com) — the strongest containment when the source is
 * meant to come from one provider. Returns the parsed URL on success.
 */
export function assertSafeOutboundUrl(url: string, opts?: { allowHost?: RegExp }): URL {
  let u: URL;
  try { u = new URL(url); } catch { throw new BadRequestException('כתובת URL לא תקינה'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new BadRequestException('נתמכות רק כתובות http/https');
  }
  if (opts?.allowHost) {
    if (!opts.allowHost.test(u.hostname)) throw new BadRequestException('דומיין לא מורשה');
    return u;
  }
  if (isBlockedHost(u.hostname)) throw new BadRequestException('כתובת פנימית/פרטית חסומה');
  return u;
}

/** Boolean variant for best-effort paths that must not throw. */
export function isSafeOutboundUrl(url: string, opts?: { allowHost?: RegExp }): boolean {
  try { assertSafeOutboundUrl(url, opts); return true; } catch { return false; }
}
