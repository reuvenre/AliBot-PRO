import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * A customer's public deals storefront — every product they publish, in one browsable
 * place, at an address they can print into every post.
 *
 * The channel feed is a river: a follower who scrolls past a deal on Tuesday has no way
 * back to it on Thursday. The store is the standing shelf behind the river, and it is
 * also where a follower who arrived for ONE product discovers the rest of the catalog.
 *
 * One row per user. Kept out of the users table because it is a feature with its own
 * lifecycle — turned on, renamed, restyled — and the users table is on the hot path of
 * every authenticated request.
 */
@Entity('storefronts')
export class Storefront {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_storefronts_user', { unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  /**
   * The address: /s/<slug>. Unique across the platform, and effectively permanent — it
   * gets printed into public posts that outlive any rename.
   */
  @Index('idx_storefronts_slug', { unique: true })
  @Column()
  slug: string;

  /** Shown as the wordmark. */
  @Column()
  name: string;

  /** One line under the name. */
  @Column({ type: 'text', nullable: true })
  tagline: string | null;

  /**
   * Off by default. A store that went live the moment the column existed would publish a
   * customer's whole catalog — and their prices — without them ever asking for it.
   */
  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /**
   * Whether an outgoing post carries the store's address.
   *
   * Separate from `enabled` because they answer different questions. `enabled` is whether
   * the shop exists at all; this is whether the channels advertise it. An owner running a
   * campaign for one group, or testing the shop before he shows it to anyone, wants the
   * shop up and the posts clean — and turning the whole store off to get that would break
   * every address already printed in older posts.
   */
  @Column({ type: 'boolean', default: true })
  link_in_posts: boolean;

  /** WhatsApp number for the "ask about this product" button (digits, country code). */
  @Column({ type: 'text', nullable: true })
  whatsapp: string | null;

  /** The shipping accordion's text, in the owner's words. */
  @Column({ type: 'text', nullable: true })
  shipping_text: string | null;

  /** The product-details accordion's text — quality, sizing, returns. */
  @Column({ type: 'text', nullable: true })
  details_text: string | null;

  /**
   * Which catalogs feed the store: 'suppliers' (the hidden-brand catalog), 'posts'
   * (everything published to the channels), or both. Stored as a comma list.
   *
   * Suppliers only by default. The two catalogs are not the same KIND of thing: the
   * supplier shelf is a curated offering with a gallery, a brand and a stock flag, while
   * the posts side is every deal that ever went out — a different product every day, at a
   * price captured when it was published. Mixing them without being asked turns a
   * boutique into a feed. An owner who wants both switches the second one on.
   */
  @Column({ type: 'text', default: 'suppliers' })
  sources: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
