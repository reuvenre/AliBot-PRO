import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rolling log of campaign runs that produced nothing because of failures. Failed
 * generation leaves no post row (by design), so without this trail the drift check
 * counted 0 "failed runs" and reported the resulting gap as a pacing fault (issue #60).
 */
export class CampaignFailedRunLog1793100000000 implements MigrationInterface {
  name = 'CampaignFailedRunLog1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_run_log jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE campaigns DROP COLUMN IF EXISTS failed_run_log`);
  }
}
