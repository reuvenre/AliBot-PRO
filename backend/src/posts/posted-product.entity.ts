import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index,
} from 'typeorm';

/**
 * Durable record that a campaign already posted a product — the DE-DUP memory.
 * Kept SEPARATE from `posts` on purpose: deleting a post (e.g. clearing a stuck
 * backlog) used to erase the de-dup history too, so the same products came back.
 * This table is never deleted with posts, so a product is posted at most once per
 * campaign no matter what happens to the post row.
 */
@Entity('campaign_posted_products')
@Unique('uq_posted_campaign_product', ['campaign_id', 'product_id'])
@Index('idx_posted_campaign_keyword', ['campaign_id', 'keyword'])
export class PostedProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campaign_id: string;

  @Column()
  product_id: string;

  /** The search keyword this product was posted under — powers per-keyword deep paging. */
  @Column({ type: 'varchar', nullable: true })
  keyword: string | null;

  @CreateDateColumn()
  created_at: Date;
}
