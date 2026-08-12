import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records when Pinterest last refused a pin despite a granted pins:write — the Trial-tier
 * write block. While fresh, the account-global "every post to Pinterest too" fan-out
 * stands down: without this, every Hebrew group post published fine to Telegram and then
 * failed its Pinterest add-on, stamping the account with nightly "published partially"
 * watchdog alerts that no one could act on.
 */
export class AddPinterestTierBlock1792400000000 implements MigrationInterface {
  name = 'AddPinterestTierBlock1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "pinterest_tier_blocked_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "pinterest_tier_blocked_at"`);
  }
}
