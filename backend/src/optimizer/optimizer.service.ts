import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Campaign } from '../campaigns/campaign.entity';
import { OptimizerRun } from './optimizer-run.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MailService } from '../mail/mail.service';

interface KeywordScore { keyword: string; posts: number; clicks: number; revenue_ils: number }
interface CampaignActions { campaign: string; retired: string[]; boosted: string | null; unboosted: string[] }

/** Scoring window — long enough for commissions to land, short enough to track trends. */
const WINDOW_DAYS = 14;
/** A keyword must have had this many posted products before it can be judged dead. */
const MIN_POSTS_TO_JUDGE = 5;
/** Never optimize a campaign below this many distinct active keywords. */
const MIN_ACTIVE_KEYWORDS = 5;
/** At most this many retirements per campaign per day — slow, reversible pressure. */
const MAX_RETIRE_PER_DAY = 3;

/**
 * The learning loop: publish → measure → LEARN → adjust. Runs every morning, scores each
 * campaign's keywords by what they actually produced (posted products → clicks → attributed
 * commissions), then applies small, safe, reversible adjustments:
 *   • RETIRE keywords that got a real chance (≥5 posts) and produced zero clicks — into
 *     campaign.retired_keywords, never deleted, floor of 5 active keywords.
 *   • BOOST the top-earning keyword by doubling its slot in the round-robin (max 2×),
 *     and collapse a boost whose window revenue dried up.
 * Then it tells the owner what it did — morning digest to Telegram (the watchdog chat)
 * and email: yesterday's numbers, top product, golden hours, actions taken.
 */
