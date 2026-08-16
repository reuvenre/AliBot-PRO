/**
 * Performance-weighted keyword rotation.
 *
 * The autopilot walked its keyword list with a blind cursor, so a keyword that had never
 * produced a single click got exactly the same airtime as one that sells — forever. On the
 * "טקטי בקליק" campaign that meant 38 keywords sharing the slots equally while 74% of posts
 * drew zero clicks.
 *
 * This biases the rotation instead of replacing it: proven keywords get extra slots, and
 * EVERY keyword keeps at least one. That matters for two reasons — a keyword with no history
 * is unproven rather than bad (it still needs a chance to be measured), and retiring a
 * keyword outright is the optimizer's job, where it is capped, visible and reversible. The
 * rotation only decides emphasis.
 */

/** What a keyword produced inside the scoring window. */
export interface KeywordPerformance {
  posts: number;
  clicks: number;
  revenue: number;
}

/** Slots a keyword may hold in one cycle. 1 = floor (nothing is ever silenced). */
const WEIGHT_DEAD = 1;
const WEIGHT_UNPROVEN = 1;
const WEIGHT_CLICKED = 2;
const WEIGHT_EARNING = 3;

/** Posts a keyword needs before "no clicks" means anything. Matches the optimizer's bar. */
const MIN_POSTS_TO_JUDGE = 5;

/** How many slots this keyword earns in one cycle. */
export function keywordWeight(perf?: KeywordPerformance): number {
  if (!perf) return WEIGHT_UNPROVEN;
  if (perf.revenue > 0) return WEIGHT_EARNING;
  if (perf.clicks > 0) return WEIGHT_CLICKED;
  // A fair chance and nothing to show for it → floor, not silence.
  if (perf.posts >= MIN_POSTS_TO_JUDGE) return WEIGHT_DEAD;
  return WEIGHT_UNPROVEN;
}

/**
 * The rotation list the cursor walks: each keyword repeated by its weight, with the copies
 * SPREAD evenly across the cycle rather than sorted by score.
 *
 * Spreading matters in the channel: publishing a keyword's posts back-to-back reads as
 * repetition to subscribers and makes those posts compete with each other in search. So a
 * keyword holding 3 of 7 slots gets them at roughly even spacing instead of consecutively.
 * Each copy is placed at its fractional position through the cycle — copy j of weight w sits
 * at (j + ½)/w — and the list is the copies in position order, ties broken by the keyword's
 * original position so the result is deterministic.
 */
export function weightedRotation(
  keywords: string[], scores: Map<string, KeywordPerformance>, boosted?: Set<string>,
): string[] {
  const unique = Array.from(new Set(keywords.map((k) => k?.trim()).filter(Boolean)));
  if (!unique.length) return [];

  // BOOSTED keywords (a live AliExpress bonus pool) are worth more PER SALE than anything
  // else this campaign could publish, so they get a proven keyword's emphasis instead of an
  // unproven one's floor — otherwise a freshly added pool sits one slot deep in a long
  // cycle and the owner sees no change for days, which is most of a monthly pool's life.
  // Bounded on purpose: a boost, never a takeover — a keyword that actually EARNS still
  // outranks it, and every other keyword keeps its slot.
  const boost = new Set(Array.from(boosted || []).map((k) => k.trim().toLowerCase()));

  const slots: Array<{ keyword: string; at: number; index: number }> = [];
  unique.forEach((keyword, index) => {
    const weight = Math.max(
      keywordWeight(scores.get(keyword)),
      boost.has(keyword.toLowerCase()) ? WEIGHT_CLICKED : 0,
    );
    for (let j = 0; j < weight; j++) {
      slots.push({ keyword, at: (j + 0.5) / weight, index });
    }
  });

  slots.sort((a, b) => (a.at - b.at) || (a.index - b.index));
  return slots.map((s) => s.keyword);
}
