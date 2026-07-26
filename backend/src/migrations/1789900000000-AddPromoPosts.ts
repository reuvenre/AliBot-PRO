import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limited-time promotion posts: a manually-approved post that runs a one-time deal and
 * removes itself when the deal ends.
 *  • is_promo        — marks the post as a limited-time promotion.
 *  • promo_ends_at   — when the deal expires (auto-removal fires after this).
 *  • promo_discount  — the deal % the user set, surfaced in the AI copy.
 *  • promo_expired   — set once auto-removal has handled it, so the cron never re-processes.
 */
export class AddPromoPosts1789900000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_promo" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "promo_ends_at" TIMESTAMP`);
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "promo_discount" integer`);
    await q.query(`ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "promo_expired" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "promo_expired"`);
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "promo_discount"`);
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "promo_ends_at"`);
    await q.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "is_promo"`);
  }
}
