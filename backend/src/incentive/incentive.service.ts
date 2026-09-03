import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { IncentiveProgram } from './incentive-program.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { User } from '../users/user.entity';
import { Post } from '../posts/post.entity';
import { Earning } from '../earnings/earning.entity';
import { AiService } from '../ai/ai.service';
import { knownPoolKeywords, parsePoolKeywords, POOL_KEYWORDS_SYSTEM, PoolSuggestion } from './pool-keywords';
import { poolAppliesTo } from './pool-targets';

export interface IncentiveInput {
  name?: string;
  keywords?: string[];
  target_campaigns?: string[];
  starts_at?: string;
  ends_at?: string;
  active?: boolean;
  /** The portal's incentive commission rate for this pool, in percent (11 = 11%). */
  bonus_rate_pct?: number | null;
}

/** A rate the portal could plausibly show. Anything else is a typo, not a pool. */
function cleanBonusRate(v: unknown): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

/** The Incentive Campaign page in the affiliate portal — every reminder points here.
 *  Verified by the owner; the older /campaign/index.htm path now 404s. */
const PORTAL_URL = 'https://portals.aliexpress.com/affiportals/web/incentive.htm';

@Injectable()
export class IncentiveService {
  private readonly logger = new Logger(IncentiveService.name);

  constructor(
    @InjectRepository(IncentiveProgram) private readonly repo: Repository<IncentiveProgram>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Earning) private readonly earnings: Repository<Earning>,
    private readonly credentials: CredentialsService,
    private readonly mail: MailService,
    private readonly subscription: SubscriptionService,
    private readonly ai: AiService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(userId: string): Promise<IncentiveProgram[]> {
    return this.repo.find({ where: { user_id: userId }, order: { ends_at: 'DESC' } });
  }

  async create(userId: string, dto: IncentiveInput): Promise<IncentiveProgram> {
    const row = this.repo.create({
      user_id: userId,
      name: (dto.name || '').trim() || 'קמפיין בונוס',
      keywords_json: JSON.stringify(cleanKeywords(dto.keywords)),
      target_campaigns: dto.target_campaigns?.length ? JSON.stringify(dto.target_campaigns) : null,
      starts_at: dto.starts_at ? new Date(dto.starts_at) : new Date(),
      ends_at: dto.ends_at ? new Date(dto.ends_at) : endOfMonth(new Date()),
      active: dto.active !== false,
      bonus_rate_pct: cleanBonusRate(dto.bonus_rate_pct),
    });
    return this.repo.save(row);
  }

