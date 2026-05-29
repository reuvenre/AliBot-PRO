import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type EarningStatus = 'estimated' | 'settled' | 'cancelled';

@Entity('earnings')
export class Earning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  campaign_id: string;

  @Column()
  order_id: string;

  @Column()
  product_id: string;

  @Column('float', { default: 0 })
  order_amount_usd: number;

  @Column('float', { default: 0 })
  commission_usd: number;

  @Column('float', { default: 0 })
  commission_ils: number;

  @Column({ default: 'estimated' })
  status: EarningStatus;

  @Column()
  order_date: Date;

  @Column({ nullable: true })
  settlement_date: Date;

  @CreateDateColumn()
  created_at: Date;
}
