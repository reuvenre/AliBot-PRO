import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Storefront } from './storefront.entity';
import { User } from '../users/user.entity';
import { LinksService } from '../links/links.service';
import { nextFreeSlug, slugError } from './store-slug';

/** One product as the public store shows it. */
export interface StoreProduct {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  gallery: string[];
  price: number;
  currency: string;
  /** Where it came from: 'supplier' (hidden-brand catalog) or 'post' (published deal). */
  source: 'supplier' | 'post';
  /** Group it was published to, when it was — the store's own filter. */
  group: string | null;
  /** ISO date it was last published, newest-first ordering. */
  at: string | null;
}

const PAGE_SIZE = 24;

/**
 * The public storefront: every product a customer publishes, in one browsable place.
 *
 * Reads across two catalogs. The supplier catalog is the hidden-brand shelf — products
 * linked to a FLYLINK affiliate link, whether or not they have been posted yet, because
 * the store is the full offering and not a publication log. The posts side is everything
 * that went out to the channels, deduplicated to one row per product.
 */
@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    @InjectRepository(Storefront) private readonly repo: Repository<Storefront>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly links: LinksService,
  ) {}

  // ── Owner side ─────────────────────────────────────────────────────────────

  /** The owner's store, created on first look so the settings screen always has one. */
  async mine(userId: string): Promise<Storefront> {
    const existing = await this.repo.findOne({ where: { user_id: userId } });
    if (existing) return existing;

    const user = await this.users.findOne({ where: { id: userId } });
    const seed = user?.name?.trim() || (user?.email || '').split('@')[0] || 'store';
    const taken = (await this.repo.find({ select: ['slug'] })).map((s) => s.slug);
    return this.repo.save(this.repo.create({
      user_id: userId,
      slug: nextFreeSlug(seed, taken),
      name: user?.name?.trim() || 'החנות שלי',
      enabled: false,
    }));
  }

  async update(userId: string, dto: Partial<Storefront>): Promise<Storefront> {
    const store = await this.mine(userId);

    if (dto.slug !== undefined) {
      const slug = String(dto.slug || '').trim().toLowerCase();
      const err = slugError(slug);
      if (err) throw new BadRequestException(err);
      if (slug !== store.slug) {
        const clash = await this.repo.findOne({ where: { slug } });
        if (clash) throw new BadRequestException('הכתובת הזו כבר תפוסה — בחר אחרת');
        store.slug = slug;
      }
    }
    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (!name) throw new BadRequestException('שם החנות לא יכול להיות ריק');
      store.name = name.slice(0, 60);
    }
    for (const key of ['tagline', 'whatsapp', 'shipping_text', 'details_text'] as const) {
      if (dto[key] !== undefined) (store as any)[key] = (String(dto[key] ?? '').trim() || null);
    }
    if (dto.enabled !== undefined) store.enabled = !!dto.enabled;
    if (dto.sources !== undefined) {
      const wanted = String(dto.sources || '').split(',').map((s) => s.trim())
        .filter((s) => s === 'suppliers' || s === 'posts');
      if (!wanted.length) throw new BadRequestException('בחר לפחות מקור מוצרים אחד');
      store.sources = wanted.join(',');
    }
    return this.repo.save(store);
  }

  /** The public address, for the settings screen and the post footer. */
  storeUrl(slug: string): string {
    const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
    return `${base}/s/${slug}`;
  }

  // ── Public side ────────────────────────────────────────────────────────────

  /** A live store by its address, or 404. A disabled store does not exist publicly. */
  async bySlug(slug: string): Promise<Storefront> {
    const store = await this.repo.findOne({ where: { slug: String(slug || '').toLowerCase() } });
    if (!store || !store.enabled) throw new NotFoundException('החנות לא נמצאה');
    return store;
  }

  /** The store's header, and the filter values that actually have products behind them. */
  async publicMeta(slug: string) {
    const store = await this.bySlug(slug);
    const [brands, groups] = await Promise.all([
      this.distinctBrands(store),
      this.distinctGroups(store),
    ]);
    return {
      slug: store.slug,
      name: store.name,
      tagline: store.tagline,
      whatsapp: store.whatsapp,
      shipping_text: store.shipping_text,
      details_text: store.details_text,
      brands,
      groups,
    };
  }

  /**
   * A page of products, newest first.
   *
   * Deliberately one query per source rather than a UNION with pagination pushed into SQL:
   * the two catalogs have different shapes and different notions of "when", and a wrong
   * merge shows a customer the wrong price. Merged and paged here, where it is readable.
   */
  async publicProducts(slug: string, opts: {
    page?: number; brand?: string; group?: string; q?: string;
  } = {}): Promise<{ products: StoreProduct[]; total: number; page: number; pages: number }> {
    const store = await this.bySlug(slug);
    const sources = store.sources.split(',');
    const all: StoreProduct[] = [];

    if (sources.includes('suppliers')) all.push(...await this.supplierProducts(store));
    if (sources.includes('posts')) all.push(...await this.postProducts(store));

    // A product that is both in the supplier catalog and published keeps ONE card — the
    // supplier row wins, because it carries the gallery and the live stock flag.
    const seen = new Set<string>();
    let merged = all.filter((p) => {
      const key = `${p.title.trim().toLowerCase()}|${p.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const q = (opts.q || '').trim().toLowerCase();
    if (q) merged = merged.filter((p) => p.title.toLowerCase().includes(q)
      || (p.brand || '').toLowerCase().includes(q));
    if (opts.brand) merged = merged.filter((p) => (p.brand || '') === opts.brand);
    if (opts.group) merged = merged.filter((p) => (p.group || '') === opts.group);

    merged.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

    const page = Math.max(1, Number(opts.page) || 1);
    const pages = Math.max(1, Math.ceil(merged.length / PAGE_SIZE));
    return {
      products: merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: merged.length,
      page,
      pages,
    };
  }

  /** One product page, with the buy link already turned into a tracked one. */
  async publicProduct(slug: string, id: string): Promise<StoreProduct & { buy_url: string }> {
    const store = await this.bySlug(slug);
    const [kind, realId] = String(id || '').split(':');

    const product = kind === 'p'
      ? (await this.postProducts(store, realId))[0]
      : (await this.supplierProducts(store, realId))[0];
    if (!product) throw new NotFoundException('המוצר לא נמצא');

    return { ...product, buy_url: await this.buyUrl(store, kind, realId) };
  }

  /**
   * The tracked destination for the buy button.
   *
   * Routed through the same /r/<code> redirect the posts use, so a sale that started on
   * the store is not invisible to the learning engine — a store click and a channel click
   * are the same evidence about the same product, and only one of them was being counted.
   */
  private async buyUrl(store: Storefront, kind: string, realId: string): Promise<string> {
    const rows: Array<{ url: string; code: string | null }> = kind === 'p'
      ? await this.repo.query(
        `SELECT affiliate_url AS url, short_code AS code FROM posts WHERE id = $1 AND user_id = $2`,
        [realId, store.user_id])
      : await this.repo.query(
        `SELECT flylink_url AS url, NULL AS code FROM supplier_products WHERE id = $1 AND user_id = $2`,
        [realId, store.user_id]);
    const row = rows[0];
    if (!row?.url) throw new NotFoundException('למוצר הזה אין קישור רכישה');
    if (row.code) return this.links.shortUrl(row.code);

    // A supplier product has no post and therefore no code of its own; mint a durable one
    // so its store clicks are counted the same way.
    const code = await this.links.mintTarget(row.url, store.user_id).catch(() => null);
    return code ? this.links.shortUrl(code) : row.url;
  }

  // ── Catalog reads ──────────────────────────────────────────────────────────

  private async supplierProducts(store: Storefront, id?: string): Promise<StoreProduct[]> {
    const rows: any[] = await this.repo.query(
      `SELECT sp.id, sp.title, sp.description, sp.image_url, sp.gallery_json, sp.price,
              sp.currency, sp.last_posted_at, sp.created_at, sc.name AS catalog
       FROM supplier_products sp
       LEFT JOIN supplier_catalogs sc ON sc.id = sp.supplier_catalog_id
       WHERE sp.user_id = $1 AND sp.status = 'active'
         AND sp.flylink_url IS NOT NULL AND sp.flylink_url <> ''
         AND sp.in_stock IS DISTINCT FROM false
         ${id ? 'AND sp.id = $2' : ''}
       ORDER BY coalesce(sp.last_posted_at, sp.created_at) DESC
       LIMIT 500`,
      id ? [store.user_id, id] : [store.user_id],
    ).catch((err: any) => {
      this.logger.warn(`store supplier read failed: ${err?.message}`);
      return [];
    });

    return rows.map((r) => ({
      id: `s:${r.id}`,
      title: String(r.title || '').trim(),
      // The supplier catalog's "description" is the brand remainder off the album title
      // ("COACH") — exactly the label the card wants above the name.
      brand: (r.description ? String(r.description).trim().slice(0, 30) : null) || null,
      image: r.image_url || null,
      gallery: this.parseGallery(r.gallery_json, r.image_url),
      price: Number(r.price) || 0,
      currency: r.currency || 'USD',
      source: 'supplier' as const,
      group: r.catalog ? String(r.catalog) : null,
      at: r.last_posted_at || r.created_at
        ? new Date(r.last_posted_at || r.created_at).toISOString() : null,
    })).filter((p) => p.title && p.price > 0);
  }

  private async postProducts(store: Storefront, id?: string): Promise<StoreProduct[]> {
    // DISTINCT ON keeps the NEWEST post per product: the same deal published to three
    // groups, and every recycled rerun of it, is one shelf item — not four.
    const rows: any[] = await this.repo.query(
      `SELECT DISTINCT ON (p.product_id)
              p.id, p.product_id, p.product_title, p.product_image, p.gallery_json,
              p.price_ils, p.sent_at, p.keyword,
              coalesce(ch.name, c.name) AS grp
       FROM posts p
       LEFT JOIN channels ch ON ch.channel_id = p.channel_override AND ch.user_id = p.user_id
       LEFT JOIN campaigns c ON c.id = p.campaign_id
       WHERE p.user_id = $1 AND p.status = 'sent'
         AND p.product_id IS NOT NULL AND p.product_title <> '' AND p.price_ils > 0
         AND p.affiliate_url IS NOT NULL AND p.affiliate_url <> ''
         ${id ? 'AND p.id = $2' : ''}
       ORDER BY p.product_id, p.sent_at DESC
       LIMIT 500`,
      id ? [store.user_id, id] : [store.user_id],
    ).catch((err: any) => {
      this.logger.warn(`store post read failed: ${err?.message}`);
      return [];
    });

    return rows.map((r) => ({
      id: `p:${r.id}`,
      title: String(r.product_title || '').trim(),
      brand: r.keyword ? String(r.keyword).trim().slice(0, 30) : null,
      image: r.product_image || null,
      gallery: this.parseGallery(r.gallery_json, r.product_image),
      price: Number(r.price_ils) || 0,
      currency: 'ILS',
      source: 'post' as const,
      group: r.grp ? String(r.grp) : null,
      at: r.sent_at ? new Date(r.sent_at).toISOString() : null,
    })).filter((p) => p.title && p.price > 0);
  }

  private parseGallery(json: string | null, main: string | null): string[] {
    let list: string[] = [];
    try {
      const parsed = json ? JSON.parse(json) : [];
      if (Array.isArray(parsed)) list = parsed.map((s) => String(s)).filter(Boolean);
    } catch { list = []; }
    if (main && !list.includes(main)) list.unshift(main);
    return list.slice(0, 12);
  }

  private async distinctBrands(store: Storefront): Promise<string[]> {
    const products = await this.publicCatalog(store);
    return Array.from(new Set(products.map((p) => p.brand).filter((b): b is string => !!b)))
      .sort((a, b) => a.localeCompare(b, 'he'));
  }

  private async distinctGroups(store: Storefront): Promise<string[]> {
    const products = await this.publicCatalog(store);
    return Array.from(new Set(products.map((p) => p.group).filter((g): g is string => !!g)))
      .sort((a, b) => a.localeCompare(b, 'he'));
  }

  private async publicCatalog(store: Storefront): Promise<StoreProduct[]> {
    const sources = store.sources.split(',');
    const out: StoreProduct[] = [];
    if (sources.includes('suppliers')) out.push(...await this.supplierProducts(store));
    if (sources.includes('posts')) out.push(...await this.postProducts(store));
    return out;
  }
}
