import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The learning optimizer ("the brain"): nightly keyword scoring → retire dead keywords,
 * boost earners, morning digest. Adds the per-user toggle, the campaign's retired-keywords
 * memory, and the audit table of what the brain did each run.
 */
export class AddLearningOptimizer1790800000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "optimizer_enabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "retired_keywords" text[] NOT NULL DEFAULT '{}'`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "optimizer_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "summary_json" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_optimizer_runs" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_optimizer_runs_user" ON "optimizer_runs" ("user_id", "created_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "optimizer_runs"`);
    await q.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "retired_keywords"`);
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "optimizer_enabled"`);
  }
}
