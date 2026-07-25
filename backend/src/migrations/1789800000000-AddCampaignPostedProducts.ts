import { MigrationInterface, QueryRunner } from 'typeorm';

/** Durable per-campaign posted-product de-dup memory (survives post deletion). */
export class AddCampaignPostedProducts1789800000000 implements MigrationInterface {
  name = 'AddCampaignPostedProducts1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campaign_posted_products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" character varying NOT NULL,
        "product_id" character varying NOT NULL,
        "keyword" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campaign_posted_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_posted_campaign_product" UNIQUE ("campaign_id", "product_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_posted_campaign_keyword" ON "campaign_posted_products" ("campaign_id", "keyword")`);

    // Backfill from existing posts so the de-dup history isn't reset to empty on deploy.
    await queryRunner.query(`
      INSERT INTO "campaign_posted_products" ("campaign_id", "product_id", "keyword")
      SELECT DISTINCT ON (p.campaign_id, p.product_id)
             p.campaign_id, p.product_id, p.keyword
      FROM "posts" p
      WHERE p.campaign_id IS NOT NULL AND p.product_id IS NOT NULL
      ORDER BY p.campaign_id, p.product_id, p.created_at DESC
      ON CONFLICT ("campaign_id", "product_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "campaign_posted_products"`);
  }
}
