import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The daily manager's action log (project 3).
 *
 * Three owner-approved action kinds live here: golden-hours refreshes for smart-timing
 * groups, posts_per_run ±1 adjustments (with the owner-baseline the drift bound is
 * measured against), and 24h keyword pauses (expiring by until_at — the campaign runner
 * simply filters active pauses, no cleanup job). Every row carries the measured reason
 * shown to the owner in the morning digest: nothing the manager does is silent.
 */
export class AddManagerActions1791800000000 implements MigrationInterface {
  name = 'AddManagerActions1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS manager_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        kind character varying NOT NULL,
        target_id character varying,
        target_label character varying,
        "before" character varying,
        "after" character varying,
        baseline character varying,
        reason text,
        until_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_manager_actions_user_date ON manager_actions (user_id, created_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_manager_actions_target ON manager_actions (target_id, kind)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS manager_actions`);
  }
}
