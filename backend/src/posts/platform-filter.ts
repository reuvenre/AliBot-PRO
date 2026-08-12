/**
 * "Show me only the Pinterest posts."
 *
 * A post carries no platform column — where it went is recorded as a per-platform message
 * id, written only once the send succeeds. That alone can't answer the question: a pin
 * that is still scheduled, or that failed, has no id yet but is unmistakably a Pinterest
 * post. So the filter reads BOTH sides — what already went out, and what is headed there.
 */

/** The column each platform stamps with its message/post id once the send succeeds. */
const SENT_MARKER: Record<string, string> = {
  telegram: 'telegram_message_id',
  facebook: 'facebook_post_id',
  instagram: 'instagram_post_id',
  pinterest: 'pinterest_post_id',
  whatsapp: 'whatsapp_message_id',
};

export const PLATFORM_KEYS = Object.keys(SENT_MARKER);

/** Statuses where nothing has been published yet, so intent — not a message id — decides. */
const NOT_YET_SENT = ['queued', 'scheduled', 'pending', 'failed'];

export interface PlatformFilterSql {
  /** SQL fragment for a WHERE clause, using aliases `p` (post) and `c` (campaign). */
  sql: string;
  params: Record<string, unknown>;
}

/**
 * The WHERE fragment selecting posts that went to — or are headed to — `platform`.
 * Returns null for an unknown platform, which callers must read as "no filter" rather
 * than as "match nothing": a typo in a query string must never silently empty the screen.
 *
 * Telegram is the odd one out. It is the implicit default: a post with no campaign, or a
 * campaign that never declared target_platforms, publishes to Telegram. So its "headed
 * there" test has to include that absence, while every other platform requires an
 * explicit opt-in.
 */
export function platformFilterSql(platform: string | undefined): PlatformFilterSql | null {
  const key = String(platform || '').trim().toLowerCase();
  const marker = SENT_MARKER[key];
  if (!marker) return null;

  // A post's OWN target_platforms (set by the republish dialog) outranks its campaign's;
  // NULL falls through to the campaign / implicit-default logic unchanged.
  const headedThere = key === 'telegram'
    ? '(p.target_platforms ILIKE :pfLike OR (p.target_platforms IS NULL'
      + ' AND (p.campaign_id IS NULL OR c.target_platforms IS NULL OR c.target_platforms ILIKE :pfLike)))'
    : '(p.target_platforms ILIKE :pfLike OR (p.target_platforms IS NULL AND c.target_platforms ILIKE :pfLike))';

  return {
    sql: `(p.${marker} IS NOT NULL OR (p.status IN (:...pfPending) AND ${headedThere}))`,
    params: { pfLike: `%${key}%`, pfPending: NOT_YET_SENT },
  };
}
