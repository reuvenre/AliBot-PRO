import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-campaign opt-in for the commercial calendar's seasonal SEARCH keywords.
 *
 * Defaults to false — the previous behaviour injected them into every campaign, which is
 * right for a general-deals channel and wrong for a niche one. Existing campaigns keep
 * publishing only what their own keyword list finds; anyone who wants the seasonal stock
 * turns it on per campaign.
 */
export class AddCampaignSeasonalKeywords1791000000000 implements MigrationInterface {
  name = 'AddCampaignSeasonalKeywords1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "seasonal_keywords" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "seasonal_keywords"`);
  }
}
