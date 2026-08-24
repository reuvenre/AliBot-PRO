import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * storefronts — a customer's public deals catalog at /s/<slug>.
 *
 * The channel feed is a river: a follower who scrolled past a deal on Tuesday has no way
 * back to it on Thursday. This is the shelf behind the river.
 *
 * `enabled` defaults to FALSE on purpose: a store that went live the moment this table
 * existed would publish every customer's catalog, and their prices, without them asking.
 */
export class AddStorefronts1793700000000 implements MigrationInterface {
  name = 'AddStorefronts1793700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS storefronts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        slug text NOT NULL,
        name text NOT NULL,
        tagline text,
        enabled boolean NOT NULL DEFAULT false,
        whatsapp text,
        shipping_text text,
        details_text text,
        sources text NOT NULL DEFAULT 'suppliers,posts',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    // One store per user, and one owner per address — the address is printed into public
    // posts, so two stores answering to it is not a state worth being able to reach.
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_user ON storefronts (user_id)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_slug ON storefronts (slug)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS storefronts`);
  }
}
