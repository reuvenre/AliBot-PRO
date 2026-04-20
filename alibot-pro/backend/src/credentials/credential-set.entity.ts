import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('credential_sets')
export class CredentialSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  aliexpress_app_key: string;

  @Column({ nullable: true })
  aliexpress_app_secret_enc: string;

  @Column({ nullable: true })
  aliexpress_tracking_id: string;

  @Column({ nullable: true })
  telegram_bot_token_enc: string;

  @Column({ nullable: true })
  telegram_channel_id: string;

  @Column({ nullable: true })
  openai_api_key_enc: string;

  @Column({ default: 'gpt-4o-mini' })
  openai_model: string;

  @Column({ default: 'USD_ILS' })
  currency_pair: string;

  /* ── Scheduling Queue Settings ─────────────────────────────────────────── */

  @Column({ default: false })
  schedule_enabled: boolean;

  /** Hour of day (0-23) when auto-queue starts sending */
  @Column({ default: 9 })
  schedule_start_hour: number;

  /** Hour of day (0-23) after which auto-queue stops sending */
  @Column({ default: 22 })
  schedule_end_hour: number;

  /** Minimum minutes between each queued post send */
  @Column({ default: 60 })
  schedule_interval_minutes: number;

  /** Timestamp of last queue post sent (used to enforce interval) */
  @Column({ nullable: true })
  schedule_last_sent_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
