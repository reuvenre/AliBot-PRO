import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pricing-converter config (markup, shipping buffer, rounding mode). Idempotent. */
export class AddPricingConfig1782150000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_sets
        ADD COLUMN IF NOT EXISTS price_markup_pct double precision NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS price_shipping_buffer_ils double precision NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS price_rounding_mode varchar NOT NULL DEFAULT 'natural'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_sets
        DROP COLUMN IF EXISTS price_markup_pct,
        DROP COLUMN IF EXISTS price_shipping_buffer_ils,
        DROP COLUMN IF EXISTS price_rounding_mode
    `);
  }
}
