/**
 * Which PLATFORM a short-link click came from.
 *
 * The same post — and the same /r/<code> link — goes out to Telegram, Facebook, Instagram,
 * Pinterest and WhatsApp at once, so a bare click can't say where it happened. Referrer and
 * user-agent only half-help: Facebook/Instagram in-app browsers are identifiable, but
 * Telegram's in-app browser leaves no marker at all. So instead of guessing, each platform's
 * send path TAGS the link it publishes (`?s=tg`, `?s=fb`, …) and the click handler records
 * the tag. Deterministic, and works identically for every platform.
 */

/** Everything a send path may tag a link with. The click recorder accepts nothing else. */
export const CLICK_SOURCES = ['tg', 'fb', 'ig', 'pin', 'wa'] as const;
export type ClickSource = (typeof CLICK_SOURCES)[number];

/**
 * Validate a raw `?s=` value from the wire. Unknown/absent → null (stored as "untagged",
 * shown as "לא מזוהה") — never trust arbitrary query strings into the DB.
 */
export function normalizeClickSource(raw?: string | null): ClickSource | null {
  const v = String(raw || '').trim().toLowerCase();
  return (CLICK_SOURCES as readonly string[]).includes(v) ? (v as ClickSource) : null;
}

/**
 * Stamp every short link in a post body with the platform it is being published to.
 *
 * Only OUR short links (`…/r/<code>`) are touched — the raw affiliate fallback and any
 * other URL pass through unchanged. A link that already carries a query keeps it
 * (idempotent: re-tagging a retried body never produces `?s=tg?s=tg`).
 */
export function tagShortLinks(text: string, source: ClickSource): string {
  return String(text || '').replace(
    /(https?:\/\/[^\s"'<>()]+\/r\/[A-Za-z0-9]+)(\?[^\s"'<>()]*)?/g,
    (whole, base: string, query: string | undefined) => (query ? whole : `${base}?s=${source}`),
  );
}
