import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-POST platform override (JSON array, e.g. '["pinterest"]').
 *
 * Until now a post's platforms were decided only by its campaign's target_platforms or
 * the account-global toggles — so republishing a winner to ONE chosen platform was simply
 * inexpressible. NULL = inherit exactly as before; the column only speaks when the owner
 * explicitly chose platforms in the republish dialog.
 */
export class AddPostTargetPlatforms1792500000000 implements MigrationInterface {
  name = 'AddPostTargetPlatforms1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "target_platforms" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "target_platforms"`);
  }
}
