import { isBotAgent } from './bot-agents';

describe('isBotAgent', () => {
  it('catches the preview crawlers of the platforms we publish to', () => {
    // Each of these fetches a posted URL seconds after publishing, to build its card.
    const crawlers = [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'TelegramBot (like TwitterBot)',
      'WhatsApp/2.23.20.0 A',
      'Twitterbot/1.0',
      'Pinterest/0.2 (+https://www.pinterest.com/bot.html)',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
      'Slackbot-LinkExpanding 1.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0)',
    ];
    for (const ua of crawlers) expect(isBotAgent(ua)).toBe(true);
  });

  it('catches search engines and scripted fetches', () => {
    for (const ua of ['Googlebot/2.1', 'bingbot/2.0', 'python-requests/2.31.0', 'curl/8.4.0',
      'axios/1.6.0', 'Go-http-client/2.0', 'HeadlessChrome/120.0.0.0']) {
      expect(isBotAgent(ua)).toBe(true);
    }
  });

  it('lets real shoppers through', () => {
    const people = [
      // iPhone Safari — the single most common way these posts are opened.
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      // Android Chrome.
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      // Desktop Chrome and Firefox.
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    ];
    for (const ua of people) expect(isBotAgent(ua)).toBe(false);
  });

  it('treats a missing user-agent as automated', () => {
    // Real browsers always send one. What does not is a script or a health check, and
    // an uncounted real click costs far less than a counted crawler.
    expect(isBotAgent(undefined)).toBe(true);
    expect(isBotAgent(null)).toBe(true);
    expect(isBotAgent('')).toBe(true);
    expect(isBotAgent('   ')).toBe(true);
  });

  it('matches regardless of casing', () => {
    expect(isBotAgent('FACEBOOKEXTERNALHIT/1.1')).toBe(true);
    expect(isBotAgent('TeLeGrAmBoT')).toBe(true);
  });

  it('does not mistake an in-app browser for its crawler', () => {
    // The single most dangerous false positive: an app's in-app browser carries the app's
    // own name, and these are real people tapping a real post on the exact channels we
    // publish to. Filtering them would delete the traffic this whole loop measures.
    const inApp = [
      // Facebook in-app browser (FBAN/FBAV are the app shell, not the scraper).
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/442.0.0.32.108]',
      // Instagram in-app browser — note the bare word "Instagram".
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113 (iPhone14,3; iOS 16_6)',
      // Pinterest in-app browser — note the bare word "Pinterest".
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
      + '(KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]',
    ];
    for (const ua of inApp) expect(isBotAgent(ua)).toBe(false);
  });

  it('still catches the crawlers of those same apps', () => {
    expect(isBotAgent('Pinterest/0.2 (+https://www.pinterest.com/bot.html)')).toBe(true);
    expect(isBotAgent('WhatsApp/2.23.20.0 A')).toBe(true);
  });
});
