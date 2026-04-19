import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: '' })
  icon: string;

  @Column({ default: 0 })
  sort_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
