/**
 * Why a FLYLINK product must not be published twice at once.
 *
 * A product can reach the posts table from TWO independent doors: the owner queues or
 * schedules it by hand from the catalog, and the FLYLINK campaign rotates the same catalog
 * on its own cron. Neither door used to look at the other, so the same POLO shirt ended up
 * sent once and sitting in the queue again — the "שוכפלו לבד" bug. The campaign side is
 * closed by group-level dedup in the runner; this module closes the manual side: before
 * queueing/scheduling, check whether an OPEN post (queued / scheduled / pending — created
 * but not yet published) already covers any of the requested groups.
 *
 * Only OPEN posts block. A product that was already SENT may be pushed again on purpose —
 * that's the repost feature — so history never blocks, only work that is still in flight.
 */

/** The two columns that say where a post will be delivered. */
export interface PostChannelFields {
  channel_override?: string | null;
  channel_overrides?: string | null; // JSON array when the post fans out to several groups
}

/**
 * The group ids a post will be delivered to. Multi-target JSON wins; the single override is
 * the fallback; an empty result means "the account's default channel".
 */
export function postTargetChannels(post: PostChannelFields): string[] {
  let list: unknown = [];
  try { list = post.channel_overrides ? JSON.parse(post.channel_overrides) : []; } catch { list = []; }
  const parsed = Array.isArray(list)
    ? list.filter((c): c is string => typeof c === 'string' && !!c.trim())
    : [];
  if (parsed.length) return parsed;
  return post.channel_override ? [String(post.channel_override)] : [];
}

/**
 * Would publishing to `targets` duplicate one of these open posts?
 *
 * True when any open post shares a target group with the new request. An open post with NO
 * resolvable target goes to the default channel — since that chat may be any of the groups,
 * it is treated as covering all of them: a second copy risks landing in the same chat.
 */
export function openPostClash(openPosts: PostChannelFields[], targets: string[]): boolean {
  const wanted = new Set((targets || []).filter((t) => typeof t === 'string' && t.trim()));
  for (const post of openPosts || []) {
    const covered = postTargetChannels(post);
    if (!covered.length) return true;
    if (covered.some((c) => wanted.has(c))) return true;
  }
  return false;
}
