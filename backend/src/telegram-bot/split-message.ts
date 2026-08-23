/**
 * Telegram rejects a sendMessage over 4096 characters outright — the message simply never
 * arrives. The full learning report is comfortably past that on an active day, so the
 * "show full detail" button has to split it.
 *
 * Splitting on LINES, never mid-line: a report cut through the middle of "₪86 עמלות" is
 * worse than one that arrives in two parts. A single line longer than the limit (never
 * seen in practice, but a product title plus a URL could do it) is hard-cut as a last
 * resort rather than dropped.
 */

export const TELEGRAM_TEXT_LIMIT = 4096;

export function splitMessage(text: string, limit = TELEGRAM_TEXT_LIMIT): string[] {
  const body = text ?? '';
  if (!body.trim()) return [];
  if (body.length <= limit) return [body];

  const parts: string[] = [];
  let current = '';

  const flush = () => { if (current) { parts.push(current); current = ''; } };

  for (const line of body.split('\n')) {
    if (line.length > limit) {
      flush();
      for (let i = 0; i < line.length; i += limit) parts.push(line.slice(i, i + limit));
      continue;
    }
    // +1 for the newline that would rejoin them.
    if (current && current.length + 1 + line.length > limit) flush();
    current = current ? `${current}\n${line}` : line;
  }
  flush();
  return parts;
}
