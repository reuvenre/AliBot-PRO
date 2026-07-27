import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recovery campaign selection: a JSON array of campaign ids that opt into sales-recovery
 * boosts. Empty/null = every active campaign participates (backward-compatible default).
 */
export class AddRecoveryCampaignIds1790200000000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "recovery_campaign_ids" text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "recovery_campaign_ids"`);
  }
}
