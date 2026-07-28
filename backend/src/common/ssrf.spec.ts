import { isSafeOutboundUrl, assertSafeOutboundUrl } from './ssrf';

describe('ssrf guard', () => {
  it('blocks cloud metadata, loopback and private ranges', () => {
    for (const u of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:3001/',
      'http://localhost/',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.16.0.9/',
      'http://[::1]/',
      'http://internal-svc.internal/',
      'http://2130706433/',           // decimal-ish / single-label
    ]) {
      expect(isSafeOutboundUrl(u)).toBe(false);
    }
  });

  it('blocks non-http(s) schemes', () => {
    expect(isSafeOutboundUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeOutboundUrl('gopher://x/')).toBe(false);
    expect(isSafeOutboundUrl('ftp://example.com/')).toBe(false);
  });

  it('allows normal public URLs', () => {
    expect(isSafeOutboundUrl('https://ae01.alicdn.com/kf/x.jpg')).toBe(true);
    expect(isSafeOutboundUrl('https://photo.yupoo.com/store/abc.jpg')).toBe(true);
    expect(isSafeOutboundUrl('https://hook.eu2.make.com/abc')).toBe(true);
  });

  it('allowHost restricts to a single domain', () => {
    expect(isSafeOutboundUrl('https://x.yupoo.com/a', { allowHost: /(^|\.)yupoo\.com$/i })).toBe(true);
    expect(isSafeOutboundUrl('https://evil.com/a', { allowHost: /(^|\.)yupoo\.com$/i })).toBe(false);
    // allowHost must not let a look-alike through
    expect(isSafeOutboundUrl('https://yupoo.com.evil.com/a', { allowHost: /(^|\.)yupoo\.com$/i })).toBe(false);
  });

  it('assert throws on a blocked URL', () => {
    expect(() => assertSafeOutboundUrl('http://169.254.169.254/')).toThrow();
  });
});
