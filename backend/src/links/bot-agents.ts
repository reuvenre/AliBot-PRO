/**
 * Telling a shopper apart from a link preview crawler.
 *
 * Every platform we publish to fetches a posted URL to build its preview card — Facebook,
 * Telegram, WhatsApp and Twitter all do it, within seconds of publishing and before any
 * human has seen the post. Those fetches hit /r/<code> exactly like a click does.
 *
 * That matters more than it sounds. Clicks are the fast half of the learning loop: the
 * optimizer retires a keyword that drew none and boosts one that drew many. Counting
 * crawlers would give every post a click it never earned, and the engine would then be
 * tuning the rotation on its own preview traffic.
 *
 * The redirect itself is never affected — a crawler still gets its 302 and still builds its
 * card. Only the bookkeeping ignores it.
 */

/**
 * Substrings that identify an automated fetch, matched case-insensitively.
 *
 * These name CRAWLERS, never the brands behind them. An app's in-app browser puts the app's
 * name in the user-agent too — "Instagram 105.0.0.11" and "[Pinterest/iOS]" are real people
 * tapping a real post — so a bare brand name here would silently delete the traffic from
 * exactly the channels we publish to. Every entry has to be something only a robot sends.
 */
const BOT_SIGNATURES = [
  // The platforms we publish to, fetching their own preview cards.
  'facebookexternalhit', 'facebookcatalog', 'facebot',
  'telegrambot', 'whatsapp/', 'twitterbot', 'pinterestbot', 'linkedinbot',
  'slackbot', 'discordbot', 'skypeuripreview', 'vkshare', 'redditbot',
  'googlebot', 'bingbot', 'yandex', 'baiduspider', 'duckduckbot', 'applebot',
  'embedly', 'quora link preview', 'outbrain', 'w3c_validator',
  // Generic automation: monitors, scrapers, and anything that says so outright.
  'bot', 'crawler', 'spider', 'preview', 'scraper', 'fetcher', 'monitor',
  'headlesschrome', 'phantomjs', 'python-requests', 'curl/', 'wget',
  'axios/', 'go-http-client', 'java/', 'okhttp', 'libwww-perl',
];

/**
 * Is this fetch automated rather than a person tapping a link?
 *
 * A MISSING user-agent counts as a bot. Real browsers always send one; the things that
 * don't are scripts and health checks. The bias is deliberate: an uncounted real click
 * costs one data point, while a counted crawler teaches the optimizer something false
 * about every post it ever published.
 */
export function isBotAgent(userAgent?: string | null): boolean {
  const ua = String(userAgent || '').trim().toLowerCase();
  if (!ua) return true;
  return BOT_SIGNATURES.some((sig) => ua.includes(sig));
}
