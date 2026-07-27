import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sales-recovery auto-push: when attributed orders drop below a user-defined threshold
 * within a window, the system publishes extra hot products (bought-but-unposted +
 * AliExpress best-sellers) to the active campaigns' groups until sales recover.
 * Distinct from the existing paid-ads boost_* settings.
 */
export class AddSalesRecovery1790100000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "recovery_enabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "recovery_min_orders" integer NOT NULL DEFAULT 5`);
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "recovery_window_days" integer NOT NULL DEFAULT 3`);
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "recovery_posts_per_day" integer NOT NULL DEFAULT 3`);
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_boost" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "is_boost"`);
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "recovery_posts_per_day"`);
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "recovery_window_days"`);
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "recovery_min_orders"`);
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "recovery_enabled"`);
  }
}
