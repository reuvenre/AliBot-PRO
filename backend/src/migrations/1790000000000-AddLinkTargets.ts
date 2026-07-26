import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable short-link targets. A /r/<code> link is printed into permanent public posts
 * (Facebook ads, Telegram messages) that outlive the post row — if the post is later
 * deleted, the click used to resolve to nothing and the shopper landed on the app
 * homepage. This table stores the code→URL mapping independently of `posts`, so a
 * published link keeps redirecting to the product forever.
 */
export class AddLinkTargets1790000000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "link_targets" (
        "code" varchar PRIMARY KEY,
        "url" text NOT NULL,
        "user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    // Backfill from existing posts so already-published links survive a future deletion.
    await q.query(`
      INSERT INTO "link_targets" ("code", "url", "user_id")
      SELECT "short_code", "affiliate_url", "user_id"
      FROM "posts"
      WHERE "short_code" IS NOT NULL AND "affiliate_url" IS NOT NULL AND "affiliate_url" <> ''
      ON CONFLICT ("code") DO NOTHING
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "link_targets"`);
  }
}
