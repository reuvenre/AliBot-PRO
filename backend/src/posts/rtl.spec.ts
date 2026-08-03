import { containsHebrew, tidyRtlBody } from './rtl';

const RLM = '‏';

describe('tidyRtlBody', () => {
  it('pins an emoji-opening line to the right', () => {
    // "💰 ₪176" has no strong character before... any at all — neutral emoji, ₪ and
    // digits — so Telegram rendered it LEFT-aligned inside a Hebrew post.
    const out = tidyRtlBody('מוצר מעולה\n💰 ₪176');
    expect(out.split('\n')[1].startsWith(RLM)).toBe(true);
  });

  it('pins a link line to the right', () => {
    // The first strong char in "🔗 https://…" is the Latin 'h' → the whole line went LTR.
    const out = tidyRtlBody('שורה בעברית\n🔗 https://nexlify.example/r/abc');
    expect(out.split('\n')[1].startsWith(RLM)).toBe(true);
  });

  it('leaves a Hebrew-opening line untouched', () => {
    const out = tidyRtlBody('סט ספורט אלגנטי\nעוד שורה בעברית');
    for (const line of out.split('\n')) expect(line.startsWith(RLM)).toBe(false);
  });

  it('sees through an opening HTML tag', () => {
    // A line may open with <b>עברית</b> — the tag's Latin letters must not read as the
    // line's direction; the visible first strong char is the Hebrew inside.
    const out = tidyRtlBody('<b>מבצע חם</b> עכשיו\nשורה');
    expect(out.split('\n')[0].startsWith(RLM)).toBe(false);
  });

  it('collapses blank-line runs to a single blank line', () => {
    expect(tidyRtlBody('שורה\n\n\n\nשורה שנייה')).toBe('שורה\n\nשורה שנייה');
  });

  it('strips leading and trailing spaces per line', () => {
    // Stray indentation reads as random gaps in the channel — the "רווחים מיותרים".
    expect(tidyRtlBody('  שורה עם רווחים  \nשנייה')).toBe('שורה עם רווחים\nשנייה');
  });

  it('does not double-mark a line that already carries the mark', () => {
    const once = tidyRtlBody('עברית\n💰 מחיר');
    expect(tidyRtlBody(once)).toBe(once);
  });

  it('leaves an English post completely untouched', () => {
    // An English Pinterest body must not grow invisible RTL marks.
    const en = 'Great product!\n\n\nOnly $5 — https://example.com';
    expect(tidyRtlBody(en)).toBe(en);
  });
});

describe('containsHebrew', () => {
  it('detects Hebrew anywhere in the text', () => {
    expect(containsHebrew('hello שלום')).toBe(true);
    expect(containsHebrew('hello world')).toBe(false);
    expect(containsHebrew('')).toBe(false);
  });
});
