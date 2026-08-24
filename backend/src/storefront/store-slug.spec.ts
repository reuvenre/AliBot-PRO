import { RESERVED_SLUGS, isValidSlug, nextFreeSlug, slugError, slugify } from './store-slug';

describe('slugify', () => {
  it('transliterates Hebrew instead of percent-encoding it', () => {
    // The address gets read aloud, typed off a phone and printed into a post. A UTF-8
    // Hebrew slug becomes a 40-character escape sequence in the URL bar.
    expect(slugify('טקטי בקליק')).toBe('tkty-bklyk');
    expect(slugify('מאמא מותגים')).toBe('mama-mvtgym');
  });

  it('passes an English name through, lowercased', () => {
    expect(slugify('Hidden Brand')).toBe('hidden-brand');
    expect(slugify('Ali4you')).toBe('ali4you');
  });

  it('collapses punctuation, emoji and spaces into single separators', () => {
    expect(slugify('  Deal — Express!!  🔥  ')).toBe('deal-express');
    expect(slugify('a___b...c')).toBe('a-b-c');
  });

  it('never ends on a separator, however the name was cut', () => {
    expect(slugify('shop!!!')).toBe('shop');
    expect(slugify('x'.repeat(60))).toHaveLength(40);
    expect(slugify(`${'x'.repeat(39)} tail`).endsWith('-')).toBe(false);
  });

  it('gives an empty string for a name with nothing usable in it', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('slugError', () => {
  it('accepts an ordinary slug', () => {
    expect(slugError('hidden-brand')).toBeNull();
    expect(isValidSlug('deals2026')).toBe(true);
  });

  it('refuses a slug that would shadow a real page', () => {
    // A store at /pricing would break the pricing page AND be unreachable itself.
    for (const reserved of ['pricing', 'blog', 'r', 'login']) {
      expect(RESERVED_SLUGS.has(reserved)).toBe(true);
      expect(slugError(reserved)).toContain('שמורה');
    }
  });

  it('refuses anything that is not lowercase letters, digits and single hyphens', () => {
    expect(slugError('Hidden-Brand')).toContain('אותיות באנגלית');
    expect(slugError('hidden brand')).toContain('אותיות באנגלית');
    expect(slugError('hidden--brand')).toContain('אותיות באנגלית');
    expect(slugError('-hidden')).toContain('אותיות באנגלית');
    expect(slugError('hidden-')).toContain('אותיות באנגלית');
    expect(slugError('חנות')).toContain('אותיות באנגלית');
  });

  it('refuses a slug too short to be an address', () => {
    expect(slugError('ab')).toContain('קצרה');
    expect(slugError('')).toContain('קצרה');
  });

  it('refuses a slug past the length cap', () => {
    expect(slugError('a'.repeat(41))).toContain('ארוכה');
  });
});

describe('nextFreeSlug', () => {
  it('takes the name itself when it is free', () => {
    expect(nextFreeSlug('Hidden Brand', [])).toBe('hidden-brand');
  });

  it('suffixes rather than failing, so a first run lands on a working store', () => {
    expect(nextFreeSlug('Hidden Brand', ['hidden-brand'])).toBe('hidden-brand-2');
    expect(nextFreeSlug('Hidden Brand', ['hidden-brand', 'hidden-brand-2'])).toBe('hidden-brand-3');
  });

  it('steps around a reserved name too', () => {
    expect(nextFreeSlug('blog', [])).toBe('blog-2');
  });

  it('keeps the suffixed slug inside the length cap', () => {
    const long = 'x'.repeat(60);
    const out = nextFreeSlug(long, [slugify(long)]);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('-2')).toBe(true);
  });

  it('produces something usable from a name with nothing usable in it', () => {
    // "store" is itself reserved, so the fallback lands one past it.
    expect(nextFreeSlug('!!!', [])).toBe('store-2');
    // A short name gets a word rather than a number: a numbered slug should mean "taken".
    expect(nextFreeSlug('ab', [])).toBe('ab-store');
  });

  it('never returns a slug its own validator would reject', () => {
    for (const name of ['Hidden Brand', 'טקטי בקליק', '!!!', 'ab', 'x'.repeat(60), 'blog']) {
      expect(slugError(nextFreeSlug(name, ['hidden-brand']))).toBeNull();
    }
  });
});
