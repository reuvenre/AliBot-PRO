/**
 * Keeping a Hebrew post visually Hebrew.
 *
 * Telegram (and every Unicode-bidi renderer) decides each LINE's direction by the first
 * STRONG directional character in it. Hebrew is strong-RTL, Latin is strong-LTR — and
 * emoji, digits, ₪, punctuation are neutral. So in a Hebrew post, any line that opens with
 * an emoji, a price, or a link ("🔗 https://…", "💰 ₪176") has no Hebrew before its first
 * Latin character and silently renders LEFT-aligned, breaking the post's shape line by
 * line. The owner sees a ragged mix and calls it, correctly, not aligned.
 *
 * The fix is the Unicode one: prefix such lines with U+200F (RIGHT-TO-LEFT MARK) — an
 * invisible strong-RTL character that wins the "first strong char" contest and pins the
 * line to the right. Lines that already start with Hebrew need nothing and get nothing.
 *
 * Also tidies the whitespace the copy model tends to produce: trailing spaces and runs of
 * blank lines, which read as random gaps in the channel.
 */

const RLM = '‏';

/** Does this text contain Hebrew at all? English posts must be left exactly alone. */
export function containsHebrew(text: string): boolean {
  return /[֐-׿]/.test(String(text || ''));
}

/** The first strong-directional character, ignoring HTML tags (a line may open with <b>). */
function firstStrongChar(line: string): string | null {
  const visible = line.replace(/<\/?[^>]+>/g, '');
  const m = visible.match(/[A-Za-z֐-׿]/);
  return m ? m[0] : null;
}

/**
 * Normalize a Hebrew post body for publishing:
 *  • every line renders right-aligned (RLM on lines whose first strong char isn't Hebrew,
 *    including lines with no strong char at all — a bare "🔗" line still aligns);
 *  • no trailing whitespace on any line;
 *  • at most one blank line between paragraphs.
 *
 * Text with no Hebrew is returned untouched — an English Pinterest post must not grow
 * invisible RTL marks.
 */
export function tidyRtlBody(text: string): string {
  const raw = String(text || '');
  if (!containsHebrew(raw)) return raw;

  const lines = raw.split('\n').map((line) => {
    const trimmed = line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '');
    if (!trimmed) return '';
    if (trimmed.startsWith(RLM)) return trimmed;
    const strong = firstStrongChar(trimmed);
    if (strong && /[֐-׿]/.test(strong)) return trimmed;
    return RLM + trimmed;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
