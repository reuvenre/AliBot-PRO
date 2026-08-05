/**
 * Remove an inline affiliate URL from a post body — WITH the link line it rode on.
 *
 * FLYLINK/custom copy arrives with the raw link already in the text ("🔗 https://…").
 * The send path replaces it with the tracked short link in the one standard 🔗 form —
 * but the old removal deleted only the URL substring, leaving the "🔗 " prefix behind
 * as an orphan emoji line. The published post then showed:
 *
 *     💰 ₪172
 *
 *     🔗            ← orphan (URL removed, emoji stayed)
 *
 *     🛒 לרכישה — לחצו כאן 🛒
 *
 * So after cutting the URL, any line reduced to just the link emoji (plus whitespace /
 * invisible RLM marks that tidyRtlBody may have added on a previous pass) is dropped
 * entirely, and blank-line runs are collapsed. Lines where the URL sat mid-sentence
 * keep their surrounding text untouched.
 */
export function stripInlineLink(text: string, url: string): string {
  const body = String(text || '');
  const target = String(url || '');
  if (!target || !body.includes(target)) return body;
  return body
    .split(target).join('')
    .split('\n')
    .filter((line) => !/^[\s‎‏]*🔗[\s‎‏]*$/u.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}
