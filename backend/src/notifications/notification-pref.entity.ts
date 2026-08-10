import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

/**
 * Per-user email notification preferences.
 *
 * Only notifications that are ACTUALLY delivered live here — a toggle in this table means
 * code exists that sends it. Both default to false: opting a user into email they never
 * asked for is worse than them finding the switch.
 */
@Entity('notification_prefs')
@Unique('uq_notification_prefs_user', ['user_id'])
export class NotificationPref {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  /** Daily digest: posts sent, failures, orders + commissions, credits left. */
  @Column({ default: false })
  daily_summary: boolean;

  /** Alert when a campaign run throws (the scheduler otherwise only logs it server-side). */
  @Column({ default: false })
  campaign_errors: boolean;

  /**
   * Which day (yyyy-mm-dd, Asia/Jerusalem) the digest last went out. The cron ticks
   * hourly, so this is what stops a second send on the same day.
   */
  @Column({ type: 'varchar', nullable: true })
  last_daily_sent_on: string | null;

  /** Local hour (0-23) the daily summary is sent at. Any hour — it reports the day so far. */
  @Column({ type: 'int', default: 9 })
  daily_summary_hour: number;

  /**
   * Local hour the learning engine's insights report is sent at. Floored at 10 — AliExpress
   * closes its accounting day at 10:00 Israel, and a digest before that both reports and
   * LEARNS FROM numbers that are still moving (see report-hours.ts).
   */
  @Column({ type: 'int', default: 10 })
  insights_hour: number;

  /** Same-day guard for the insights report, mirroring last_daily_sent_on. */
  @Column({ type: 'varchar', nullable: true })
  last_insights_sent_on: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
