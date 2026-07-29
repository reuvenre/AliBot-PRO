import type { WatchdogAlert } from './watchdog.service';

/** Above this many lines the DM gets a summary tail instead of the full list. */
export const MAX_TELEGRAM_DETAILS = 8;

/**
 * Build the owner's Telegram DM for a detected problem.
 *
 * Plain text on purpose — the DM is sent without parse_mode, so any markdown from the
 * GitHub body would render literally. The list is capped because a wide outage (dozens of
 * campaigns) would otherwise exceed Telegram's message limit and be rejected, turning the
 * largest incidents into no alert at all.
 */
export function formatTelegramAlert(a: WatchdogAlert): string {
  const details = a.details ?? [];
  const shown = details.slice(0, MAX_TELEGRAM_DETAILS);
  const rest = details.length - shown.length;

  return [
    '⚠️ Nexlify Watchdog זיהה תקלה:',
    '',
    a.title,
    ...(shown.length ? ['', ...shown.map((d) => `• ${d}`)] : []),
    ...(rest > 0 ? [`• ועוד ${rest}…`] : []),
    '',
    a.action
      ? `🔧 נדרשת פעולה שלך:\n${a.action}`
      : 'נפתח Issue אוטומטי ב-GitHub — Claude יטפל בבדיקה הקרובה, ותקבל כאן אישור "✅ טופל" כשזה ייסגר.',
  ].join('\n');
}
