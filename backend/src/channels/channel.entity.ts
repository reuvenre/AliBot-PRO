import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({ default: 'telegram' })
  platform: string;

  @Column({ nullable: true })
  bot_token_enc: string;

  @Column({ nullable: true })
  channel_id: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'int', default: 0, nullable: true })
  members_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
