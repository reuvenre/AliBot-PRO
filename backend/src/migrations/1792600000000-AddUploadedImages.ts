import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner-uploaded post images, stored in the DB (no object storage in this deployment) and
 * served publicly by id — every platform except Telegram ingests images by URL, so the
 * bytes must survive restarts somewhere an endpoint can read them.
 */
export class AddUploadedImages1792600000000 implements MigrationInterface {
  name = 'AddUploadedImages1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "uploaded_images" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" character varying NOT NULL,
        "data" bytea NOT NULL,
        "mime" character varying NOT NULL DEFAULT 'image/jpeg',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_uploaded_images" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "uploaded_images"`);
  }
}
