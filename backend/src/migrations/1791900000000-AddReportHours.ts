import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-user delivery hours for the two scheduled reports.
 *
 * Defaults reproduce the previous hardcoded behaviour exactly: the daily summary at 09:00
 * and the learning-engine insights report at 10:00 (the AliExpress accounting close it has
 * always sat behind). `last_insights_sent_on` is the same-day guard the insights dispatch
 * needs now that it ticks hourly instead of firing once at a fixed time.
 */
export class AddReportHours1791900000000 implements MigrationInterface {
  name = 'AddReportHours1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_prefs
        ADD COLUMN IF NOT EXISTS daily_summary_hour int NOT NULL DEFAULT 9,
        ADD COLUMN IF NOT EXISTS insights_hour int NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS last_insights_sent_on varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_prefs
        DROP COLUMN IF EXISTS daily_summary_hour,
        DROP COLUMN IF EXISTS insights_hour,
        DROP COLUMN IF EXISTS last_insights_sent_on
    `);
  }
}
