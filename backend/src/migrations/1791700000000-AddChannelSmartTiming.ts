import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Opt-in smart timing per group.
 *
 * The optimizer learns each group's golden hours from its real clicks; this flag lets the
 * scheduler ACT on them — nudging the group's posts into those hours instead of spreading
 * them uniformly across the send window.
 *
 * Default false, and deliberately so: the owner has exactly one place where posting hours
 * are configured, and the scheduler must never start moving posts around because of a flag
 * nobody flipped. Smart timing changes nothing until the owner turns it on, per group.
 */
export class AddChannelSmartTiming1791700000000 implements MigrationInterface {
  name = 'AddChannelSmartTiming1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "smart_timing" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "smart_timing"`);
  }
}
