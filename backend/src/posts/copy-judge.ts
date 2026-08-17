/**
 * The LAST gate between the copywriter model and a real channel — an AI judge.
 *
 * copyDefect (copy-guard.ts) catches known defect shapes deterministically, but the model
 * keeps inventing new ones: a leaked scratchpad (30/07), word-index numbering (06/08), a
 * self-review checklist (07/08). Each was added to the pattern list only AFTER followers
 * saw it. This judge is the pattern-independent backstop: a second, tiny AI call that
 * answers one question — "is this a clean marketing post?" — so a NOVEL defect shape is
 * caught the first time, not the second.
 *
 * Fail-open by design: a judge error, timeout or unparseable answer ACCEPTS the draft.
 * The deterministic patterns already passed it, and a broken judge must never be the
 * reason a post didn't go out.
 */

/** The judge's brief. The answer shape is pinned so parsing stays trivial — and it now
 *  carries WHICH criterion fired, because a bare verdict left nothing to act on. */
export const COPY_JUDGE_SYSTEM =
  'You are a publication gate for social-commerce marketing posts (Hebrew or English). '
  + 'You receive one candidate post. Answer "OK", or "BAD <reason>" where <reason> is ONE '
  + 'word from: leaked, selfreview, numbering, placeholder, truncated, meta, other. '
  + 'Nothing else.\n'
  + 'BAD if the text contains ANYTHING that is not the marketing post itself: '
  + 'leaked instructions or template guidance, the writer talking to itself or reviewing '
  + 'its own work (reasoning, checklists, "Checked"), counters or index numbers scattered '
  + 'between words, unfilled placeholders like [price] or [שם], text cut off mid-sentence, '
  + 'or meta-commentary mixed into the copy.\n'
  + 'OK if it reads as one clean, coherent marketing post — emojis, bullet lines, prices, '
  + 'discount percentages, coupon codes and links are all normal and expected.';

/**
 * Style note appended for PINTEREST-style drafts. The pin format is deliberately
 * different from a feed post — a bare keyword-rich Title Case line, a blank line,
 * a few helpful SEO sentences, a final hashtags line — and the base judge read that
 * structure as "not a marketing post" and rejected EVERY pin draft at temperature 0
 * (issue #51: the Pinterest campaign silently produced nothing for hours).
 */
export const COPY_JUDGE_PINTEREST_NOTE =
  '\nNote: this candidate is a PINTEREST PIN. The pin format is: a plain keyword-rich '
  + 'product-title line (Title Case, no emoji), an empty line, 2-3 helpful SEO sentences '
  + 'with a price and a short call-to-action, and a final line of hashtags. That structure '
  + 'IS the marketing post — judge only for leaked instructions, self-review, placeholders, '
  + 'or truncation, exactly as above.';

export type JudgeVerdict = 'ok' | 'bad' | 'unknown';

/** The reason words the judge is allowed to give, mapped to something a human reads. */
const REASONS: Record<string, string> = {
  leaked: 'הודלפו הוראות מהפרומפט',
  selfreview: 'המודל סוקר את עצמו בתוך הטקסט',
  numbering: 'מספור/מונים שזלגו לתוך הטקסט',
  placeholder: 'נשארו מצייני מקום ([מחיר] וכד׳)',
  truncated: 'הטקסט נקטע באמצע',
  meta: 'הערות מטא מעורבבות בקופי',
  other: 'פסילה כללית של השופט',
};

/**
 * The judge's answer, split into verdict + a human-readable reason.
 *
 * "ai judge: not clean marketing copy" told nobody anything — when a campaign produced 0
 * posts for hours, the error named the gate but not the defect, so there was nothing to
 * act on. The judge now names which of its own criteria fired.
 */
export function parseJudgeAnswer(raw: string | null | undefined): { verdict: JudgeVerdict; reason: string } {
  const verdict = parseJudgeVerdict(raw);
  if (verdict !== 'bad') return { verdict, reason: '' };
  const word = String(raw || '').trim().toUpperCase().replace(/^BAD[\s:._-]*/, '').split(/[\s.,]/)[0].toLowerCase();
  return { verdict, reason: REASONS[word] || REASONS.other };
}

/**
 * Parse the judge's raw answer. Anything that doesn't clearly start with BAD/OK is
 * 'unknown' — which the caller treats as a pass (fail-open).
 */
export function parseJudgeVerdict(raw: string | null | undefined): JudgeVerdict {
  const answer = String(raw || '').trim().toUpperCase();
  if (!answer) return 'unknown';
  if (answer.startsWith('BAD')) return 'bad';
  if (answer.startsWith('OK')) return 'ok';
  return 'unknown';
}
