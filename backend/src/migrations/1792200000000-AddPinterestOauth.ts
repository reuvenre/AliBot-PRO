import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pinterest OAuth: the app's own credentials plus the refresh token.
 *
 * The access token the developer portal hands out by button is a DEBUG credential —
 * read-only scopes, 24-hour life — so it can neither publish a Pin nor survive until
 * tomorrow's campaign run. A publishing token exists only through the OAuth flow, and
 * staying connected without the owner re-pasting anything requires the refresh token.
 */
export class AddPinterestOauth1792200000000 implements MigrationInterface {
  name = 'AddPinterestOauth1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_sets
        ADD COLUMN IF NOT EXISTS pinterest_app_id varchar,
        ADD COLUMN IF NOT EXISTS pinterest_app_secret_enc varchar,
        ADD COLUMN IF NOT EXISTS pinterest_refresh_token_enc varchar,
        ADD COLUMN IF NOT EXISTS pinterest_token_expires_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE credential_sets
        DROP COLUMN IF EXISTS pinterest_app_id,
        DROP COLUMN IF EXISTS pinterest_app_secret_enc,
        DROP COLUMN IF EXISTS pinterest_refresh_token_enc,
        DROP COLUMN IF EXISTS pinterest_token_expires_at
    `);
  }
}
