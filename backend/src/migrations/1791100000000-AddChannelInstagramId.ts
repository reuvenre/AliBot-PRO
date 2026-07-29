import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-group Instagram Business account.
 *
 * The account held a single instagram_business_id, so a second brand's channel had no way
 * to publish to its own Instagram — it could only reach the first brand's. The Facebook
 * page and its token were already per-group; this completes the pair.
 *
 * Null keeps the existing behaviour (publish to the account's global Instagram).
 */
export class AddChannelInstagramId1791100000000 implements MigrationInterface {
  name = 'AddChannelInstagramId1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "instagram_business_id" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "instagram_business_id"`);
  }
}
