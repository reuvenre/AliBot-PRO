import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * posts.delivered_channels — the groups a post ACTUALLY published to.
 *
 * The list labelled every row with the targeting field, so a manual push to another group
 * kept showing the original one. This column records confirmed deliveries and is read only
 * by the UI; routing still reads channel_override(s).
 */
export class AddDeliveredChannels1793300000000 implements MigrationInterface {
  name = 'AddDeliveredChannels1793300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS delivered_channels text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts DROP COLUMN IF EXISTS delivered_channels`);
  }
}
