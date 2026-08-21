import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * incentive_programs.bonus_rate_pct — the pool's incentive commission rate from the portal.
 *
 * The bonus never reaches our data (AliExpress pays it separately; the orders sync carries
 * only the base commission), so this rate is what lets the bonus screen estimate what a
 * pool is actually worth. Nullable: unknown means the screen shows no estimate.
 */
export class AddIncentiveBonusRate1793400000000 implements MigrationInterface {
  name = 'AddIncentiveBonusRate1793400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE incentive_programs ADD COLUMN IF NOT EXISTS bonus_rate_pct double precision`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE incentive_programs DROP COLUMN IF EXISTS bonus_rate_pct`);
  }
}
