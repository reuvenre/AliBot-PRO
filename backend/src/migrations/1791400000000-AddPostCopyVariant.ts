import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Which copy ANGLE a post was written in.
 *
 * The optimizer learned what to publish but never how to phrase it, so the one thing the
 * audience actually reads was the one thing that never improved. Recording the angle turns
 * every post into a measurement: clicks per post per angle is what tells the engine which
 * voice a group responds to.
 *
 * Nullable, with no backfill. Posts published before the bandit existed were written in one
 * fixed voice, and stamping them with an angle they were not written in would be inventing
 * the very evidence this column exists to collect. They simply sit out of the comparison.
 *
 * The partial index is the shape the two readers actually use — clicks grouped by angle for
 * one campaign (the picker) and for one user (the digest) — and it stays small by covering
 * only the rows that carry an angle at all.
 */
export class AddPostCopyVariant1791400000000 implements MigrationInterface {
  name = 'AddPostCopyVariant1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "copy_variant" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_posts_copy_variant"
       ON "posts" ("campaign_id", "copy_variant")
       WHERE "copy_variant" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_copy_variant"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "copy_variant"`);
  }
}
