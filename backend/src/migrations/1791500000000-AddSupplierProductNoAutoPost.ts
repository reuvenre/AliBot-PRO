import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner opt-out from the FLYLINK autopilot, per product.
 *
 * The FLYLINK campaign rotates the whole catalog into ITS target group — but some products
 * are hand-curated for a different group (a Takti-only item the mama campaign must not
 * re-post to its own audience). The flag removes a product from the rotation entirely while
 * keeping every manual path (send / schedule / queue) untouched, so the owner still decides
 * exactly where such a product goes.
 *
 * Default false: every existing product keeps rotating exactly as before.
 */
export class AddSupplierProductNoAutoPost1791500000000 implements MigrationInterface {
  name = 'AddSupplierProductNoAutoPost1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "no_auto_post" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "no_auto_post"`);
  }
}
