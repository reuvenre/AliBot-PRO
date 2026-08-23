import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Every action the daily manager takes — the transparency backbone of project 3.
 *
 * One row per action: what changed, from what to what, WHY (the measured reason shown to
 * the owner), and — for temporary actions — until when. The log is also the manager's own
 * memory: the posts_per_run baseline logic reads it to guarantee the ±1-from-owner bound,
 * and keyword pauses expire by their until_at with no cleanup job needed.
 */
@Entity('manager_actions')
@Index('idx_manager_actions_user_date', ['user_id', 'created_at'])
@Index('idx_manager_actions_target', ['target_id', 'kind'])
export class ManagerAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  /** 'golden_hours' | 'posts_per_run' | 'keyword_pause' — the owner-approved action kinds. */
  @Column()
  kind: string;

  /** The campaign/group the action touched. */
  @Column({ nullable: true })
  target_id: string;

  /** Human name (group/campaign) — or the paused keyword itself for keyword_pause. */
  @Column({ nullable: true })
  target_label: string;

  @Column({ nullable: true })
  before: string;

  @Column({ nullable: true })
  after: string;

  /** posts_per_run only: the OWNER's own value the ±1 drift is measured against. */
  @Column({ nullable: true })
  baseline: string;

  /** The measured reason, in the owner's language — exactly what the digest shows. */
  @Column({ type: 'text', nullable: true })
  reason: string;

  /** Temporary actions (keyword_pause) expire here; permanent ones leave it null. */
  @Column({ type: 'timestamptz', nullable: true })
  until_at: Date | null;

  /**
   * When the owner took this change back. NULL = it still stands.
   *
   * The row is never deleted: "the engine did X and he undid it" is the history worth
   * keeping — for him, and for teaching the engine what he rejects. It is also what stops
   * a second tap on the same button from re-applying a stale state.
   */
  @Column({ type: 'timestamptz', nullable: true })
  undone_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
