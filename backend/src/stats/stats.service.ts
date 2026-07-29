import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Earning } from '../earnings/earning.entity';
import { LinkClick } from '../links/link-click.entity';
import { Post } from '../posts/post.entity';
import { RatesService } from '../rates/rates.service';
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

    const [commissionRows, clickRows, postRows] = await Promise.all([
      this.commissionsByWeek(userId, from),
      this.clicksByWeek(userId, from),
      this.postsByWeek(userId, from),
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
    };
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
