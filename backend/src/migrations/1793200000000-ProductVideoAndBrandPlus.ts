import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product video + Brand+ authenticity.
 *
 * posts.product_video — the AliExpress product clip, published instead of the image on
 * Telegram/WhatsApp when the account opted in (credential_sets.prefer_product_video);
 * posts.is_brand_plus — the "Brand+ / Certified Original" badge (platform_product_type
 * TMALL), rendered as an emphasized authenticity line in the post body.
 */
export class ProductVideoAndBrandPlus1793200000000 implements MigrationInterface {
  name = 'ProductVideoAndBrandPlus1793200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS product_video text`);
    await q.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_brand_plus boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE credential_sets ADD COLUMN IF NOT EXISTS prefer_product_video boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE credential_sets DROP COLUMN IF EXISTS prefer_product_video`);
    await q.query(`ALTER TABLE posts DROP COLUMN IF EXISTS is_brand_plus`);
    await q.query(`ALTER TABLE posts DROP COLUMN IF EXISTS product_video`);
  }
}
