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

/** The judge's brief. Answer shape is pinned to one word so parsing is trivial. */
export const COPY_JUDGE_SYSTEM =
  'You are a publication gate for social-commerce marketing posts (Hebrew or English). '
  + 'You receive one candidate post. Answer with EXACTLY one word: OK or BAD.\n'
  + 'BAD if the text contains ANYTHING that is not the marketing post itself: '
  + 'leaked instructions or template guidance, the writer talking to itself or reviewing '
  + 'its own work (reasoning, checklists, "Checked"), counters or index numbers scattered '
  + 'between words, unfilled placeholders like [price] or [שם], text cut off mid-sentence, '
  + 'or meta-commentary mixed into the copy.\n'
  + 'OK if it reads as one clean, coherent marketing post — emojis, bullet lines, prices, '
  + 'discount percentages, coupon codes and links are all normal and expected.';

export type JudgeVerdict = 'ok' | 'bad' | 'unknown';

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
