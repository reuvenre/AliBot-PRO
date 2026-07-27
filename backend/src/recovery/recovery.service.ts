import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Earning } from '../earnings/earning.entity';
import { Post } from '../posts/post.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { PostsService } from '../posts/posts.service';
import { ProductsService } from '../products/products.service';

/**
 * Sales-recovery auto-push. When a user's attributed orders drop below their configured
 * threshold within the window, publish extra hot products — alternating between products
 * the audience already BOUGHT but we never posted, and AliExpress best-sellers — to the
 * groups the user's active campaigns target, until orders recover. Capped per day.
 *
 * Distinct from the paid-ads boost_* settings; this is organic content.
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  private running = false;

  constructor(
    @InjectRepository(Earning) private readonly earnings: Repository<Earning>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    private readonly credentials: CredentialsService,
    private readonly postsService: PostsService,
    private readonly products: ProductsService,
  ) {}

  /** Hourly at :05 (offset from the other minute/quarter crons). One publish per tick,
   *  capped by recovery_posts_per_day; the scheduler paces delivery per group. */
  @Cron('0 5 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const users = await this.credentials.recoverySettings();
      for (const u of users) {
        try { await this.runForUser(u); }
        catch (err: any) { this.logger.warn(`recovery for ${u.userId} failed: ${err?.message}`); }
      }
    } catch (err: any) {
      this.logger.error(`recovery tick failed: ${err?.message}`);
    } finally {
      this.running = false;
    }
  }

  private async runForUser(u: { userId: string; minOrders: number; windowDays: number; postsPerDay: number; campaignIds: string[] }): Promise<void> {
    const now = Date.now();

    // 1) Orders in the window (one earnings row per order). Healthy → nothing to do.
    const windowStart = new Date(now - u.windowDays * 86_400_000);
    const orders = await this.earnings.count({ where: { user_id: u.userId, order_date: MoreThan(windowStart) } });
    if (orders >= u.minOrders) return;

    // 2) Daily cap on recovery posts.
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const boostToday = await this.posts.count({ where: { user_id: u.userId, is_boost: true, created_at: MoreThan(startOfDay) } });
    if (boostToday >= u.postsPerDay) return;

    // 3) Target groups = the union of the participating active campaigns' target channels.
    //    An explicit campaignIds selection narrows it; empty = every active campaign.
    const active = await this.campaigns.find({ where: { user_id: u.userId, status: 'active' as any } });
    const selected = u.campaignIds.length
      ? active.filter((c) => u.campaignIds.includes(String(c.id)))
      : active;
    const groups = new Set<string>();
    for (const c of selected) {
      try { for (const g of JSON.parse(c.target_channels || '[]')) if (g) groups.add(String(g)); } catch { /* ignore */ }
    }
    const groupList = [...groups];
    if (!groupList.length) return; // nowhere to publish

    // 4) Products we've already posted (any status) — never re-push these.
    const postedRows = await this.posts.createQueryBuilder('p')
      .select('DISTINCT p.product_id', 'product_id')
      .where('p.user_id = :uid', { uid: u.userId })
      .getRawMany();
    const posted = new Set(postedRows.map((r) => String(r.product_id)));

    // 5) Pick a fresh product — alternate the two sources by the daily counter.
    const product = (boostToday % 2 === 0)
      ? (await this.pickBoughtNotPosted(u.userId, posted)) || (await this.pickBestSeller(u.userId, posted))
      : (await this.pickBestSeller(u.userId, posted)) || (await this.pickBoughtNotPosted(u.userId, posted));
    if (!product) { this.logger.log(`recovery ${u.userId}: no fresh product found`); return; }

    // 6) Target group (rotate across the campaigns' groups).
    const group = groupList[boostToday % groupList.length];

    // 7) Publish as a SCHEDULED post (paced per group by the scheduler, independent of the
    //    manual queue toggle), then flag it so it counts toward the daily cap.
    const saved = await this.postsService.createQueuedPost(
      u.userId,
      {
        product_id: String(product.product_id),
        title: product.title || '',
        image_url: product.image_url || '',
        affiliate_url: product.affiliate_url || product.product_url || '',
        sale_price: Number(product.sale_price) || 0,
        original_price: Number(product.original_price) || Number(product.sale_price) || 0,
        currency: product.currency || '',
        discount_percent: Number(product.discount_percent) || 0,
        orders_count: Number(product.orders_count) || 0,
        rating: Number(product.rating) || 0,
      },
      undefined, undefined, group, undefined, undefined, [group],
      { scheduledAt: new Date() },
    );
    if (saved) {
      saved.is_boost = true;
      await this.posts.save(saved).catch(() => {});
      this.logger.log(`recovery ${u.userId}: pushed product ${product.product_id} → group ${group} (orders=${orders}<${u.minOrders})`);
    }
  }

  /** A top AliExpress best-seller we haven't posted yet. */
  private async pickBestSeller(userId: string, posted: Set<string>): Promise<any | null> {
    try {
      const res: any = await this.products.getFeatured(userId, { sort: 'best_selling', page: 1, limit: 50 });
      const items: any[] = res?.data || [];
      return items.find((p) => p?.product_id && !posted.has(String(p.product_id))) || null;
    } catch { return null; }
  }

  /** A product the audience bought in the last 30d that we never posted. refreshPrice
   *  returns the exact product (by id) or null, so a mismatch can't publish a wrong item. */
  private async pickBoughtNotPosted(userId: string, posted: Set<string>): Promise<any | null> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.earnings.createQueryBuilder('e')
      .select('DISTINCT e.product_id', 'product_id')
      .where('e.user_id = :uid', { uid: userId })
      .andWhere('e.order_date > :since', { since })
      .getRawMany()
      .catch(() => []);
    const candidates = rows.map((r) => String(r.product_id)).filter((id) => id && !posted.has(id)).slice(0, 8);
    for (const id of candidates) {
      const p = await this.products.refreshPrice(userId, id).catch(() => null);
      if (p && String(p.product_id) === id && p.title && Number(p.sale_price) > 0) return p;
    }
    return null;
  }
}
