import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * earnings.incentive_commission_usd — the BONUS AliExpress paid on an order.
 *
 * Bonus membership used to be inferred by matching the order's keyword against the pool's
 * keyword list, which undercounted badly: AliExpress pays the bonus by product CATEGORY,
 * an unattributed order carries no keyword at all, and an attributed one only matched when
 * our search phrase happened to be in the list. This column holds the portal's own figure.
 *
 * Nullable on purpose: NULL means the feed carried no such field for that row (history
 * synced before this existed), which is not the same as 0 — "no bonus on this order".
 */
export class AddIncentiveCommission1793500000000 implements MigrationInterface {
  name = 'AddIncentiveCommission1793500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE earnings ADD COLUMN IF NOT EXISTS incentive_commission_usd double precision`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE earnings DROP COLUMN IF EXISTS incentive_commission_usd`);
  }
}
