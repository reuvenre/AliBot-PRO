import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * An AliExpress affiliate INCENTIVE CAMPAIGN the owner registered for in the portal
 * (portals.aliexpress.com → Incentive Campaign): a category "pool" that pays a BONUS on
 * top of the normal CPS commission for orders made while registered, inside the campaign
 * window.
 *
 * The affiliate OPEN API does not expose these registrations — they exist only in the
 * portal UI — so the owner records the ones they joined here. That single fact is what
 * lets the autopilot act on them: while a program is live, its categories are worth more
 * per sale than anything else, so the campaigns publishing to the matching audience lean
 * their keyword rotation toward it. The window closing ends the bias by itself.
 */
@Entity('incentive_programs')
@Index('idx_incentive_user_active', ['user_id', 'active'])
export class IncentiveProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  /** The portal's campaign name, so the owner recognises it ("Home & Living Pool"). */
  @Column()
  name: string;

  /** English search terms the bonus category covers — these join the rotation. */
  @Column({ type: 'text', default: '[]' })
  keywords_json: string;

  /** The autopilots (campaign ids) this bonus applies to. Empty/null = all of them.
   *  Campaigns, not groups: a Pinterest campaign publishes to no Telegram group, so a
   *  group-based target could never reach it. */
  @Column({ type: 'text', nullable: true })
  target_campaigns: string | null;

  @Column({ type: 'timestamp' })
  starts_at: Date;

  @Column({ type: 'timestamp' })
  ends_at: Date;

  /** Owner switch — off keeps the record (next month's registration reuses it). */
  @Column({ default: true })
  active: boolean;

  /**
   * The pool's INCENTIVE COMMISSION RATE from the portal, in percent (e.g. 11 for 11%).
   *
   * The bonus itself never reaches our data — AliExpress pays it separately and the orders
   * sync carries only the base commission — so this is the one number that lets the screen
   * estimate what a pool is really worth. Applied to the ORDER AMOUNT, which is how the
   * portal computes it (26.92 paid × 11% = 2.96 incentive), NOT to the base commission.
   * Null = the owner hasn't entered it; the screen then shows no estimate rather than a
   * made-up one.
   */
  @Column({ type: 'float', nullable: true })
  bonus_rate_pct: number | null;

  @CreateDateColumn()
  created_at: Date;
}
