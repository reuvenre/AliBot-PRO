/**
 * Which learned category belongs in WHICH group.
 *
 * Order learning ranks categories account-wide, because that is the only level at which the
 * numbers exist (see order-learning.ts). But "sold well" and "belongs in this channel" are
 * different questions, and the engine used to answer only the first: every opted-in campaign
 * received the same global top-N, so a tactical-gear group, a general-deals group and a
 * mothers-and-brands group all converged on the same rotation and stopped being different
 * channels at all.
 *
 * So a candidate now has to clear a second gate: does it fit THIS group? The judge is the
 * account's own model (the campaign's name, its live rotation, the groups it publishes to),
 * with a deterministic vocabulary check behind it for when no model is reachable.
 *
 * The bias throughout is toward adding NOTHING. A missed winner costs one group a keyword it
 * can be given by hand; a bad one publishes off-brand products to a real audience every day
 * until someone notices.
 */

import { CategoryScore } from './order-learning';

/** Everything that says what a campaign IS — the material the fit judgement runs on. */
export interface CampaignProfile {
  name: string;
  /** The live rotation: the single strongest statement of what this group sells. */
  keywords: string[];
  /** Pulled from rotation for producing nothing — negative evidence about the niche. */
  retired: string[];
  /** Target groups, as "name — description". The audience in the owner's own words. */
  channels: string[];
  /** Keywords in this campaign that actually earned in the window — proven appetite. */
  earning: string[];
}

/** The judge's answer for one candidate category. */
export interface FitVerdict {
  keyword: string;
  fits: boolean;
  /** Short Hebrew justification, shown to the owner in the digest. */
  reason: string;
}

/** A candidate that cleared the gate, carrying its sales evidence. */
export interface FittedCategory extends CategoryScore {
  reason: string;
}

/** Candidates put in front of the judge per campaign — enough to choose from, small enough
 *  to stay one cheap call. */
export const MAX_FIT_CANDIDATES = 8;

/** Crude singulariser — "Knives"/"Knife" and "Products"/"Product" must not read as
 *  different words when one side of a comparison happens to be plural. */
const singular = (t: string) => t.replace(/(ies|es|s)$/, '');

/** Words that describe no niche, so they must never be what makes a candidate "fit".
 *  Stemmed to match, or "Pet Products" would fit any group on the word "product". */
const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'accessories', 'products', 'goods', 'other', 'new', 'sets',
  'parts', 'supplies', 'equipment', 'gadgets', 'tools', 'items', 'general', 'style',
].map(singular));

/** "Camping & Hiking" → ["camping", "hiking"] — comparable vocabulary, junk removed. */
export function tokenize(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9֐-׿]+/)
    .map(singular)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * The deterministic gate: does this candidate share real vocabulary with what the campaign
 * already sells?
 *
 * Deliberately narrow. It cannot tell that "Hunting" suits a tactical group by meaning — only
 * that the group's rotation literally talks about hunting. That is the right failure mode for
 * a fallback: it under-adds rather than repeating the bug it exists to prevent.
 */
export function lexicalFit(candidate: string, profile: CampaignProfile): boolean {
  const vocabulary = new Set<string>();
  // The NAME is excluded on purpose: "מוצרים כללי" or "אלי אקספרס" match everything and
  // would wave through exactly the off-brand additions this gate is here to stop.
  for (const source of [...(profile.keywords || []), ...(profile.earning || [])]) {
    for (const token of tokenize(source)) vocabulary.add(token);
  }
  if (!vocabulary.size) return false;

  const tokens = tokenize(candidate);
  if (!tokens.length) return false;
  // EVERY meaningful word must be known. "Pet Products" → ["pet"] passes for a pet group;
  // "Hunting Knives" needs both "hunting" and "knife" present, not a lucky one.
  return tokens.every((t) => vocabulary.has(t));
}

