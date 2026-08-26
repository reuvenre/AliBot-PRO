import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * storefronts.link_in_posts — whether outgoing posts carry the store's address.
 *
 * Until now the only way to stop the line was to switch the whole store off, which also
 * takes down an address already printed in every post that ever went out. These are two
 * different decisions and they now have two different switches.
 *
 * Defaults to true: a store that is live wants to be found, and every existing store was
 * already linking from its posts.
 */
export class AddStoreLinkInPosts1794100000000 implements MigrationInterface {
  name = 'AddStoreLinkInPosts1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE storefronts
                   ADD COLUMN IF NOT EXISTS link_in_posts boolean NOT NULL DEFAULT true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE storefronts DROP COLUMN IF EXISTS link_in_posts`);
  }
}
