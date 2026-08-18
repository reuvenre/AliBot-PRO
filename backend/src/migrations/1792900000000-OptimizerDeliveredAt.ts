import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * optimizer_runs.delivered_at — when the morning digest actually reached the owner.
 *
 * The same-day guard used to read "a run row exists today", and the row was written BEFORE
 * delivery. A Telegram or SMTP blip therefore cost the entire report: the guard saw the
 * run, skipped every later tick, and nothing retried. Existing rows are backfilled to
 * their created_at — those days are over, and leaving them NULL would re-send old digests.
 */
export class OptimizerDeliveredAt1792900000000 implements MigrationInterface {
  name = 'OptimizerDeliveredAt1792900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "optimizer_runs" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ');
    await q.query('UPDATE "optimizer_runs" SET "delivered_at" = "created_at" WHERE "delivered_at" IS NULL');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "optimizer_runs" DROP COLUMN IF EXISTS "delivered_at"');
  }
}