/** The judge's brief: this group, in its own terms, against the categories that sold. */
export function buildFitPrompt(profile: CampaignProfile, candidates: CategoryScore[]): string {
  const lines: string[] = [];
  lines.push(`GROUP NAME: ${profile.name}`);
  if (profile.channels.length) {
    lines.push('PUBLISHES TO:');
    for (const c of profile.channels) lines.push(`  - ${c}`);
  }
  lines.push(`CURRENTLY SELLS (live search keywords): ${profile.keywords.join(', ') || '(none)'}`);
  if (profile.earning.length) {
    lines.push(`PROVEN EARNERS IN THIS GROUP: ${profile.earning.join(', ')}`);
  }
  if (profile.retired.length) {
    // Negative evidence: these were tried here and produced nothing.
    lines.push(`DROPPED FROM THIS GROUP (produced nothing): ${profile.retired.join(', ')}`);
  }
  lines.push('');
  lines.push('CANDIDATE CATEGORIES (they sell well on the account overall — but account-wide,');
  lines.push('not necessarily to THIS group\'s audience):');
  for (const c of candidates) {
    lines.push(`  - ${c.keyword} (₪${c.commissionIls}, ${c.orders} orders)`);
  }
  lines.push('');
  lines.push(
    'For each candidate decide whether a product from that category, posted to THIS group, '
    + 'would look like it belongs there to a member of that audience.',
  );
  lines.push(
    'Answer ONLY with a JSON array, one object per candidate, in the order given:\n'
    + '[{"keyword":"<exact candidate>","fits":true|false,"reason":"<up to 8 words, Hebrew>"}]',
  );
  return lines.join('\n');
}

export const FIT_SYSTEM_PROMPT =
  'You decide whether a product category belongs in a specific shopping channel.\n'
  + 'Each channel has its own audience and its own character. A category that earns well '
  + 'across the whole account can still be plainly wrong for one channel — that is the '
  + 'normal case, not the exception.\n'
  + 'Judge by the audience the group already serves, which its live keywords and its group '
  + 'names describe. A broad, general-deals group can accept almost anything; a niche group '
  + 'accepts only what its niche would actually buy.\n'
  + 'Be strict. When you are unsure, answer false — a wrong category publishes off-brand '
  + 'products to real people every day, while a missed one costs nothing.\n'
  + 'Output JSON only. No prose, no code fences.';

/**
 * Read the judge's answer. Anything not clearly and affirmatively approved is treated as a
 * rejection, so a malformed or truncated reply degrades to "add nothing" instead of to
 * "add everything".
 */
export function parseFitVerdicts(text: string, candidates: CategoryScore[]): FitVerdict[] {
  const raw = String(text || '').trim().replace(/^```(?:json)?|```$/g, '').trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return [];

  let parsed: any;
  try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  // Match back to the real candidates: the model may echo a keyword with different casing,
  // and must never be able to introduce a category that was not on the ballot.
  const byKeyword = new Map(candidates.map((c) => [c.keyword.toLowerCase(), c.keyword]));
  const out: FitVerdict[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    const keyword = byKeyword.get(String(item?.keyword || '').trim().toLowerCase());
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push({
      keyword,
      fits: item?.fits === true,
      reason: String(item?.reason || '').trim().slice(0, 80),
    });
  }
  return out;
}

/**
 * The candidates this campaign may actually gain, best first.
 *
 * Ordered by what the group is likely to want — a category the group's own rotation already
 * proves an appetite for outranks a bigger account-wide earner it has no relationship with —
 * and only then by money. `claimed` holds the categories already handed to another campaign
 * in this same run: an equally-good candidate that no other group is taking wins the tie, so
 * the channels drift apart over time instead of converging on one winning list.
 */
export function rankFitted(
  candidates: CategoryScore[],
  verdicts: FitVerdict[],
  profile: CampaignProfile,
  claimed: Set<string>,
  max: number,
): FittedCategory[] {
  const byKeyword = new Map(candidates.map((c) => [c.keyword, c]));
  const scored = verdicts
    .filter((v) => v.fits && byKeyword.has(v.keyword))
    .map((v) => {
      const c = byKeyword.get(v.keyword)!;
      return {
        ...c,
        reason: v.reason,
        familiar: lexicalFit(v.keyword, profile) ? 1 : 0,
        fresh: claimed.has(v.keyword.toLowerCase()) ? 0 : 1,
      };
    });

  scored.sort((a, b) =>
    (b.familiar - a.familiar)
    || (b.fresh - a.fresh)
    || (b.commissionIls - a.commissionIls)
    || (b.orders - a.orders));

  return scored.slice(0, Math.max(0, max)).map(({ familiar, fresh, ...c }) => c);
}
