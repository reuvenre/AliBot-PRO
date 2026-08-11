import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the campaign's last run actually DID — posts queued, slots skipped, and why.
 *
 * A slow-cadence alert ("configured 180 min, actually 481") says a campaign is publishing
 * less than it should but nothing about the cause, and the reasons lived only in server
 * logs that expire. Four investigations in a row started from zero because of it. The run
 * writes its own outcome here so the next alert can carry the answer with it.
 */
export class AddCampaignLastRunNote1792000000000 implements MigrationInterface {
  name = 'AddCampaignLastRunNote1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_run_note text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns DROP COLUMN IF EXISTS last_run_note`);
  }
}
