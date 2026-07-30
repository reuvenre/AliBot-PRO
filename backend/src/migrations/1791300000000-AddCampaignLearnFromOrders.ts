import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-campaign opt-in for order-driven keyword learning.
 *
 * Defaults to false, for the same reason seasonal_keywords does: the categories that sell
 * are learned at ACCOUNT level (most orders arrive through traffic the autopilot never
 * touched), so the winners reflect whoever buys through the owner's links — not necessarily
 * the audience of any one channel. Dripping "Wine Accessories" into a tactical-gear group is
 * exactly the mistake seasonal keywords already made once.
 *
 * With the flag off the winners are still reported in the daily digest as suggestions; only
 * turning it on lets the optimizer add them to that campaign's rotation.
 */
export class AddCampaignLearnFromOrders1791300000000 implements MigrationInterface {
  name = 'AddCampaignLearnFromOrders1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "learn_from_orders" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "learn_from_orders"`);
  }
}
