import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgentSystem1748500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add use_agents flag to campaigns
    await queryRunner.query(`
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS use_agents boolean NOT NULL DEFAULT false
    `);

    // Create agent_runs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        campaign_id varchar NOT NULL,
        agent_type varchar NOT NULL,
        input jsonb,
        output jsonb,
        tokens_used integer NOT NULL DEFAULT 0,
        status varchar NOT NULL DEFAULT 'running',
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs (user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_campaign_id ON agent_runs (campaign_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS agent_runs`);
    await queryRunner.query(`ALTER TABLE campaigns DROP COLUMN IF EXISTS use_agents`);
  }
}
