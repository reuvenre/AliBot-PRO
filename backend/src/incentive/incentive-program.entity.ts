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

  @CreateDateColumn()
  created_at: Date;
}
