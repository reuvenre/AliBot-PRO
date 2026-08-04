import { normalizeClickSource, tagShortLinks } from './click-source';

describe('normalizeClickSource', () => {
  it('accepts every known platform tag', () => {
    for (const s of ['tg', 'fb', 'ig', 'pin', 'wa']) {
      expect(normalizeClickSource(s)).toBe(s);
    }
    expect(normalizeClickSource(' TG ')).toBe('tg'); // trimmed + case-insensitive
  });

  it('rejects anything else — arbitrary query values never reach the DB', () => {
    expect(normalizeClickSource('facebook')).toBeNull();
    expect(normalizeClickSource('<script>')).toBeNull();
    expect(normalizeClickSource('')).toBeNull();
    expect(normalizeClickSource(undefined)).toBeNull();
  });
});

describe('tagShortLinks', () => {
  const body = 'מוצר מדהים!\n🔗 https://nexlify.app/r/Ab12Cd34\nמחיר: ₪99';

  it('tags the short link with the publishing platform', () => {
    expect(tagShortLinks(body, 'tg')).toContain('https://nexlify.app/r/Ab12Cd34?s=tg');
  });

  it('is idempotent — a retried body is never double-tagged', () => {
    const once = tagShortLinks(body, 'fb');
    expect(tagShortLinks(once, 'fb')).toBe(once);
  });

  it('leaves non-short links alone (raw affiliate fallback must not change)', () => {
    const raw = '🔗 https://s.click.aliexpress.com/e/_abc123';
    expect(tagShortLinks(raw, 'tg')).toBe(raw);
  });

  it('tags a bare short URL string (the Facebook link param)', () => {
    expect(tagShortLinks('https://nexlify.app/r/Zz99', 'fb')).toBe('https://nexlify.app/r/Zz99?s=fb');
  });

  it('keeps an existing query untouched', () => {
    const tagged = 'https://nexlify.app/r/Zz99?s=tg';
    expect(tagShortLinks(tagged, 'fb')).toBe(tagged);
  });

  it('handles empty input', () => {
    expect(tagShortLinks('', 'tg')).toBe('');
  });
});
