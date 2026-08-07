import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Campaign } from '../campaigns/campaign.entity';
import { Channel } from '../channels/channel.entity';
import { OptimizerRun } from './optimizer-run.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MailService } from '../mail/mail.service';
import { ProductsService } from '../products/products.service';
import { EarningsService } from '../earnings/earnings.service';
import { AiService } from '../ai/ai.service';
import { CategoryScore, SoldProduct, newKeywordsFor, scoreCategories } from './order-learning';
import { HotHoursResult, HourClicks, formatHours, hotHours } from './hot-hours';
import {
  CampaignProfile, FittedCategory, FIT_SYSTEM_PROMPT, MAX_FIT_CANDIDATES,
  buildFitPrompt, lexicalFit, parseFitVerdicts, rankFitted,
} from './campaign-fit';
import {
  MIN_CLICKS_TO_PICK_WINNER, MIN_POSTS_PER_VARIANT, VariantScore, VariantStat,
  bestVariant, scoreVariants, variantById,
} from '../posts/copy-variants';

interface KeywordScore { keyword: string; posts: number; clicks: number; revenue_ils: number }
interface CampaignActions {
  campaign: string; retired: string[]; boosted: string | null; unboosted: string[];
  /** Categories added to this campaign from what actually sold — each one judged to fit
   *  THIS group, with the reason it was judged to fit (opt-in per campaign). */
  learned: FittedCategory[];
  /** Account winners this group was NOT given, because they do not suit its audience. */
  rejected: string[];
  /** The campaign drew too few clicks in the window to call any keyword dead. */
  tooQuietToJudge: boolean;
}

/** Scoring window — long enough for commissions to land, short enough to track trends. */
const WINDOW_DAYS = 14;
/** Fallback window for a campaign too quiet to judge over the normal one. Sparse data is
 *  not the same as bad data: look further back before concluding anything. */
const SPARSE_WINDOW_DAYS = 30;
/**
 * Clicks a campaign must have drawn IN TOTAL before any of its keywords can be called dead.
 *
 * Retirement asks "did this keyword fail?", but on a low-traffic campaign the honest answer
 * is usually "nobody clicked anything this week" — a fact about the account, not about the
 * keyword. Without this floor the rule fires on silence: every keyword looks dead, three
 * are retired a day, and the rotation grinds down to the minimum for no reason at all.
 */
const MIN_CAMPAIGN_CLICKS_TO_JUDGE = 10;
/** A keyword must have had this many posted products before it can be judged dead. */
const MIN_POSTS_TO_JUDGE = 5;
/** Never optimize a campaign below this many distinct active keywords. */
const MIN_ACTIVE_KEYWORDS = 5;
/** At most this many retirements per campaign per day — slow, reversible pressure. */
const MAX_RETIRE_PER_DAY = 3;
/** How far back ORDERS are read for category learning. Wider than the keyword window:
 *  commissions are sparse, and a category needs several sales before it means anything. */
const ORDER_LEARNING_WINDOW_DAYS = 90;
/** Top-earning sold products resolved per run — bounds the affiliate API calls. */
const MAX_PRODUCTS_TO_RESOLVE = 40;
/** Product ids per productdetail.get call (the endpoint rejects very long id lists). */
const RESOLVE_CHUNK = 20;
/** Categories a campaign may GAIN per run — each one changes what reaches a real channel. */
const MAX_LEARNED_PER_RUN = 2;

/**
 * The learning loop: publish → measure → LEARN → adjust. Runs every morning, scores each
 * campaign's keywords by what they actually produced (posted products → clicks → attributed
 * commissions), then applies small, safe, reversible adjustments:
 *   • RETIRE keywords that got a real chance (≥5 posts) and produced zero clicks — into
 *     campaign.retired_keywords, never deleted, floor of 5 active keywords.
 *   • BOOST the top-earning keyword by doubling its slot in the round-robin (max 2×),
 *     and collapse a boost whose window revenue dried up.
 *   • LEARN the categories that actually sold — per group. The ranking is account-wide, so
 *     each candidate is judged against the specific campaign's audience before it is added;
 *     see campaign-fit.ts for why a shared top-N was making every group the same group.
 * Then it tells the owner what it did — morning digest to Telegram (the watchdog chat)
 * and email: yesterday's numbers, top product, golden hours, actions taken.
 */
