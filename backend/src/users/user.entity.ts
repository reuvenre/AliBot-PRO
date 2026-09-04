import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  /** Display name the user chose at registration. Shown in the UI instead of the email prefix. */
  @Column({ nullable: true })
  name: string;

  @Column()
  password_hash: string;

  /** Access role: 'user' (default) or 'admin' (can view all users) */
  @Column({ default: 'user' })
  role: string;

  /** When true the account is deactivated — the user cannot log in (admin control). */
  @Column({ default: false })
  is_blocked: boolean;

  @Column({ nullable: true })
  google_id: string;

  @Column({ nullable: true })
  footer_text: string;

  @Column({ nullable: true })
  refresh_token_hash: string;

  @Column({ nullable: true })
  reset_token_hash: string;

  @Column({ nullable: true, type: 'timestamp' })
  reset_token_expires: Date;

  // ── Two-factor auth (TOTP) ────────────────────────────────────────────────
  /** AES-encrypted base32 TOTP secret. Present once setup starts; active only when enabled. */
  @Column({ nullable: true })
  totp_secret_enc: string;

  /** True once the user has confirmed a code — login then requires a 2FA step. */
  @Column({ default: false })
  totp_enabled: boolean;

  // ── Subscription (demo-mode billing — no payment gateway yet) ──────────────
  // Plan numbers (credits/limits/prices) live in subscription/plans.const.ts;
  // only the user's state is stored here.

  /** Active plan id: 'free' | 'starter' | 'growth' | 'autopilot' | 'scale'.
   *  New signups start on 'free' — never a paid tier without payment. */
  @Column({ default: 'free' })
  subscription_plan: string;

  /** 'monthly' | 'annual' — affects displayed price only (demo mode). */
  @Column({ default: 'monthly' })
  plan_billing: string;

  /** Current credit balance; refilled to the plan's monthly amount each cycle.
   *  Default matches the Free plan's monthly_credits. */
  @Column({ type: 'int', default: 450 })
  credits_remaining: number;

  /**
   * While this is in the future, FEATURE gates are checked at the trial tier instead of the
   * user's own plan (see effectivePlan in plans.const.ts). Credits and group count are NOT
   * affected, so nothing has to be taken away when it lapses — the gates just close again.
   * Null on accounts that predate the trial, which is simply "no trial".
   */
  @Column({ nullable: true, type: 'timestamp' })
  trial_ends_at: Date | null;

  /** When the next monthly credit refill happens (lazy — applied on first use after). */
  @Column({ nullable: true, type: 'timestamp' })
  plan_renews_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
