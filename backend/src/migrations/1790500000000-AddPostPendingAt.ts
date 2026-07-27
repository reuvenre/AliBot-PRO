import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `pending_at` marks when a post was claimed for sending. The stuck-post cleanup keys off
 * this instead of created_at, so a post that sat queued for hours isn't flagged "stuck" the
 * moment it flips to pending. Also powers the atomic send-claim (claim only when still
 * queued/scheduled), preventing a double-send if more than one instance runs the cron.
 */
export class AddPostPendingAt1790500000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "pending_at" TIMESTAMP`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "pending_at"`);
  }
}
