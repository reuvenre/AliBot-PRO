import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Earning } from '../earnings/earning.entity';
import { LinkClick } from '../links/link-click.entity';
import { Post } from '../posts/post.entity';
import { RatesService } from '../rates/rates.service';
import { portalRangeStart } from '../earnings/portal-time';
import { densify, deltaPct, sum, weekKeys } from './stats.util';

export interface MetricSeries {
  total: number;
  delta_pct: number | null;
  series: number[];
}

export interface OverviewStats {
  /** Commissions are reported in the currency the affiliate network actually pays. */
  currency: 'USD';
  weeks: number;
  week_starts: string[];
  /** Today's rate and the converted headline total — a convenience for a shekel-thinking
   *  reader, explicitly approximate. Null when no rate is available. */
  ils_approx: { rate: number; total: number } | null;
  metrics: {
    commissions: MetricSeries;
    clicks: MetricSeries;
    posts: MetricSeries;
  };
  /** Commissions for the CURRENT calendar month on the portal's clock — the number the
   *  owner compares against the AliExpress portal, next to the 12-week trend. */
  month: {
    /** 'YYYY-MM' in portal time. */
    key: string;
    total: number;
    /** vs the SAME elapsed stretch of the previous month — comparing a half-finished
     *  month against a whole one would print a fake collapse every month. */
    delta_pct: number | null;
  };
}

