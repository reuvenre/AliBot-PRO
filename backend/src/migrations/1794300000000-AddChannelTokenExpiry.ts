import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expiry tracking for the PER-GROUP Facebook Page tokens.
 *
 * A channel publishing to its own Facebook page carries its own token, and nothing watched
 * it: no expiry column, no place in the daily scan, no countdown on the card. When one
 * lapsed, that group's Facebook and Instagram publishing simply stopped — discovered only
 * via a failed post or a partial-publish alert, days later.
 *
 * Both columns are nullable and start null, which reads as "expiry unknown". The backfill
 * happens lazily on first read (the same way the account token's did), because resolving it
 * means a Graph call per token and a migration is the wrong place to depend on a third
 * party being reachable.
 */
export class AddChannelTokenExpiry1794300000000 implements MigrationInterface {
  name = 'AddChannelTokenExpiry1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS facebook_token_expires_at TIMESTAMP NULL`);
    await q.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS facebook_token_notified_at TIMESTAMP NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE channels DROP COLUMN IF EXISTS facebook_token_notified_at`);
    await q.query(`ALTER TABLE channels DROP COLUMN IF EXISTS facebook_token_expires_at`);
  }
}