  async update(userId: string, id: string, dto: IncentiveInput): Promise<IncentiveProgram> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('קמפיין הבונוס לא נמצא');
    if (typeof dto.name === 'string' && dto.name.trim()) row.name = dto.name.trim();
    if (Array.isArray(dto.keywords)) row.keywords_json = JSON.stringify(cleanKeywords(dto.keywords));
    if (Array.isArray(dto.target_campaigns)) {
      row.target_campaigns = dto.target_campaigns.length ? JSON.stringify(dto.target_campaigns) : null;
    }
    if (dto.starts_at) row.starts_at = new Date(dto.starts_at);
    if (dto.ends_at) row.ends_at = new Date(dto.ends_at);
    if (typeof dto.active === 'boolean') row.active = dto.active;
    if (dto.bonus_rate_pct !== undefined) row.bonus_rate_pct = cleanBonusRate(dto.bonus_rate_pct);
    return this.repo.save(row);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const row = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!row) throw new NotFoundException('קמפיין הבונוס לא נמצא');
    await this.repo.remove(row);
    return { deleted: true };
  }

  /**
   * Suggested search keywords for a pool the owner is adding. The recurring pools answer
   * from a table (instant, free, stable); anything else asks the model once. Never throws
   * and never guesses wildly — an empty list just means the owner types their own.
   */
  async suggestKeywords(userId: string, name: string): Promise<PoolSuggestion> {
    const known = knownPoolKeywords(name);
    if (known) return { keywords: known, source: 'known' };
    try {
      const creds = await this.credentials.getRaw(userId);
      if (!creds || !this.ai.hasAnyKey(creds)) return { keywords: [], source: 'ai' };
      const res = await this.ai.generate(creds, {
        system: POOL_KEYWORDS_SYSTEM,
        prompt: `Pool name: "${String(name || '').trim().slice(0, 120)}"`,
        maxTokens: 120,
        temperature: 0,
      });
      return { keywords: parsePoolKeywords(res?.text), source: 'ai' };
    } catch (err: any) {
      this.logger.warn(`pool keyword suggestion failed: ${err?.message}`);
      return { keywords: [], source: 'ai' };
    }
  }

  // ── Per-pool performance ──────────────────────────────────────────────────

  /**
   * What each pool actually PRODUCED, measured inside its own window: sent posts whose
   * keyword belongs to the pool, their clicks, and the base commissions attributed to
   * those keywords. This answers "which pool is worth my registrations" — the screen
   * otherwise showed six identical-looking cards with no way to tell.
   *
   * Honesty note carried to the UI: revenue here is the NORMAL commission the pool's
   * keywords earned — the bonus itself is paid by AliExpress on top and never appears
   * in our data. A pool with orders is a pool whose bonus is accruing.
   */
  async stats(userId: string): Promise<Record<string, {
    posts: number; clicks: number; orders: number; revenue_ils: number;
    order_amount_usd: number; bonus_estimate_usd: number | null; bonus_paid_usd: number;
  }>> {
    const out: Record<string, {
      posts: number; clicks: number; orders: number; revenue_ils: number;
      order_amount_usd: number; bonus_estimate_usd: number | null; bonus_paid_usd: number;
    }> = {};
    const rows = await this.list(userId);
    for (const r of rows) {
      let kws: string[] = [];
      try { kws = JSON.parse(r.keywords_json || '[]'); } catch { kws = []; }
      const lower = kws.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
      out[r.id] = { posts: 0, clicks: 0, orders: 0, revenue_ils: 0, order_amount_usd: 0, bonus_estimate_usd: null, bonus_paid_usd: 0 };
      if (!lower.length) continue;
      // Measure only inside the pool window — the bonus accrues only there, so posts
      // published before registration must not flatter the pool's numbers.
      const start = new Date(r.starts_at);
      const end = new Date(Math.min(new Date(r.ends_at).getTime(), Date.now()));
      if (end <= start) continue;
      const p = await this.posts.createQueryBuilder('p')
        .select('COUNT(*)', 'posts')
        // Short-link clicks PLUS Pinterest outbound clicks: a pin's click never passes
        // through /r/<code> — it arrives via the Pinterest analytics sync into
        // posts.pinterest_clicks. clicks_count alone showed a bonus-pool pin as 0 clicks.
        .addSelect('COALESCE(SUM(p.clicks_count + COALESCE(p.pinterest_clicks, 0)), 0)', 'clicks')
        .where('p.user_id = :u', { u: userId })
        .andWhere("p.status = 'sent'")
        .andWhere('LOWER(p.keyword) IN (:...kws)', { kws: lower })
        .andWhere('p.sent_at BETWEEN :s AND :e', { s: start, e: end })
        .getRawOne()
        .catch(() => null);
      const e = await this.earnings.createQueryBuilder('e')
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(e.commission_ils), 0)', 'revenue')
        // The BONUS is computed by the portal on the order amount, not on the commission
        // (26.92 paid × 11% = 2.96 incentive), so the amount is what the estimate needs.
        .addSelect('COALESCE(SUM(e.order_amount_usd), 0)', 'amount')
        // What AliExpress actually paid in bonus on these orders. Where the feed carried
        // it there is nothing to estimate.
        .addSelect('COALESCE(SUM(e.incentive_commission_usd), 0)', 'bonus_paid')
        .where('e.user_id = :u', { u: userId })
        .andWhere("e.status != 'cancelled'")
        .andWhere('LOWER(e.keyword) IN (:...kws)', { kws: lower })
        .andWhere('e.order_date BETWEEN :s AND :e', { s: start, e: end })
        .getRawOne()
        .catch(() => null);
      const amountUsd = +(Number(e?.amount) || 0).toFixed(2);
      out[r.id] = {
        posts: Number(p?.posts) || 0,
        clicks: Number(p?.clicks) || 0,
        orders: Number(e?.orders) || 0,
        revenue_ils: +(Number(e?.revenue) || 0).toFixed(2),
        order_amount_usd: amountUsd,
        // Only with a rate the owner read off the portal. Without one the screen says
        // nothing rather than inventing a number that looks like money already earned.
        bonus_estimate_usd: r.bonus_rate_pct && r.bonus_rate_pct > 0
          ? +(amountUsd * (r.bonus_rate_pct / 100)).toFixed(2)
          : null,
        // The REAL bonus, when the order feed carried it. An estimate is what you show
        // when you don't have the number; here we increasingly do.
        bonus_paid_usd: +(Number(e?.bonus_paid) || 0).toFixed(2),
      };
    }
    return out;
  }

  // ── What the autopilot consumes ───────────────────────────────────────────

  /**
   * The bonus keywords in force for THIS campaign, right now. A program steers only the
   * campaigns it names — an unassigned one steers nothing at all, and "every campaign" is
   * the `*` sentinel the owner picks deliberately (see pool-targets.ts). That is what keeps
   * a Home & Living bonus from pushing kitchen organisers into a tactical channel.
   *
   * Never throws: a failure here means the campaign runs on its own keywords, which is
   * exactly the pre-bonus behaviour — earning less is not a reason to publish nothing.
   */
  /**
   * Pool ids that have produced at least one order inside their own window.
   *
   * A pool that sells is the strongest buy signal the account has — the category is proven
   * AND every further sale in it pays the bonus on top — so the rotation gives its keywords
   * the top tier. Measured inside the pool's window only: orders from before registration
   * were never going to earn a bonus and must not vouch for the pool.
   */
  private async provenPoolIds(userId: string, poolIds: string[]): Promise<Set<string>> {
    if (!poolIds.length) return new Set();
    try {
      return await this.queryProvenPoolIds(userId, poolIds);
    } catch (err: any) {
      // Knowing WHICH pool sold is an enhancement; the pool keywords themselves are the
      // feature. A failure here must cost the caller the tier, never the keywords — this
      // ran inside the caller's try/catch and a throw wiped the whole rotation boost.
      this.logger.warn(`proven-pool lookup failed: ${err?.message}`);
      return new Set();
    }
  }

  private async queryProvenPoolIds(userId: string, poolIds: string[]): Promise<Set<string>> {
    const rows: Array<{ id: string; orders: number }> = await this.repo.query(
      `SELECT p.id, count(e.id)::int AS orders
       FROM incentive_programs p
       LEFT JOIN earnings e
         ON e.user_id = p.user_id
        AND e.status <> 'cancelled'
        AND e.order_date BETWEEN p.starts_at AND least(p.ends_at, now())
        AND lower(e.keyword) IN (
          SELECT lower(trim(k)) FROM jsonb_array_elements_text(p.keywords_json::jsonb) AS k
        )
       WHERE p.id = ANY($1::uuid[]) AND p.user_id = $2
       GROUP BY p.id`,
      [poolIds, userId],
    );
    return new Set((rows || []).filter((r) => Number(r.orders) > 0).map((r) => String(r.id)));
  }

  async keywordsFor(
    userId: string, campaignId: string, channels: string[] = [],
  ): Promise<{ keywords: string[]; names: string[]; proven: string[] }> {
    try {
      // Plan gate: steering the rotation is an Autopilot-tier feature. Recording pools
      // and getting the monthly reminder stay open to every plan — knowing the money is
      // there is free, having the system chase it is what's paid for.
      if (!(await this.subscription.allows(userId, 'incentive_steering'))) {
        return { keywords: [], names: [], proven: [] };
      }
      const now = new Date();
      const rows = await this.repo.find({ where: { user_id: userId, active: true } });
      // `active` is re-checked here, not left to the query alone: this is the owner's
      // off switch, and a correctness gate this cheap should be visible in the code that
      // decides — not only in a where-clause one layer away.
      const live = rows.filter((r) => r.active !== false
        && new Date(r.starts_at) <= now && new Date(r.ends_at) >= now);
      const keywords: string[] = [];
      const names: string[] = [];
      // Keywords per matched pool, so the ones belonging to a pool that SOLD can be handed
      // to the rotation as its own (higher) tier.
      const byPool = new Map<string, string[]>();
      for (const r of live) {
        // Targeting is an explicit choice, both ways — an unassigned pool steers nothing
        // and a fan-out across every campaign is the `*` sentinel. See pool-targets.ts for
        // why the old "empty = everywhere" default cost more than it earned.
        if (!poolAppliesTo(r.target_campaigns, campaignId, channels)) continue;
        let kws: string[] = [];
        try { kws = JSON.parse(r.keywords_json || '[]'); } catch { kws = []; }
        const clean = cleanKeywords(kws);
        if (!clean.length) continue;
        names.push(r.name);
        byPool.set(r.id, clean);
        for (const k of clean) if (!keywords.includes(k)) keywords.push(k);
      }
      const provenIds = await this.provenPoolIds(userId, Array.from(byPool.keys()));
      const proven: string[] = [];
      for (const id of provenIds) {
        for (const k of byPool.get(id) || []) if (!proven.includes(k)) proven.push(k);
      }
      return { keywords, names, proven };
    } catch (err: any) {
      this.logger.warn(`incentive keywords lookup failed: ${err?.message}`);
      return { keywords: [], names: [], proven: [] };
    }
  }

  // ── Monthly registration reminder ─────────────────────────────────────────

  /**
   * The portal's pools reset every month and bonuses only count from the moment you
   * register — a month you forget is a month of ordinary commission. Fires on the 1st
   * at 09:00 Israel time, and again mid-month for anyone with nothing recorded, because
   * "I'll do it later" is exactly how the first reminder gets lost.
   */
  @Cron('0 9 1,15 * *', { timeZone: process.env.SCHEDULER_TZ || 'Asia/Jerusalem' })
  async remindRegistration(): Promise<void> {
    const day = new Date().getDate();
    const admins = await this.users.find({ where: { role: 'admin' } }).catch(() => [] as User[]);
    for (const admin of admins) {
      try {
        const live = (await this.list(admin.id)).filter((r) => r.active && new Date(r.ends_at) >= new Date());
        // Mid-month is the nag for an empty list only; the 1st always goes out.
        if (day !== 1 && live.length) continue;
        const lines = live.length
          ? live.map((r) => `• ${r.name} — עד ${new Date(r.ends_at).toLocaleDateString('he-IL')}`)
          : ['(לא רשומים אצלך קמפייני בונוס פעילים במערכת)'];
        const subject = day === 1
          ? '🎁 קמפייני בונוס חדשים באלי אקספרס — זמן להירשם'
          : '🎁 תזכורת: עדיין לא רשמת קמפייני בונוס החודש';
        const body = [
          day === 1
            ? 'הפולים החודשיים בפורטל השותפים התחדשו. הרשמה היא חינם, אבל בונוס נצבר רק על הזמנות שנעשו אחרי ההרשמה.'
            : 'חצי חודש עבר ואין קמפייני בונוס פעילים במערכת — כל מכירה בקטגוריות האלה מוותרת על הבונוס.',
          '',
          'מה שרשום אצלך כרגע:',
          ...lines,
          '',
          `הירשם בפורטל: ${PORTAL_URL}`,
          'ואז הוסף אותם במסך "קמפייני בונוס" כדי שהטייס יעדיף את הקטגוריות שמזכות בבונוס.',
        ].join('\n');

        await this.notify(admin, subject, body);
      } catch (err: any) {
        this.logger.warn(`incentive reminder failed for ${admin.id}: ${err?.message}`);
      }
    }
  }

  /** Email + a Telegram DM through the owner's own bot. Best-effort, both independent. */
  private async notify(admin: User, subject: string, body: string): Promise<void> {
    await this.mail.sendHtml(
      admin.email, subject,
      `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;line-height:1.7">
        <h3 style="margin:0 0 10px">${subject}</h3>
        <p style="white-space:pre-line;color:#374151">${body}</p>
      </div>`,
    ).catch((err: any) => this.logger.warn(`incentive reminder email failed: ${err?.message}`));

    const chatId = process.env.WATCHDOG_TELEGRAM_CHAT_ID;
    if (!chatId) return;
    const token = process.env.WATCHDOG_TELEGRAM_BOT_TOKEN
      || await this.credentials.getTelegramToken(admin.id).catch(() => null);
    if (!token) return;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId, text: `${subject}\n\n${body}`, disable_web_page_preview: true,
    }, { timeout: 12000 }).catch((err: any) => this.logger.warn(`incentive reminder telegram failed: ${err?.message}`));
  }
}

/** Trim, drop empties and duplicates, cap the list — these join a live search rotation. */
function cleanKeywords(input?: string[] | null): string[] {
  const out: string[] = [];
  for (const raw of input || []) {
    const k = String(raw || '').trim();
    if (!k || k.length > 60) continue;
    if (!out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k);
    if (out.length >= 12) break;
  }
  return out;
}

/** Last moment of `d`'s month — the portal's pools run to month end. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
