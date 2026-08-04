import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-platform click attribution.
 *
 * One post publishes the SAME /r/<code> link to Telegram, Facebook, Instagram, Pinterest
 * and WhatsApp — so a click row could never say which platform produced it (Telegram's
 * in-app browser leaves no referrer/UA marker to guess from). Each send path now stamps
 * its link with `?s=<platform>` and the click handler records the validated tag here.
 *
 * Nullable, no backfill: clicks from links published before tagging existed are honestly
 * "לא מזוהה" — inventing a platform for them would corrupt the very report this enables.
 */
export class AddLinkClickSource1791600000000 implements MigrationInterface {
  name = 'AddLinkClickSource1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "link_clicks" ADD COLUMN IF NOT EXISTS "source" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "link_clicks" DROP COLUMN IF EXISTS "source"`);
  }
}
