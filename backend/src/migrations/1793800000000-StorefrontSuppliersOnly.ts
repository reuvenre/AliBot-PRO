import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Storefronts default to the supplier catalog alone.
 *
 * The two catalogs are not the same kind of thing. The supplier shelf is a curated
 * offering — gallery, brand, stock flag — while the posts side is every deal that ever
 * went out, a different product each day at a price captured when it was published.
 * Shipping both by default turned a boutique into a feed.
 *
 * Existing rows are moved too, but ONLY the ones still on the original default: an owner
 * who has already chosen his sources has said what he wants, and a migration is not the
 * place to overrule him.
 */
export class StorefrontSuppliersOnly1793800000000 implements MigrationInterface {
  name = 'StorefrontSuppliersOnly1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE storefronts ALTER COLUMN sources SET DEFAULT 'suppliers'`);
    await q.query(`UPDATE storefronts SET sources = 'suppliers' WHERE sources = 'suppliers,posts'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE storefronts ALTER COLUMN sources SET DEFAULT 'suppliers,posts'`);
  }
}
