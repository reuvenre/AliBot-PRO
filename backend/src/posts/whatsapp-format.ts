/**
 * Turn a post body (Telegram-flavoured HTML) into something WhatsApp renders properly.
 *
 * The send path used to just delete every tag. That is safe but lossy: WhatsApp has its
 * own inline markup, so a body that reads as a designed post on Telegram — bold title,
 * bold price, struck-through original price — arrived on WhatsApp as one flat grey block.
 * Same words, half the post.
 *
 * The link is the other half. WhatsApp has NO hyperlink markup — there is no way to hide a
 * URL behind "לרכישה — לחצו כאן" the way the Telegram anchor does; the client linkifies
 * bare URLs and nothing else. So instead of hiding it we FRAME it: a bold call-to-action
 * line, then the URL alone on its own line. That is the closest a WhatsApp message gets to
 * the Telegram button, and it also linkifies more reliably — a URL with text glued after
 * it is where clients start swallowing the last character into the anchor.
 */

/** Hebrew/Arabic anywhere in the body → the CTA speaks Hebrew. */
const NON_LATIN = /[֐-׿؀-ۿ]/;

/** Spaces, tabs and the invisible RTL marks tidyRtlBody sprinkles around a link line. */
const H_SPACE = '[ \\t\\u200e\\u200f]';

const CTA_HE = '🛒 לרכישה — לחצו על הקישור 👇';
const CTA_EN = '🛒 Tap the link to shop 👇';

/** `&amp;` in a WhatsApp message is just wrong — nothing decodes it downstream. */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&'); // last: an escaped &amp;lt; must not become '<'
}

/**
 * HTML body → WhatsApp text.
 *
 * `link` is the tracked short link when the caller has one; when the body already carries
 * it in the standard "🔗 <url>" form (every post built by buildPostBody does) that line is
 * replaced in place, so the CTA lands exactly where the link already sat.
 */
export function toWhatsAppText(html: string): string {
  let text = String(html || '');

  // Structural tags first — <br> and </p> are line breaks, not nothing.
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '');

  // Inline markup → WhatsApp's own. Anchors keep the visible text and append the href
  // only when it isn't already spelled out in the body (an anchor whose text IS the URL
  // is the common case and must not print twice).
  text = text.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, label: string) => {
      const clean = label.replace(/<[^>]+>/g, '').trim();
      if (!clean || clean === href) return href;
      return `${clean}\n${href}`;
    });
  text = text
    .replace(/<\/?(?:b|strong)>/gi, '*')
    .replace(/<\/?(?:i|em)>/gi, '_')
    .replace(/<\/?(?:s|del|strike)>/gi, '~')
    .replace(/<\/?(?:code|pre)>/gi, '`');

  // Anything left is a tag WhatsApp can't use.
  text = decodeEntities(text.replace(/<[^>]+>/g, ''));

  // Markdown leftovers from copy written for other channels: WhatsApp uses ONE marker per
  // side, and a doubled one renders as a stray character next to the word.
  text = text.replace(/~~([^~\n]+)~~/g, '~$1~').replace(/\*\*([^*\n]+)\*\*/g, '*$1*');

  // The standard link line → CTA + bare URL on its own line.
  const cta = NON_LATIN.test(text) ? CTA_HE : CTA_EN;
  text = text.replace(
    new RegExp(`^${H_SPACE}*🔗${H_SPACE}*(https?://\\S+)${H_SPACE}*$`, 'gmu'),
    (_m, url: string) => `*${cta}*\n${url}`,
  );

  // WhatsApp collapses nothing — three blank lines stay three blank lines.
  return text.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}
