import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

/**
 * A checkout session we created for a user. The AMOUNT is computed server-side at creation
 * and is the source of truth — the webhook confirms payment against THIS record, never
 * against a client-supplied price. One row per checkout attempt; the webhook flips it to
 * 'paid' exactly once (idempotent via status + the unique external_ref).
 */
@Entity('payment_sessions')
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  provider: string;

  /** 'subscription' | 'credit_pack' */
  @Column({ default: 'subscription' })
  kind: string;

  @Column({ nullable: true })
  plan: string | null;

  @Column({ default: 'monthly' })
  billing: string;

  @Column({ nullable: true })
  pack_id: string | null;

  /** Whole shekels (₪). Adapters convert to agorot / the provider's unit as needed. */
  @Column('int')
  amount: number;

  @Column({ default: 'ILS' })
  currency: string;

  /** 'pending' | 'paid' | 'failed' | 'expired' */
  @Column({ default: 'pending' })
  status: string;

  /** The provider's transaction id — unique so a duplicated webhook can't double-apply. */
  @Index({ unique: true, where: '"external_ref" IS NOT NULL' })
  @Column({ nullable: true })
  external_ref: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  paid_at: Date;
}