const MAX_WEEKS = 52;

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(
    @InjectRepository(Earning) private readonly earnings: Repository<Earning>,
    @InjectRepository(LinkClick) private readonly clicks: Repository<LinkClick>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly rates: RatesService,
  ) {}

  /**
   * Headline numbers for the dashboard: commissions, clicks and posts over the last N weeks,
   * each with a weekly series and the change against the preceding N weeks.
   *
   * Aggregation happens in SQL rather than by loading rows and summing in JS. This endpoint
   * runs on every dashboard visit, and the accounts that matter most are exactly the ones
   * with the most rows — the naive version gets slowest where it can least afford to.
   */
  async overview(userId: string, weeks = 12): Promise<OverviewStats> {
    const n = Math.min(MAX_WEEKS, Math.max(1, Math.floor(weeks) || 12));
    const now = new Date();

    // Fetch 2N weeks in one pass per metric: the recent N are the series, the older N are
    // the baseline the delta is measured against.
    const allKeys = weekKeys(now, n * 2);
    const from = new Date(`${allKeys[0]}T00:00:00.000Z`);

    const [commissionRows, clickRows, postRows, month] = await Promise.all([
      this.commissionsByWeek(userId, from),
      this.clicksByWeek(userId, from),
      this.postsByWeek(userId, from),
      this.commissionsThisMonth(userId),
    ]);

    const build = (rows: Array<{ bucket: string; value: number }>): MetricSeries => {
      const dense = densify(rows, allKeys);
      const previous = dense.slice(0, n);
      const current = dense.slice(n);
      return {
        total: sum(current),
        delta_pct: deltaPct(sum(current), sum(previous)),
        series: current,
      };
    };

    const commissions = build(commissionRows);

    // Best-effort only: a missing rate must not fail the dashboard, it just drops the
    // secondary line. RatesService already caches and falls back to the last good value.
    const rate = await this.rates.getRate('USD_ILS').catch(() => 0);

    return {
      currency: 'USD',
      weeks: n,
      week_starts: allKeys.slice(n),
      ils_approx: rate > 0
        ? { rate, total: Math.round(commissions.total * rate * 100) / 100 }
        : null,
      metrics: {
        commissions,
        clicks: build(clickRows),
        posts: build(postRows),
      },
      month,
    };
  }

  /**
   * Commissions inside the current CALENDAR month, counted on AliExpress platform time —
   * the same clock the portal reports by and the orders screen filters on, so the figure
   * the dashboard shows is the figure the owner sees in the portal.
   *
   * The comparison is against the same ELAPSED stretch of the previous month, not the
   * whole of it: on the 3rd, three days of this month against a full previous month would
   * print a catastrophic drop every single month.
   */
  private async commissionsThisMonth(userId: string) {
    // 'en-CA' formats as YYYY-MM-DD, which is exactly the shape the range helpers parse.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const [y, mth] = today.split('-').map(Number);
    const start = portalRangeStart(`${today.slice(0, 7)}-01`)!;
    const prevMonth = mth === 1 ? `${y - 1}-12` : `${y}-${String(mth - 1).padStart(2, '0')}`;
    const prevStart = portalRangeStart(`${prevMonth}-01`)!;
    const elapsed = Date.now() - start.getTime();
    const prevEnd = new Date(prevStart.getTime() + elapsed);

    const total = (from: Date, to: Date) => this.earnings.createQueryBuilder('e')
      .select('COALESCE(SUM(e.commission_usd), 0)', 'value')
      .where('e.user_id = :userId', { userId })
      // Payment time is the portal's own basis; paid_date is null only on rows synced
      // before the column existed, where the order date is the best available stand-in.
      .andWhere('COALESCE(e.paid_date, e.order_date) >= :from', { from })
      .andWhere('COALESCE(e.paid_date, e.order_date) <= :to', { to })
      .andWhere("e.status IN ('estimated', 'settled')")
      .getRawOne()
      .then((r) => Number(r?.value) || 0)
      .catch(() => 0);

    const [current, previous] = await Promise.all([
      total(start, new Date()),
      total(prevStart, prevEnd),
    ]);
    return { key: today.slice(0, 7), total: Math.round(current * 100) / 100, delta_pct: deltaPct(current, previous) };
  }

  /**
   * Summed in USD, not ILS, and that choice is load-bearing.
   *
   * `commission_usd` is what AliExpress reported and never changes. `commission_ils` is
   * derived at SYNC time — the sync fetches one rate per run and recomputes the shekel value
   * of every row it touches, so an order from February that settles today is re-valued at
   * today's rate. A trend chart built on that column silently rewrites its own history
   * between page loads. USD is the only reproducible basis here.
   *
   * Cancelled commissions are excluded — they are revenue that evaporated, not revenue.
   */
  private commissionsByWeek(userId: string, from: Date) {
    return this.earnings.createQueryBuilder('e')
      .select("to_char(date_trunc('week', e.order_date), 'YYYY-MM-DD')", 'bucket')
      .addSelect('COALESCE(SUM(e.commission_usd), 0)', 'value')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.order_date >= :from', { from })
      .andWhere("e.status IN ('estimated', 'settled')")
      .groupBy('bucket')
      .getRawMany();
  }

  private clicksByWeek(userId: string, from: Date) {
    return this.clicks.createQueryBuilder('c')
      .select("to_char(date_trunc('week', c.clicked_at), 'YYYY-MM-DD')", 'bucket')
      .addSelect('COUNT(*)', 'value')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.clicked_at >= :from', { from })
      .groupBy('bucket')
      .getRawMany();
  }

  /**
   * Clicks per PLATFORM over the last N days — where the traffic actually comes from.
   * Source is the ?s= tag each send path stamps on its published link (click-source.ts);
   * NULL = a click on a link published before tagging existed, reported as 'other' so the
   * numbers always add up to the total instead of quietly dropping history.
   */
  async clickSources(userId: string, days = 30): Promise<{ days: number; total: number; sources: Array<{ source: string; clicks: number }> }> {
    const d = Math.min(365, Math.max(1, Math.floor(days) || 30));
    const from = new Date(Date.now() - d * 86_400_000);
    const rows: Array<{ source: string | null; n: number }> = await this.clicks.createQueryBuilder('c')
      .select('c.source', 'source')
      .addSelect('COUNT(*)::int', 'n')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.clicked_at >= :from', { from })
      .groupBy('c.source')
      .getRawMany();
    const sources = rows
      .map((r) => ({ source: r.source || 'other', clicks: Number(r.n) || 0 }))
      .sort((a, b) => b.clicks - a.clicks);
    return { days: d, total: sources.reduce((s, r) => s + r.clicks, 0), sources };
  }

  /** Only posts that actually went out — a draft or a failure is not throughput. */
  private postsByWeek(userId: string, from: Date) {
    return this.posts.createQueryBuilder('p')
      .select("to_char(date_trunc('week', p.sent_at), 'YYYY-MM-DD')", 'bucket')
      .addSelect('COUNT(*)', 'value')
      .where('p.user_id = :userId', { userId })
      .andWhere("p.status = 'sent'")
      .andWhere('p.sent_at >= :from', { from })
      .groupBy('bucket')
      .getRawMany();
  }
}
