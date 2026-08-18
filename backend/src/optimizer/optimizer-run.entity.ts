import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Audit trail of the learning optimizer: one row per user per daily run, recording the
 * scores it computed and the actions it took (keywords retired/boosted, insights). The
 * digest is regenerable from here, and the UI can show "what the brain did and why".
 */
@Entity('optimizer_runs')
@Index('idx_optimizer_runs_user', ['user_id', 'created_at'])
export class OptimizerRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  /** Full run record: per-campaign keyword scores, actions, digest stats, and the digest
   *  TEXT itself — so a delivery that failed can be re-sent without recomputing the day. */
  @Column({ type: 'text' })
  summary_json: string;

  /**
   * When the digest actually reached the owner. NULL means the pass ran but the report
   * never arrived — the same-day guard treats such a run as unfinished, so the next hourly
   * tick re-delivers it. Without this column the guard read "a run exists today" and a
   * transport blip cost the whole report, silently, for the rest of the day.
   */
  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
