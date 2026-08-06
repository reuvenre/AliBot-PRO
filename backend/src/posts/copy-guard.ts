/**
 * Last line of defence between the copywriter model and a real channel.
 *
 * On 30/07 a post published to the "טקטי בקליק" group carried the model's own scratchpad
 * instead of copy — it quoted Nexlify's system prompt back, deliberated in English about
 * what the instructions meant, and was cut off mid-word:
 *
 *   תיק טקטי מתקפל ועמיד לפעילויות חוץ וטיולים".
 *       Wait, what if the instruction literally means: fill `[מחיר]`, but keep the structure…
 *       Let's re-read:
 *       "• שכפל/י את נוסח התבנית שלמעלה מילה במילה — כולל השור
 *
 * generateText only checked for an EMPTY response, so anything else went straight out under
 * the owner's affiliate identity. These checks are deliberately narrow — a false positive
 * silently downgrades good AI copy to the deterministic fallback — so each pattern is a
 * multi-word phrase that cannot plausibly appear in marketing copy.
 */

/** Fragments of our OWN system prompt: the model echoed instructions instead of following them. */
const PROMPT_LEAK: string[] = [
  'שכפל/י את נוסח התבנית',
  'הוראות מערכת',
  'מצייני מיקום',
  'החזר/החזירי רק את הפוסט',
  'קישור השותפים יצורף אוטומטית',
  'reproduce the template',
  'system instructions (override',
];

/** Deliberation the model was supposed to keep to itself. */
const THINKING: RegExp[] = [
  /\bwait,\s*(what|but|let|the|so)\b/i,
  /\blet'?s\s+re-?read\b/i,
  /\blet\s+me\s+(re-?read|reconsider|rethink|check|think)\b/i,
  /\bthe\s+instruction\s+(literally|says|means)\b/i,
  /\bwhat\s+if\s+the\s+instruction\b/i,
  /\bactually,\s*let\s+me\b/i,
  /\bon\s+second\s+thought\b/i,
];

/** A placeholder the template asked the model to FILL. Left bracketed, the reader sees
 *  "[מחיר]₪ בלבד" — the skeleton was copied without substituting the real values. */
const UNFILLED_PLACEHOLDER = /\[(?:מחיר|שם|price|name|product|title)\]/i;

/** Shorter than this isn't a post, whatever it is. */
const MIN_USABLE_LENGTH = 20;

/**
 * Degenerate word-index numbering: the model interleaves an ascending counter between the
 * words — "₪7 (76) בלבד (77) במקום (78) ₪17 (79)…" (published verbatim to מאמא on 06/08).
 * Real copy does contain parenthesised numbers ("(56% הנחה)", "(2)"), so a count alone
 * would false-positive; what marketing copy can never plausibly contain is FIVE bare
 * integers in parentheses forming a consecutive ascending run.
 */
function hasWordIndexNumbering(text: string): boolean {
  const nums = Array.from(text.matchAll(/\((\d{1,4})\)/g)).map((m) => Number(m[1]));
  if (nums.length < 5) return false;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

/**
 * Why this generated copy must not be published, or null when it is usable.
 * The reason is a short English tag meant for the log line, not for the owner.
 */
export function copyDefect(text: string): string | null {
  const t = (text || '').trim();
  if (!t) return 'empty';
  if (t.length < MIN_USABLE_LENGTH) return 'too short';

  const lower = t.toLowerCase();
  for (const marker of PROMPT_LEAK) {
    if (lower.includes(marker.toLowerCase())) return `prompt leaked ("${marker}")`;
  }
  for (const re of THINKING) {
    const hit = t.match(re);
    if (hit) return `model reasoning ("${hit[0]}")`;
  }
  if (UNFILLED_PLACEHOLDER.test(t)) return 'unfilled placeholder';
  if (hasWordIndexNumbering(t)) return 'word-index numbering';

  return null;
}
