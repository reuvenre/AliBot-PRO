import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Introduce a genuine Free tier and make it the default for NEW signups, so users no
 * longer land on a paid plan (Starter) with recurring free credits. Only column DEFAULTS
 * change here — existing users are intentionally left as-is (an admin can re-tier
 * free-riders manually), so no one is downgraded mid-use by the deploy.
 */
export class FreeTierDefault1790300000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "subscription_plan" SET DEFAULT 'free'`);
    await q.query(`ALTER TABLE "users" ALTER COLUMN "credits_remaining" SET DEFAULT 100`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "subscription_plan" SET DEFAULT 'starter'`);
    await q.query(`ALTER TABLE "users" ALTER COLUMN "credits_remaining" SET DEFAULT 500`);
  }
}