@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Channel) private readonly channels: Repository<Channel>,
    @InjectRepository(OptimizerRun) private readonly runs: Repository<OptimizerRun>,
    private readonly credentials: CredentialsService,
    private readonly subscription: SubscriptionService,
    private readonly mail: MailService,
    private readonly products: ProductsService,
    // Judges whether an account-wide winning category suits a specific group's audience.
    private readonly ai: AiService,
    // Optional so the module still boots if earnings are ever unwired — the digest degrades
    // to whatever the standing 3-hourly sync last pulled instead of failing.
    @Optional() private readonly earnings?: EarningsService,
  ) {}

  /**
   * 10:10 Israel time, ten minutes after AliExpress closes its accounting day at 10:00 —
   * only then does the previous day's order data stop moving, so a digest sent earlier
   * reported a day that wasn't finished yet.
   *
   * The zone is explicit rather than a UTC hour because Israel observes DST: a hardcoded
   * 07:10 UTC would be 10:10 in summer and 09:10 in winter, drifting off the boundary this
   * schedule exists to sit behind.
   */
  @Cron('0 10 10 * * *', { timeZone: 'Asia/Jerusalem' })
  async runDaily(): Promise<void> {
    // Pull orders FIRST. The standing sync runs every 3 hours on a UTC grid, so the most
    // recent one before this fires landed at 09:20 Israel — BEFORE the 10:00 close, which
    // would have made the whole point of moving this schedule moot. Best-effort: a sync
    // failure must not cost the owner the digest.
    if (this.earnings) {
      const r = await this.earnings.syncAllUsers().catch((err: any) => {
        this.logger.warn(`optimizer pre-digest earnings sync failed: ${err.message}`);
        return null;
      });
      if (r) this.logger.log(`optimizer pre-digest sync: ${r.synced} new, ${r.updated} updated across ${r.users} users`);
    }

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

  /**
   * One optimization pass for a user. Returns the digest text so a manual run can show it
   * on screen immediately — waiting until tomorrow morning to find out whether the engine
   * works is not a reasonable way to verify it.
   */
  async runForUser(userId: string): Promise<{ ok: boolean; digest?: string; reason?: string }> {
    if (!(await this.subscription.allows(userId, 'learning_optimizer'))) {
      return { ok: false, reason: 'המנוע הלומד זמין במסלול Autopilot ומעלה' };
    }

    const active = await this.campaigns.find({
      where: { user_id: userId, status: 'active', source: 'aliexpress' },
    });
    const allActions: CampaignActions[] = [];
    const allScores: Record<string, KeywordScore[]> = {};

    // What actually SOLD, ranked by category. Computed once for the account: orders are not
    // reliably attributable to a campaign (most are for products the autopilot never posted),
    // so this is account-level knowledge that each campaign may opt into.
    const soldCategories = await this.learnFromOrders(userId).catch((err: any) => {
      this.logger.warn(`order learning failed for ${userId}: ${err.message}`);
      return [] as CategoryScore[];
    });

    // The groups each campaign publishes to — the audience half of "does this fit here?".
    const channelsById = await this.channelsById(userId);
    // Categories already handed to an earlier campaign in THIS run. Used only as a
    // tie-break, so equally-suitable groups drift apart instead of converging on one list.
    const claimed = new Set<string>();

    for (const c of active) {
      let scores = await this.scoreKeywords(userId, c.id, WINDOW_DAYS);
      let window = WINDOW_DAYS;
      // Too quiet to judge over the normal window? Look further back before deciding
      // anything — a keyword that drew nothing in a slow fortnight may have earned in the
      // month behind it, and the wider window is what tells those two apart.
      if (this.totalClicks(scores) < MIN_CAMPAIGN_CLICKS_TO_JUDGE) {
        scores = await this.scoreKeywords(userId, c.id, SPARSE_WINDOW_DAYS);
        window = SPARSE_WINDOW_DAYS;
      }
      allScores[c.name] = scores;
      const actions = await this.applyActions(
        userId, c, scores, soldCategories, channelsById, claimed, window,
      );
      for (const l of actions.learned) claimed.add(l.keyword.toLowerCase());
      if (actions.retired.length || actions.boosted || actions.unboosted.length
        || actions.learned.length || actions.rejected.length || actions.tooQuietToJudge) {
        allActions.push(actions);
      }
    }

    const stats = await this.digestStats(userId);
    const copyAngles = await this.copyAngleReport(userId);
    const hotByGroup = await this.groupHotHours(userId).catch(() => []);
    const digest = this.buildDigest(stats, allActions, soldCategories, active, copyAngles, hotByGroup);

    await this.runs.save(this.runs.create({
      user_id: userId,
      summary_json: JSON.stringify({ scores: allScores, actions: allActions, stats, soldCategories }),
    })).catch(() => {});

    await this.deliverDigest(userId, digest);
    return { ok: true, digest };
  }

  /**
   * Keyword scorecard over the window: how many products it posted, the clicks those
   * posts drew, and the commissions attributed to those products after their posts went
   * out. Attribution is heuristic (same product, order after post) — the same signal the
   * attribution report uses; good enough to rank keywords, not an accounting statement.
   */
  private async scoreKeywords(
    userId: string, campaignId: string, windowDays: number,
  ): Promise<KeywordScore[]> {
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
      [userId, campaignId, String(windowDays)],
    ).catch(() => []);
    return rows.map((r) => ({
      keyword: String(r.keyword),
      posts: Number(r.posts) || 0,
      clicks: Number(r.clicks) || 0,
      revenue_ils: +(Number(r.revenue_ils) || 0).toFixed(2),
    }));
  }

  /** Everything this campaign's keywords drew in the window — the measure of whether the
   *  campaign produced enough signal to judge any single keyword by. */
  private totalClicks(scores: KeywordScore[]): number {
    return scores.reduce((n, s) => n + s.clicks, 0);
  }

  /**
   * The products that actually sold, resolved to their AliExpress categories and ranked.
   *
   * Per-post attribution is not usable here: of the products sold on this account only a
   * handful were ever published by the autopilot, so "which of my posts earned" sees a
   * couple of percent of reality. Categories aggregate across ALL orders — including the
   * owner's other traffic on the same tracking id — which is where the signal lives.
   *
   * Bounded on purpose: the top earners by commission, in chunks, so a daily run costs a
   * predictable couple of affiliate API calls.
   */
  private async learnFromOrders(userId: string): Promise<CategoryScore[]> {
    const rows: any[] = await this.campaigns.query(
      `SELECT product_id,
              count(*)::int                            AS orders,
              coalesce(sum(commission_ils), 0)::float  AS commission_ils
       FROM earnings
       WHERE user_id = $1 AND product_id IS NOT NULL
         AND order_date > now() - ($2 || ' days')::interval
       GROUP BY product_id
       ORDER BY commission_ils DESC, orders DESC
       LIMIT $3`,
      [userId, String(ORDER_LEARNING_WINDOW_DAYS), MAX_PRODUCTS_TO_RESOLVE],
    ).catch(() => []);
    if (!rows.length) return [];

    const ids = rows.map((r) => String(r.product_id));
    const resolved = new Map<string, any>();
    for (let i = 0; i < ids.length; i += RESOLVE_CHUNK) {
      const chunk = ids.slice(i, i + RESOLVE_CHUNK);
      const batch = await this.products.refreshPricesBatch(userId, chunk).catch(() => new Map());
      for (const [id, product] of batch) resolved.set(String(id), product);
    }

    const sold: SoldProduct[] = rows.map((r) => {
      const product = resolved.get(String(r.product_id));
      return {
        productId: String(r.product_id),
        orders: Number(r.orders) || 0,
        commissionIls: Number(r.commission_ils) || 0,
        category: product?.category ?? null,
        subcategory: product?.subcategory ?? null,
      };
    });

    const scored = scoreCategories(sold);
    if (scored.length) {
      this.logger.log(`order learning [${userId}]: ${scored.length} categories from `
        + `${sold.length} sold products — top: ${scored.slice(0, 3).map((s) => `${s.keyword} (₪${s.commissionIls})`).join(', ')}`);
    }
    return scored;
  }

  /** Small, safe, reversible adjustments to the campaign's keyword rotation. */
  private async applyActions(
    userId: string, c: Campaign, scores: KeywordScore[], soldCategories: CategoryScore[] = [],
    channelsById: Map<string, Channel> = new Map(), claimed: Set<string> = new Set(),
    windowDays: number = WINDOW_DAYS,
  ): Promise<CampaignActions> {
    const out: CampaignActions = {
      campaign: c.name, retired: [], boosted: null, unboosted: [], learned: [], rejected: [],
      tooQuietToJudge: false,
    };
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
    //
    //    But only when the campaign drew enough clicks IN TOTAL to tell a dead keyword from
    //    a quiet window. Below that floor every keyword scores zero and the rule would fire
    //    on all of them — retiring the good ones right along with the bad, and calling the
    //    account's silence a verdict on the rotation. Nothing is retired instead.
    out.tooQuietToJudge = this.totalClicks(scores) < MIN_CAMPAIGN_CLICKS_TO_JUDGE;
    if (out.tooQuietToJudge) {
      this.logger.log(`optimizer [${c.name}]: ${this.totalClicks(scores)} clicks over `
        + `${windowDays}d — below the floor to judge a keyword dead, retiring nothing`);
    } else {
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
    }

    // 3) Boost the top earner: double its slot in the round-robin (cap 2×) so it posts
    //    twice per cycle. Only one boosted keyword at a time — focus beats spray.
    const top = [...scores].sort((a, b) => b.revenue_ils - a.revenue_ils)[0];
    if (top && top.revenue_ils > 0 && kws.includes(top.keyword)) {
      const copies = kws.filter((k) => k === top.keyword).length;
      if (copies === 1) { kws.push(top.keyword); out.boosted = top.keyword; }
    }

    // 4) LEARN from what sold — but only what suits THIS group.
    //    The categories are ranked account-wide, so the top of that list is the same list for
    //    every campaign. Handing it out as-is made all the groups converge on one rotation:
    //    a mothers-and-brands group and a general-deals group were both given "Hunting" the
    //    same night. So each candidate now has to pass a per-group fit judgement first, and
    //    a group that fits none of tonight's winners simply gains nothing.
    if (c.learn_from_orders && soldCategories.length) {
      const profile = this.profileOf(c, kws, scores, channelsById);
      const candidates = newKeywordsFor(
        soldCategories, kws, c.retired_keywords || [], MAX_FIT_CANDIDATES,
      );
      const { fitted, rejected } = await this.judgeFit(
        userId, profile, candidates, claimed, MAX_LEARNED_PER_RUN,
      );
      for (const a of fitted) {
        kws.push(a.keyword);
        out.learned.push(a);
      }
      out.rejected = rejected;
    }

    if (out.retired.length || out.boosted || out.unboosted.length || out.learned.length) {
      c.keywords = kws;
      await this.campaigns.save(c).catch((err: any) =>
        this.logger.warn(`optimizer save failed for campaign ${c.id}: ${err.message}`));
      this.logger.log(`optimizer [${c.name}]: retired=${out.retired.join(',') || '—'} boosted=${out.boosted || '—'} unboosted=${out.unboosted.join(',') || '—'} learned=${out.learned.map((l) => l.keyword).join(',') || '—'}`);
    }
    return out;
  }

  /** The user's groups by id, so a campaign's target_channels resolve to real audiences. */
  private async channelsById(userId: string): Promise<Map<string, Channel>> {
    const rows = await this.channels.find({ where: { user_id: userId } }).catch(() => [] as Channel[]);
    return new Map(rows.map((ch) => [ch.id, ch]));
  }

  /** What this campaign IS, assembled from everything that describes it. */
  private profileOf(
    c: Campaign, keywords: string[], scores: KeywordScore[], channelsById: Map<string, Channel>,
  ): CampaignProfile {
    let ids: string[] = [];
    try { ids = JSON.parse(c.target_channels || '[]'); } catch { ids = []; }
    const channels = ids
      .map((id) => channelsById.get(String(id)))
      .filter((ch): ch is Channel => !!ch)
      .map((ch) => (ch.description ? `${ch.name} — ${ch.description}` : ch.name));

    return {
      name: c.name,
      keywords: Array.from(new Set(keywords)),
      retired: c.retired_keywords || [],
      channels,
      // Proven appetite inside THIS group, which outranks any account-wide number.
      earning: scores.filter((s) => s.revenue_ils > 0 || s.clicks > 0).map((s) => s.keyword),
    };
  }

  /**
   * Ask the account's model which of tonight's winners belong in this group.
   *
   * Failure is not neutral here, so it is never treated as such: if no model answers, the
   * decision falls back to the vocabulary check, which only passes a category the group's
   * own rotation already talks about. Both gates closed means the group gains nothing — the
   * correct outcome, and the one the old code got wrong by adding regardless.
   */
  private async judgeFit(
    userId: string, profile: CampaignProfile, candidates: CategoryScore[],
    claimed: Set<string>, max: number,
  ): Promise<{ fitted: FittedCategory[]; rejected: string[] }> {
    if (!candidates.length) return { fitted: [], rejected: [] };

    const creds = await this.credentials.getRaw(userId).catch(() => null);
    const result = creds
      ? await this.ai.generate(creds, {
        system: FIT_SYSTEM_PROMPT,
        prompt: buildFitPrompt(profile, candidates),
        maxTokens: 700,
        // A fit judgement is not creative writing — the same group and the same candidates
        // should not swing between "belongs" and "off-brand" from one night to the next.
        temperature: 0,
      }).catch((err: any) => {
        this.logger.warn(`fit judge failed for [${profile.name}]: ${err?.message}`);
        return null;
      })
      : null;

    const verdicts = result?.text
      ? parseFitVerdicts(result.text, candidates)
      : candidates.map((c) => ({
        keyword: c.keyword,
        fits: lexicalFit(c.keyword, profile),
        reason: 'תואמת את מילות המפתח של הקבוצה',
      }));

    if (!result?.text) {
      this.logger.warn(`fit judge unavailable for [${profile.name}] — falling back to the vocabulary check`);
    }

    // Only an explicit "does not belong" is reported as a rejection. A candidate that fit
    // but lost to the per-run cap is still a candidate tomorrow, not an off-brand one.
    const rejected = verdicts.filter((v) => !v.fits).map((v) => v.keyword);
    return { fitted: rankFitted(candidates, verdicts, profile, claimed, max), rejected };
  }

  /**
   * Golden hours PER GROUP — when each group's own audience actually clicks (local
   * Asia/Jerusalem hours, last 30 days). A click is attributed to the post's primary
   * target group (channel_override). Groups below the data floor come back with
   * `verdict: null` so the digest can say "not enough data yet" instead of guessing.
   */
  async groupHotHours(userId: string): Promise<Array<{ channel_id: string; name: string; verdict: HotHoursResult | null }>> {
    const rows: Array<{ channel_id: string; hour: number; clicks: number }> = await this.campaigns.query(
      `SELECT p.channel_override AS channel_id,
              extract(hour from (lc.clicked_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::int AS hour,
              count(*)::int AS clicks
       FROM link_clicks lc
       JOIN posts p ON p.id = lc.post_id
       WHERE lc.user_id = $1
         AND lc.clicked_at > now() - interval '30 days'
         AND p.channel_override IS NOT NULL
       GROUP BY 1, 2`,
      [userId],
    ).catch(() => []);
    if (!rows.length) return [];

    const byChannel = new Map<string, HourClicks[]>();
    for (const r of rows) {
      const list = byChannel.get(r.channel_id) || [];
      list.push({ hour: Number(r.hour), clicks: Number(r.clicks) });
      byChannel.set(r.channel_id, list);
    }

    const names: Array<{ id: string; name: string }> = await this.campaigns.query(
      `SELECT id, name FROM channels WHERE user_id = $1`, [userId],
    ).catch(() => []);
    const nameOf = new Map(names.map((n) => [String(n.id), String(n.name || '')]));

    return Array.from(byChannel.entries())
      .filter(([id]) => nameOf.has(id)) // clicks for a deleted group teach nothing actionable
      .map(([id, hours]) => ({ channel_id: id, name: nameOf.get(id)!, verdict: hotHours(hours) }))
      .sort((a, b) => (b.verdict?.total || 0) - (a.verdict?.total || 0));
  }

  /** Yesterday's numbers + golden hours + top product — the digest's raw material. */
  private async digestStats(userId: string) {
    const q = (sql: string, params: any[]) => this.campaigns.query(sql, params).catch(() => []);
    const [posts] = await q(
      `SELECT count(*)::int AS n FROM posts
       WHERE user_id = $1 AND status = 'sent' AND sent_at > now() - interval '1 day'`, [userId]);
    // link_clicks' timestamp column is clicked_at — there IS no created_at on that table.
    // These two queries filtered on created_at, Postgres errored, the best-effort catch
    // swallowed it, and the digest reported 0 clicks (and no golden hours) every single
    // morning while the posts screen — fed by posts.clicks_count — showed the truth.
    const [clicks] = await q(
      `SELECT count(*)::int AS n FROM link_clicks
       WHERE user_id = $1 AND clicked_at > now() - interval '1 day'`, [userId]);
    const [rev] = await q(
      `SELECT count(*)::int AS orders, coalesce(sum(commission_ils), 0)::float AS ils
       FROM earnings WHERE user_id = $1 AND created_at > now() - interval '1 day'`, [userId]);
    const [topProduct] = await q(
      `SELECT product_title, clicks_count FROM posts
       WHERE user_id = $1 AND sent_at > now() - interval '7 days' AND clicks_count > 0
       ORDER BY clicks_count DESC LIMIT 1`, [userId]);
    const goldenHours: any[] = await q(
      `SELECT extract(hour from (clicked_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem')::int AS hour,
              count(*)::int AS n
       FROM link_clicks WHERE user_id = $1 AND clicked_at > now() - ($2 || ' days')::interval
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

  /**
   * How the copy ANGLES are performing account-wide — the "how we write" half of the loop.
   *
   * Reported whether or not a winner has emerged: seeing four angles at similar rates is
   * itself the finding, and it is what stops the owner reading an early front-runner as a
   * conclusion the numbers do not yet support.
   */
  private async copyAngleReport(userId: string): Promise<{ scored: VariantScore[]; winner: VariantScore | null }> {
    const rows: any[] = await this.campaigns.query(
      `SELECT copy_variant                          AS variant,
              count(*)::int                         AS posts,
              coalesce(sum(clicks_count), 0)::int   AS clicks
       FROM posts
       WHERE user_id = $1 AND status = 'sent' AND copy_variant IS NOT NULL
         AND sent_at > now() - ($2 || ' days')::interval
       GROUP BY copy_variant`,
      [userId, String(ORDER_LEARNING_WINDOW_DAYS)],
    ).catch(() => []);
    const stats: VariantStat[] = rows.map((r) => ({
      variant: String(r.variant),
      posts: Number(r.posts) || 0,
      clicks: Number(r.clicks) || 0,
    }));
    return { scored: scoreVariants(stats), winner: bestVariant(stats) };
  }

  private buildDigest(
    stats: Awaited<ReturnType<OptimizerService['digestStats']>>,
    actions: CampaignActions[],
    soldCategories: CategoryScore[] = [],
    campaigns: Campaign[] = [],
    copyAngles: { scored: VariantScore[]; winner: VariantScore | null } = { scored: [], winner: null },
    hotByGroup: Array<{ channel_id: string; name: string; verdict: HotHoursResult | null }> = [],
  ): string {
    const lines: string[] = [];
    lines.push('🧠 דו"ח הבוקר של המנוע הלומד');
    lines.push('');
    // "24 השעות האחרונות", not "אתמול": the window is rolling and now ends at the AliExpress
    // 10:00 close, so it covers the day that just shut rather than a calendar yesterday.
    lines.push(`📊 24 השעות האחרונות (עד סגירת היום באלי אקספרס): ${stats.posts_yesterday} פוסטים · ${stats.clicks_yesterday} קליקים · ${stats.orders_yesterday} הזמנות (₪${stats.revenue_yesterday_ils})`);
    if (stats.top_product) lines.push(`🏆 המוביל השבוע: ${stats.top_product} (${stats.top_product_clicks} קליקים)`);
    // Per-group golden hours (30 days) beat the account-wide line when we have them —
    // each group's audience has its own rhythm, and per-group is what the scheduler will
    // act on. The account-wide line stays as the fallback for thin data.
    const withVerdict = hotByGroup.filter((g) => g.verdict);
    if (withVerdict.length) {
      lines.push('⏰ שעות הזהב לפי קבוצה (30 יום):');
      for (const g of withVerdict) {
        const v = g.verdict!;
        lines.push(`  • ${g.name}: ${formatHours(v.hours)} — ${Math.round(v.share * 100)}% מ-${v.total} קליקים`);
      }
      for (const g of hotByGroup.filter((x) => !x.verdict)) {
        lines.push(`  • ${g.name}: עוד אין מספיק קליקים למסקנה`);
      }
    } else if (stats.golden_hours.length) {
      lines.push(`⏰ שעות הזהב שלך: ${stats.golden_hours.join(', ')}`);
    }
    if (actions.length) {
      lines.push('');
      lines.push('🔧 מה כיוונתי הלילה:');
      for (const a of actions) {
        if (a.boosted) lines.push(`  • [${a.campaign}] הכפלתי את "${a.boosted}" — היא מייצרת עמלות`);
        for (const kw of a.retired) lines.push(`  • [${a.campaign}] הוצאתי את "${kw}" — ${MIN_POSTS_TO_JUDGE}+ פוסטים בלי קליק אחד`);
        for (const kw of a.unboosted) lines.push(`  • [${a.campaign}] החזרתי את "${kw}" למינון רגיל — ההכנסות מהחלון האחרון התייבשו`);
        for (const l of a.learned) {
          const why = l.reason ? ` — ${l.reason}` : '';
          lines.push(`  • [${a.campaign}] הוספתי "${l.keyword}" (₪${l.commissionIls} · ${l.orders} הזמנות)${why}`);
        }
        // Saying what a group did NOT get is the point of the change: it shows the engine
        // considered the account's winners for this group and turned them down on purpose,
        // rather than never having looked.
        if (a.rejected.length) {
          lines.push(`  • [${a.campaign}] לא הוספתי: ${a.rejected.join(', ')} — לא מתאימות לקהל של הקבוצה`);
        }
        // Saying "I chose not to decide" beats quietly retiring good keywords on silence.
        if (a.tooQuietToJudge) {
          lines.push(`  • [${a.campaign}] לא הדחתי אף מילה — פחות מ-${MIN_CAMPAIGN_CLICKS_TO_JUDGE} קליקים ב-${SPARSE_WINDOW_DAYS} ימים, אין מספיק דאטה כדי לקבוע שמילה מתה`);
        }
      }
    } else {
      lines.push('');
      lines.push('🔧 הלילה לא נדרש כוונון — הרוטציה מאוזנת.');
    }

    // What the ORDERS say, always — including for campaigns that haven't opted in, so the
    // knowledge is never hidden behind a flag. Only acting on it is opt-in.
    if (soldCategories.length) {
      lines.push('');
      lines.push(`💰 הקטגוריות שבאמת נמכרו (${ORDER_LEARNING_WINDOW_DAYS} ימים):`);
      for (const c of soldCategories.slice(0, 5)) {
        lines.push(`  • ${c.keyword} — ₪${c.commissionIls} · ${c.orders} הזמנות`);
      }
      lines.push('  ↳ כל קטגוריה נבחנת מול הקהל של כל קבוצה בנפרד — לא כל קבוצה מקבלת את אותן מילים.');
    }

    // The "how we write" half of the loop.
    if (copyAngles.scored.length) {
      lines.push('');
      lines.push('✍️ סגנונות הכתיבה (קליקים לפוסט):');
      for (const s of copyAngles.scored) {
        const label = variantById(s.variant)?.label || s.variant;
        lines.push(`  • ${label} — ${s.clicksPerPost} (${s.clicks} קליקים ב-${s.posts} פוסטים)`);
      }
      if (copyAngles.winner) {
        const label = variantById(copyAngles.winner.variant)?.label || copyAngles.winner.variant;
        lines.push(`  ↳ רוב הפוסטים נכתבים עכשיו בסגנון "${label}", וחלק קטן ממשיך לבדוק את השאר.`);
      } else {
        // Explicitly NOT a winner yet — so an early front-runner is not read as a verdict.
        lines.push(`  ↳ עוד אין מנצח מובהק — צריך ${MIN_CLICKS_TO_PICK_WINNER}+ קליקים ו-${MIN_POSTS_PER_VARIANT}+ פוסטים לסגנון. עד אז הכתיבה מתחלקת שווה בשווה.`);
      }
      const optedOut = campaigns.filter((c) => !c.learn_from_orders).map((c) => c.name);
      if (optedOut.length) {
        lines.push(`  ↳ לא מתווספות אוטומטית ל: ${optedOut.join(', ')} — הפעל "לימוד מהזמנות" בקמפיין כדי שכן.`);
      }
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