@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(OptimizerRun) private readonly runs: Repository<OptimizerRun>,
    private readonly credentials: CredentialsService,
    private readonly subscription: SubscriptionService,
    private readonly mail: MailService,
  ) {}

  /** 03:15 UTC = morning Israel — after the nightly earnings sync, before the day's posts. */
  @Cron('0 15 3 * * *')
  async runDaily(): Promise<void> {
    let userIds: string[] = [];
    try {
      userIds = await this.credentials.listUserIdsWithOptimizer();
    } catch (err: any) {
      this.logger.error(`optimizer user scan failed: ${err.message}`);
      return;
    }
    for (const uid of userIds) {
      try {
        await this.runForUser(uid);
      } catch (err: any) {
        this.logger.error(`optimizer failed for ${uid}: ${err.message}`);
      }
    }
  }

  async runForUser(userId: string): Promise<void> {
    if (!(await this.subscription.allows(userId, 'learning_optimizer'))) return;

    const active = await this.campaigns.find({
      where: { user_id: userId, status: 'active', source: 'aliexpress' },
    });
    const allActions: CampaignActions[] = [];
    const allScores: Record<string, KeywordScore[]> = {};

    for (const c of active) {
      const scores = await this.scoreKeywords(userId, c.id);
      allScores[c.name] = scores;
      const actions = await this.applyActions(c, scores);
      if (actions.retired.length || actions.boosted || actions.unboosted.length) {
        allActions.push(actions);
      }
    }

    const stats = await this.digestStats(userId);
    const digest = this.buildDigest(stats, allActions);

    await this.runs.save(this.runs.create({
      user_id: userId,
      summary_json: JSON.stringify({ scores: allScores, actions: allActions, stats }),
    })).catch(() => {});

    await this.deliverDigest(userId, digest);
  }

  /**
   * Keyword scorecard over the window: how many products it posted, the clicks those
   * posts drew, and the commissions attributed to those products after their posts went
   * out. Attribution is heuristic (same product, order after post) — the same signal the
   * attribution report uses; good enough to rank keywords, not an accounting statement.
   */
  private async scoreKeywords(userId: string, campaignId: string): Promise<KeywordScore[]> {
    const rows: any[] = await this.campaigns.query(
      `SELECT pp.keyword,
              count(DISTINCT pp.product_id)::int                    AS posts,
              coalesce(sum(p.clicks_count), 0)::int                 AS clicks,
              coalesce((
                SELECT sum(e.commission_ils)
                FROM earnings e
                WHERE e.user_id = $1
                  AND e.product_id IN (
                    SELECT pp2.product_id FROM campaign_posted_products pp2
                    WHERE pp2.campaign_id = $2 AND pp2.keyword = pp.keyword
                      AND pp2.created_at > now() - ($3 || ' days')::interval
                  )
                  AND e.order_date > now() - ($3 || ' days')::interval
              ), 0)::float                                          AS revenue_ils
       FROM campaign_posted_products pp
       LEFT JOIN posts p
         ON p.campaign_id = pp.campaign_id AND p.product_id = pp.product_id AND p.status = 'sent'
       WHERE pp.campaign_id = $2
         AND pp.keyword IS NOT NULL
         AND pp.created_at > now() - ($3 || ' days')::interval
       GROUP BY pp.keyword`,
      [userId, campaignId, String(WINDOW_DAYS)],
    ).catch(() => []);
    return rows.map((r) => ({
      keyword: String(r.keyword),
      posts: Number(r.posts) || 0,
      clicks: Number(r.clicks) || 0,
      revenue_ils: +(Number(r.revenue_ils) || 0).toFixed(2),
    }));
  }

  /** Small, safe, reversible adjustments to the campaign's keyword rotation. */
  private async applyActions(c: Campaign, scores: KeywordScore[]): Promise<CampaignActions> {
    const out: CampaignActions = { campaign: c.name, retired: [], boosted: null, unboosted: [] };
    const byKw = new Map(scores.map((s) => [s.keyword, s]));
    let kws = [...(c.keywords || [])];
    const distinct = () => Array.from(new Set(kws));

    // 1) Collapse stale boosts: a duplicated keyword whose window revenue dried up goes
    //    back to a single slot (fully reversible pressure valve).
    for (const kw of distinct()) {
      const copies = kws.filter((k) => k === kw).length;
      if (copies > 1 && (byKw.get(kw)?.revenue_ils || 0) <= 0) {
        kws = kws.filter((k) => k !== kw); kws.push(kw);
        out.unboosted.push(kw);
      }
    }

    // 2) Retire dead keywords: a fair chance (≥MIN_POSTS_TO_JUDGE products posted) and not
    //    a single click. Into retired_keywords (visible, restorable), never below the floor.
    const dead = scores
      .filter((s) => s.posts >= MIN_POSTS_TO_JUDGE && s.clicks === 0 && s.revenue_ils <= 0)
      .map((s) => s.keyword)
      .filter((kw) => kws.includes(kw));
    for (const kw of dead.slice(0, MAX_RETIRE_PER_DAY)) {
      if (distinct().length <= MIN_ACTIVE_KEYWORDS) break;
      kws = kws.filter((k) => k !== kw);
      c.retired_keywords = Array.from(new Set([...(c.retired_keywords || []), kw]));
      out.retired.push(kw);
    }

    // 3) Boost the top earner: double its slot in the round-robin (cap 2×) so it posts
    //    twice per cycle. Only one boosted keyword at a time — focus beats spray.
    const top = [...scores].sort((a, b) => b.revenue_ils - a.revenue_ils)[0];
    if (top && top.revenue_ils > 0 && kws.includes(top.keyword)) {
      const copies = kws.filter((k) => k === top.keyword).length;
      if (copies === 1) { kws.push(top.keyword); out.boosted = top.keyword; }
    }

    if (out.retired.length || out.boosted || out.unboosted.length) {
      c.keywords = kws;
      await this.campaigns.save(c).catch((err: any) =>
        this.logger.warn(`optimizer save failed for campaign ${c.id}: ${err.message}`));
      this.logger.log(`optimizer [${c.name}]: retired=${out.retired.join(',') || '—'} boosted=${out.boosted || '—'} unboosted=${out.unboosted.join(',') || '—'}`);
    }
    return out;
  }

  /** Yesterday's numbers + golden hours + top product — the digest's raw material. */
  private async digestStats(userId: string) {
    const q = (sql: string, params: any[]) => this.campaigns.query(sql, params).catch(() => []);
    const [posts] = await q(
      `SELECT count(*)::int AS n FROM posts
       WHERE user_id = $1 AND status = 'sent' AND sent_at > now() - interval '1 day'`, [userId]);
    const [clicks] = await q(
      `SELECT count(*)::int AS n FROM link_clicks
       WHERE user_id = $1 AND created_at > now() - interval '1 day'`, [userId]);
    const [rev] = await q(
      `SELECT count(*)::int AS orders, coalesce(sum(commission_ils), 0)::float AS ils
       FROM earnings WHERE user_id = $1 AND created_at > now() - interval '1 day'`, [userId]);
    const [topProduct] = await q(
      `SELECT product_title, clicks_count FROM posts
       WHERE user_id = $1 AND sent_at > now() - interval '7 days' AND clicks_count > 0
       ORDER BY clicks_count DESC LIMIT 1`, [userId]);
    const goldenHours: any[] = await q(
      `SELECT extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::int AS hour,
              count(*)::int AS n
       FROM link_clicks WHERE user_id = $1 AND created_at > now() - ($2 || ' days')::interval
       GROUP BY 1 ORDER BY n DESC LIMIT 3`, [userId, String(WINDOW_DAYS)]);
    return {
      posts_yesterday: Number(posts?.n) || 0,
      clicks_yesterday: Number(clicks?.n) || 0,
      orders_yesterday: Number(rev?.orders) || 0,
      revenue_yesterday_ils: +(Number(rev?.ils) || 0).toFixed(2),
      top_product: topProduct?.product_title ? String(topProduct.product_title).slice(0, 60) : null,
      top_product_clicks: Number(topProduct?.clicks_count) || 0,
      golden_hours: goldenHours.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
    };
  }

  private buildDigest(stats: Awaited<ReturnType<OptimizerService['digestStats']>>, actions: CampaignActions[]): string {
    const lines: string[] = [];
    lines.push('🧠 דו"ח הבוקר של המנוע הלומד');
    lines.push('');
    lines.push(`📊 אתמול: ${stats.posts_yesterday} פוסטים · ${stats.clicks_yesterday} קליקים · ${stats.orders_yesterday} הזמנות (₪${stats.revenue_yesterday_ils})`);
    if (stats.top_product) lines.push(`🏆 המוביל השבוע: ${stats.top_product} (${stats.top_product_clicks} קליקים)`);
    if (stats.golden_hours.length) lines.push(`⏰ שעות הזהב שלך: ${stats.golden_hours.join(', ')}`);
    if (actions.length) {
      lines.push('');
      lines.push('🔧 מה כיוונתי הלילה:');
      for (const a of actions) {
        if (a.boosted) lines.push(`  • [${a.campaign}] הכפלתי את "${a.boosted}" — היא מייצרת עמלות`);
        for (const kw of a.retired) lines.push(`  • [${a.campaign}] הוצאתי את "${kw}" — ${MIN_POSTS_TO_JUDGE}+ פוסטים בלי קליק אחד`);
        for (const kw of a.unboosted) lines.push(`  • [${a.campaign}] החזרתי את "${kw}" למינון רגיל — ההכנסות מהחלון האחרון התייבשו`);
      }
    } else {
      lines.push('');
      lines.push('🔧 הלילה לא נדרש כוונון — הרוטציה מאוזנת.');
    }
    return lines.join('\n');
  }

  /** Telegram (the owner's watchdog chat, via the user's own bot) + email. Best-effort. */
  /**
   * Email is the digest's home for EVERY user — it's the one channel that is provably
   * theirs. Telegram is an extra, and only for the platform operator: the watchdog chat
   * is the owner's, so routing a customer's keyword and revenue report there would leak
   * their business data into someone else's inbox.
   */
  private async deliverDigest(userId: string, text: string): Promise<void> {
    const { email, isAdmin } = await this.credentials.userContact(userId).catch(
      () => ({ email: null as string | null, isAdmin: false }),
    );

    if (isAdmin) {
      try {
        const chatId = process.env.WATCHDOG_TELEGRAM_CHAT_ID;
        const creds = await this.credentials.getRaw(userId).catch(() => null);
        const token = process.env.WATCHDOG_TELEGRAM_BOT_TOKEN || creds?.telegram_bot_token;
        if (chatId && token) {
          await axios.post(`https://api.telegram.org/bot${token}/sendMessage`,
            { chat_id: chatId, text }, { timeout: 10_000 });
        }
      } catch (err: any) {
        this.logger.warn(`digest telegram failed: ${err?.message}`);
      }
    }

    try {
      if (email && this.mail.isConfigured()) {
        await this.mail.sendHtml(email, '🧠 Nexlify — דו"ח הבוקר של המנוע הלומד',
          `<div dir="rtl" style="font-family:Arial,sans-serif;white-space:pre-line;padding:16px">${text}</div>`);
      }
    } catch (err: any) {
      this.logger.warn(`digest email failed: ${err?.message}`);
    }
  }
}
