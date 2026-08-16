import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AliExpress affiliate incentive campaigns (portal bonus pools) the owner registered for.
 * The affiliate API doesn't expose them, so they're recorded here — that's what lets the
 * autopilot prefer the categories that currently pay a bonus.
 */
export class AddIncentivePrograms1792700000000 implements MigrationInterface {
  name = 'AddIncentivePrograms1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "incentive_programs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" character varying NOT NULL,
        "name" character varying NOT NULL,
        "keywords_json" text NOT NULL DEFAULT '[]',
        "target_channels" text,
        "starts_at" TIMESTAMP NOT NULL,
        "ends_at" TIMESTAMP NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incentive_programs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_incentive_user_active" ON "incentive_programs" ("user_id", "active")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_incentive_user_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "incentive_programs"`);
  }
}
