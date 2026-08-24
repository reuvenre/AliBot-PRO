/**
 * The address a customer's public storefront lives at: nexlify.win-solutions.co.il/s/<slug>.
 *
 * A slug is chosen once and then printed into every post that ever links to the store, so
 * it has to be stable, unambiguous and impossible to confuse with an existing route. All
 * three concerns are decided here rather than at the call site, and tested — a slug that
 * collides with a real page would make the store unreachable AND break that page.
 */

/**
 * Route names the public site already owns. A store may never take one: `/s/blog` is
 * fine, but the storefront lives under /s/ precisely so this list stays short and the
 * marketing pages stay safe.
 */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'blog', 'compare', 'dashboard', 'login', 'logout',
  'new', 'pricing', 'privacy', 'r', 'register', 'robots', 'settings', 'sitemap',
  'store', 's', 'support', 'terms', 'www',
]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/**
 * A name turned into a URL-safe slug.
 *
 * Hebrew is transliterated rather than percent-encoded: "טקטי בקליק" as UTF-8 in a URL
 * becomes an unreadable 40-character escape sequence, and this address is meant to be
 * read aloud, typed from a phone screen and printed in a post.
 */
const HEBREW: Record<string, string> = {
  א: 'a', ב: 'b', ג: 'g', ד: 'd', ה: 'h', ו: 'v', ז: 'z', ח: 'ch', ט: 't', י: 'y',
  כ: 'k', ך: 'k', ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: 'a', פ: 'p',
  ף: 'f', צ: 'tz', ץ: 'tz', ק: 'k', ר: 'r', ש: 'sh', ת: 't',
};

export function slugify(input: string): string {
  const raw = String(input || '').trim().toLowerCase();
  let out = '';
  for (const ch of raw) {
    if (/[a-z0-9]/.test(ch)) { out += ch; continue; }
    if (HEBREW[ch]) { out += HEBREW[ch]; continue; }
    // Everything else — spaces, punctuation, emoji, other scripts — becomes one separator.
    if (!out.endsWith('-')) out += '-';
  }
  return out.replace(/^-+|-+$/g, '').slice(0, SLUG_MAX).replace(/-+$/g, '');
}

/** Why this slug can't be used, or null when it can. */
export function slugError(slug: string): string | null {
  const s = String(slug || '');
  // Reserved first: "that name belongs to the system" is the useful answer even for a
  // short one like `r`, where a length complaint would send the owner off to lengthen it.
  if (RESERVED_SLUGS.has(s)) return 'הכתובת הזו שמורה למערכת — בחר אחרת';
  if (s.length < SLUG_MIN) return `הכתובת קצרה מדי — לפחות ${SLUG_MIN} תווים`;
  if (s.length > SLUG_MAX) return `הכתובת ארוכה מדי — עד ${SLUG_MAX} תווים`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    return 'הכתובת יכולה להכיל רק אותיות באנגלית, ספרות ומקפים';
  }
  return null;
}

export const isValidSlug = (slug: string): boolean => slugError(slug) === null;

/**
 * A free slug near the one asked for: `tactical`, then `tactical-2`, `tactical-3`…
 *
 * Suffixing beats rejecting on a first-run default, where the name came from the account
 * rather than from a deliberate choice — the owner should land on a working store and
 * rename it later, not on an error.
 */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const seed = slugify(base);
  const used = new Set(taken);
  const fits = (s: string) =>
    s.length >= SLUG_MIN && s.length <= SLUG_MAX && !used.has(s) && !RESERVED_SLUGS.has(s);
  if (fits(seed)) return seed;

  // Too short (or empty) to be an address on its own — "ab" becomes "ab-store", nothing
  // usable at all becomes "store". Try that before reaching for a number: a numbered slug
  // should mean "this name was taken", not "your name was short".
  const stem = (seed.length >= SLUG_MIN ? seed : `${seed ? `${seed}-` : ''}store`)
    .slice(0, SLUG_MAX).replace(/-+$/, '');
  if (fits(stem)) return stem;

  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const candidate = `${stem.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (fits(candidate)) return candidate;
  }
  // 998 stores sharing one name is not a real scenario; a distinct fallback beats a throw.
  return `${stem.slice(0, SLUG_MAX - 7).replace(/-+$/, '')}-${Date.now().toString(36).slice(-5)}`;
}
