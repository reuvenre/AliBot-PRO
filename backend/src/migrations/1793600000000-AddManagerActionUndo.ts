import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * manager_actions.undone_at — when the owner took a change back.
 *
 * The engine now changes things on its own authority, which is only acceptable if every
 * change is reversible by one tap. NULL means the change still stands; a timestamp means
 * it was reversed, which is also what stops a second tap from re-applying an old state.
 *
 * The rows themselves are never deleted: "the brain did X and I undid it" is exactly the
 * history worth keeping, both for the owner and for teaching the engine what he rejects.
 */
export class AddManagerActionUndo1793600000000 implements MigrationInterface {
  name = 'AddManagerActionUndo1793600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE manager_actions ADD COLUMN IF NOT EXISTS undone_at timestamptz`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE manager_actions DROP COLUMN IF EXISTS undone_at`);
  }
}
