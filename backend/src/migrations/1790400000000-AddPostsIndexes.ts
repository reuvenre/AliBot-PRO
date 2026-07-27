import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hot-path indexes for the posts table. The scheduler scans posts every minute
 * (due-scheduled, per-user queue, campaign rollups) — without these it was a full
 * sequential scan across all tenants each tick. IF NOT EXISTS so it's safe to re-run.
 */
export class AddPostsIndexes1790400000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Due-scheduled lookup: WHERE status='scheduled' AND scheduled_at <= now.
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_posts_status_scheduled" ON "posts" ("status", "scheduled_at")`);
    // Per-user auto-send queue: WHERE user_id=? AND status=? ORDER BY queue_order.
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_posts_user_status_queue" ON "posts" ("user_id", "status", "queue_order")`);
    // Campaign rollups / dedup by campaign.
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_posts_campaign" ON "posts" ("campaign_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_posts_campaign"`);
    await q.query(`DROP INDEX IF EXISTS "idx_posts_user_status_queue"`);
    await q.query(`DROP INDEX IF EXISTS "idx_posts_status_scheduled"`);
  }
}
