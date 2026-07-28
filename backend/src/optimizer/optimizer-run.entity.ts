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

  /** Full run record: per-campaign keyword scores, actions, digest stats. */
  @Column({ type: 'text' })
  summary_json: string;

  @CreateDateColumn()
  created_at: Date;
}
