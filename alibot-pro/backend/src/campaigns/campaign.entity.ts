import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type CampaignStatus = 'active' | 'paused' | 'draft' | 'error';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ default: 'draft' })
  status: CampaignStatus;

  @Column('text', { array: true, default: '{}' })
  keywords: string[];

  @Column({ nullable: true })
  category_id: string;

  @Column('float', { nullable: true })
  min_price: number;

  @Column('float', { nullable: true })
  max_price: number;

  @Column('float', { nullable: true })
  min_discount: number;

  @Column({ default: '0 9 * * *' })
  schedule_cron: string;

  @Column({ default: 3 })
  posts_per_run: number;

  @Column({ default: 'he' })
  language: string;

  @Column('float', { default: 0 })
  markup_percent: number;

  @Column({ nullable: true, type: 'text' })
  post_template: string;

  @Column({ nullable: true })
  last_run_at: Date;

  @Column({ nullable: true })
  next_run_at: Date;

  @Column({ default: 0 })
  posts_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
