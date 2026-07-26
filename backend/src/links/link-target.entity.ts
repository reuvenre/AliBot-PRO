import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Durable destination for a short-link code. Written when a post's /r/<code> link is
 * built, and kept even if the post is later deleted — so a link already printed into a
 * permanent public post (a Facebook ad, a Telegram message) never breaks.
 */
@Entity('link_targets')
export class LinkTarget {
  @PrimaryColumn()
  code: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
