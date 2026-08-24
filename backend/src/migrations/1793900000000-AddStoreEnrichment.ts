import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a supplier product is CALLED in the shop, as opposed to how it is filed.
 *
 * A Yupoo album is titled for the warehouse — `6380-42.66-LHYF-High quality…` — and the
 * only thing that reliably says what the product IS is the photograph. So an agent looks
 * at the photo once and writes down the three things a shopper browses by: a name in
 * their language, a category, and the brand.
 *
 * Kept in separate columns rather than overwriting title/description: the original is the
 * key that matches the album back to the seller's catalog, and losing it would break
 * every future re-sync. The owner edits these freely; `enriched_at` is what stops the
 * agent from revisiting a product — including one he has corrected by hand.
 */
export class AddStoreEnrichment1793900000000 implements MigrationInterface {
  name = 'AddStoreEnrichment1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS store_name text`);
    await q.query(`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS store_category text`);
    await q.query(`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS store_brand text`);
    await q.query(`ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS store_enriched_at timestamptz`);
    // The agent's work queue: "everything never looked at", oldest first.
    await q.query(`CREATE INDEX IF NOT EXISTS idx_supplier_products_enrich
                   ON supplier_products (user_id, store_enriched_at NULLS FIRST)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_supplier_products_enrich`);
    for (const col of ['store_name', 'store_category', 'store_brand', 'store_enriched_at']) {
      await q.query(`ALTER TABLE supplier_products DROP COLUMN IF EXISTS ${col}`);
    }
  }
}
