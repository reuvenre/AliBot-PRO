import { MigrationInterface, QueryRunner } from 'typeorm';

/** coupons.deals_url — the owner's affiliate link to AliExpress' coupons/deals page,
 *  surfaced in the launch-sequence posts. */
export class CouponDealsUrl1793000000000 implements MigrationInterface {
  name = 'CouponDealsUrl1793000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "deals_url" TEXT');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE "coupons" DROP COLUMN IF EXISTS "deals_url"');
  }
}
