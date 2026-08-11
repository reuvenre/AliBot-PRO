import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which scopes Pinterest granted on the OAuth handshake.
 *
 * Without it, a grant that silently omits pins:write is indistinguishable from a complete
 * one until a pin is rejected hours later — which is exactly how the first published pin
 * failed. Existing rows stay NULL and are read as "unknown", never as "missing".
 */
export class AddPinterestScopes1792300000000 implements MigrationInterface {
  name = 'AddPinterestScopes1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "credential_sets" ADD COLUMN IF NOT EXISTS "pinterest_scopes" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "credential_sets" DROP COLUMN IF EXISTS "pinterest_scopes"`);
  }
}
