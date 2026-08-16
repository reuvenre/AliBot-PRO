import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bonus pools target AUTOPILOTS, not Telegram groups.
 *
 * The first cut stored group ids, which could never reach a Pinterest campaign — it
 * publishes to no Telegram group, so the picker had nothing to offer for it. Campaign
 * ids are the exact, unambiguous target. Renames in place (the table is a day old and
 * the column is nullable), with an ADD fallback for a database created after the rename.
 */
export class IncentiveTargetCampaigns1792800000000 implements MigrationInterface {
  name = 'IncentiveTargetCampaigns1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [col] = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'incentive_programs' AND column_name = 'target_channels'
    `);
    if (col) {
      await queryRunner.query(
        `ALTER TABLE "incentive_programs" RENAME COLUMN "target_channels" TO "target_campaigns"`,
      );
    } else {
      await queryRunner.query(
        `ALTER TABLE "incentive_programs" ADD COLUMN IF NOT EXISTS "target_campaigns" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "incentive_programs" RENAME COLUMN "target_campaigns" TO "target_channels"`,
    );
  }
}
