import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The free trial, and a free tier big enough to be worth trying.
 *
 * users.trial_ends_at — while it is in the future, FEATURE gates are checked at the trial
 * tier (see effectivePlan). Credits and group count are untouched by it, so a lapsed trial
 * needs no cleanup: the gates simply close again.
 *
 * The column default moves 100 → 450 for NEW accounts. Existing accounts are topped up
 * only if they are on the free plan AND still hold no more than the old quota — i.e. they
 * never bought a pack and were never granted anything. Anyone who paid for credits keeps
 * exactly what they have; this is a floor being raised, never a balance being overwritten.
 *
 * Existing users get no backdated trial. A trial is for someone deciding, and it starts
 * when they sign up; handing two weeks of Autopilot to accounts that already chose their
 * plan would be a discount, not a demo.
 */
export class AddTrialAndFreeCredits1794200000000 implements MigrationInterface {
  name = 'AddTrialAndFreeCredits1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP NULL`);
    await q.query(`ALTER TABLE users ALTER COLUMN credits_remaining SET DEFAULT 450`);
    await q.query(`UPDATE users SET credits_remaining = 450
                   WHERE subscription_plan = 'free' AND credits_remaining <= 100`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // The credit top-up is deliberately NOT reversed: taking credits back off a live
    // account is a worse outcome than leaving a generous balance behind.
    await q.query(`ALTER TABLE users ALTER COLUMN credits_remaining SET DEFAULT 100`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS trial_ends_at`);
  }
}
