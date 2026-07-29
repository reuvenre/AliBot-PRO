import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The dashboard overview buckets sent posts by week per user. Without this the query is a
 * sequential scan of `posts`, and it runs on every dashboard load — worst for the accounts
 * with the most posts, which are the ones least able to absorb it. Earnings and link_clicks
 * already carry their (user_id, date) index; this closes the third metric.
 */
export class AddPostsSentIndex1791200000000 implements MigrationInterface {
  name = 'AddPostsSentIndex1791200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_posts_user_sent" ON "posts" ("user_id", "sent_at") WHERE "status" = 'sent'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_posts_user_sent"`);
  }
}
