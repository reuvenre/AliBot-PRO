/**
 * Which autopilots a bonus pool is allowed to steer.
 *
 * A pool's keywords do not merely join a campaign's rotation — they join it BOOSTED (a live
 * pool gets a proven keyword's emphasis, a pool that already sold gets the top tier). So a
 * pool aimed at the wrong campaign does not cost one post: it takes the best slots in the
 * cycle and spends them on products that audience did not come for.
 *
 * The original rule was "empty = every campaign", which made the fan-out the DEFAULT. Add a
 * Home & Living pool, leave the picker untouched, and "kitchen organizer" starts publishing
 * into a tactical-gear channel with double emphasis — the exact failure the runner's own
 * comment warns about, arrived at by doing nothing. Off-theme posts in a niche group do not
 * just earn nothing; they cost the slot a fitting product would have had.
 *
 * So an unassigned pool now steers NOTHING. It is still recorded, still reminds, still
 * reports its bonus estimate — recording the money is separate from chasing it. A fan-out
 * across every campaign remains available and is what the `*` sentinel means: the owner
 * saying it, rather than the system assuming it.
 */

/** Stored in `target_campaigns` to mean "every campaign". An explicit choice, not a default. */
export const ALL_CAMPAIGNS = '*';

/** The stored JSON as a list of ids. Anything unreadable is an empty list — a corrupt row
 *  must steer nothing, never everything. */
export function parsePoolTargets(raw: string | null | undefined): string[] {
  try {
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map((v) => String(v ?? '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * May this pool steer this campaign?
 *
 * `channels` are the campaign's own target groups, and they are checked because the FIRST
 * version of the picker stored Telegram GROUP ids in this column. A row saved from a
 * still-cached old page would otherwise match nothing and silently steer no campaign at all.
 */
export function poolAppliesTo(
  raw: string | null | undefined, campaignId: string, channels: string[] = [],
): boolean {
  const targets = parsePoolTargets(raw);
  if (targets.includes(ALL_CAMPAIGNS)) return true;
  if (!targets.length) return false;                       // unassigned → records only
  if (campaignId && targets.includes(campaignId)) return true;
  return targets.some((t) => channels.includes(t));        // legacy group ids
}
