import { platformFilterSql, PLATFORM_KEYS } from './platform-filter';

describe('platformFilterSql', () => {
  it('covers every platform the app publishes to', () => {
    expect(PLATFORM_KEYS.sort()).toEqual(
      ['facebook', 'instagram', 'pinterest', 'telegram', 'whatsapp'],
    );
  });

  it('matches a pin that already went out, by its pin id', () => {
    const f = platformFilterSql('pinterest')!;
    expect(f.sql).toContain('p.pinterest_post_id IS NOT NULL');
  });

  it('also matches a pin that has not gone out yet, by the campaign it belongs to', () => {
    // The whole point: a scheduled or failed pin carries no pin id. Filtering on the id
    // alone would show an empty screen to someone whose first pin has not published yet.
    const f = platformFilterSql('pinterest')!;
    expect(f.sql).toContain('c.target_platforms ILIKE :pfLike');
    expect(f.params.pfLike).toBe('%pinterest%');
    expect(f.params.pfPending).toEqual(['queued', 'scheduled', 'pending', 'failed']);
  });

  it('treats Telegram as the default destination', () => {
    // A post with no campaign — or a campaign predating target_platforms — goes to
    // Telegram. Requiring an explicit opt-in there would hide most of the account.
    const f = platformFilterSql('telegram')!;
    expect(f.sql).toContain('p.campaign_id IS NULL');
    expect(f.sql).toContain('c.target_platforms IS NULL');
  });

  it('requires an explicit opt-in for every platform other than Telegram', () => {
    for (const key of PLATFORM_KEYS.filter((k) => k !== 'telegram')) {
      const f = platformFilterSql(key)!;
      expect(f.sql).not.toContain('c.target_platforms IS NULL');
    }
  });

  it("honors a post's own platform override above its campaign's", () => {
    // The republish dialog can retarget a single post; the screen filter must see that
    // post where it is actually headed, not where its campaign would have sent it.
    for (const key of PLATFORM_KEYS) {
      expect(platformFilterSql(key)!.sql).toContain('p.target_platforms ILIKE :pfLike');
    }
  });

  it('is case- and whitespace-forgiving about the query string', () => {
    expect(platformFilterSql('  PINTEREST ')!.params.pfLike).toBe('%pinterest%');
  });

  it('returns null — "no filter" — for anything it does not know', () => {
    // Deliberately NOT a match-nothing clause: a typo in a URL must not present itself
    // as "you have no posts".
    for (const bad of ['', '   ', undefined, 'tiktok', "'; DROP TABLE posts;--"]) {
      expect(platformFilterSql(bad as string)).toBeNull();
    }
  });

  it('never interpolates the caller input into the SQL text', () => {
    // The platform only ever selects a column name from a fixed map; the value itself
    // travels as a bound parameter.
    const f = platformFilterSql('pinterest')!;
    expect(f.sql).not.toContain('pinterest_post_id IS NOT NULL OR pinterest');
    expect(f.sql).toContain(':pfLike');
  });
});
