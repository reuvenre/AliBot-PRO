import { MigrationInterface, QueryRunner } from 'typeorm';

/** Saved/edited marketing post text on catalog products (draft → schedule). Idempotent. */
export class AddCatalogPostText1782160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE catalog_products
        ADD COLUMN IF NOT EXISTS post_text text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE catalog_products
        DROP COLUMN IF EXISTS post_text
    `);
  }
}
