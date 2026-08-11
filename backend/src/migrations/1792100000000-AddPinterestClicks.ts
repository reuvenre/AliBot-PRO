import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pinterest outbound clicks per post, so the learning engine can see Pinterest at all.
 *
 * Pins carry the direct affiliate URL (our /r/ redirect risks pin rejection), so their
 * clicks never reach link_clicks and clicks_count stays 0 — which made every Pinterest
 * keyword permanently unjudgeable. Filled from Pinterest's pin-analytics API.
 */
export class AddPinterestClicks1792100000000 implements MigrationInterface {
  name = 'AddPinterestClicks1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinterest_clicks int NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE posts DROP COLUMN IF EXISTS pinterest_clicks`);
  }
}
