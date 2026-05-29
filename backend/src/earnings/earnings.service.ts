import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Earning } from './earning.entity';
import { CredentialsService } from '../credentials/credentials.service';
import { RatesService } from '../rates/rates.service';
import axios from 'axios';

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(Earning)
    private readonly repo: Repository<Earning>,
    private readonly credentials: CredentialsService,
    private readonly rates: RatesService,
  ) {}

  async summary(userId: string, period: '7d' | '30d' | '90d' | 'all' = '30d') {
    const from = this.periodStart(period);
    const qb = this.repo.createQueryBuilder('e')
      .where('e.user_id = :userId', { userId });
    if (from) qb.andWhere('e.order_date >= :from', { from });

    const earnings = await qb.getMany();

    const total_estimated = earnings
      .filter((e) => e.status === 'estimated')
      .reduce((s, e) => s + e.commission_ils, 0);

    const total_settled = earnings
      .filter((e) => e.status === 'settled')
      .reduce((s, e) => s + e.commission_ils, 0);

    const total_cancelled = earnings
      .filter((e) => e.status === 'cancelled')
      .reduce((s, e) => s + e.commission_ils, 0);

    // By campaign
    const campaignMap = new Map<string, { campaign_id: string; campaign_name: string; total: number }>();
    for (const e of earnings) {
      if (!e.campaign_id) continue;
      const existing = campaignMap.get(e.campaign_id) || { campaign_id: e.campaign_id, campaign_name: e.campaign_id, total: 0 };
      existing.total += e.commission_ils;
      campaignMap.set(e.campaign_id, existing);
    }

    // By month
    const monthMap = new Map<string, { month: string; estimated: number; settled: number }>();
    for (const e of earnings) {
      const month = new Date(e.order_date).toISOString().slice(0, 7);
      const existing = monthMap.get(month) || { month, estimated: 0, settled: 0 };
      if (e.status === 'estimated') existing.estimated += e.commission_ils;
      if (e.status === 'settled') existing.settled += e.commission_ils;
      monthMap.set(month, existing);
    }

    return {
      total_estimated,
      total_settled,
      total_cancelled,
      period_start: from?.toISOString() || '2020-01-01T00:00:00.000Z',
      period_end: new Date().toISOString(),
      by_campaign: Array.from(campaignMap.values()),
      by_month: Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  async list(userId: string, page = 1, limit = 20, status?: string) {
    const qb = this.repo.createQueryBuilder('e')
      .where('e.user_id = :userId', { userId })
      .orderBy('e.order_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('e.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async sync(userId: string): Promise<{ synced: number }> {
    const creds = await this.credentials.getRaw(userId);
    if (!creds?.aliexpress_app_key) return { synced: 0 };

    const rate = await this.rates.getRate(creds.currency_pair || 'USD_ILS');
    let synced = 0;

    try {
      const res = await axios.get('https://api-sg.aliexpress.com/sync', {
        params: {
          method: 'aliexpress.affiliate.order.list',
          app_key: creds.aliexpress_app_key,
          status: 'payment_done_for_buyer',
          start_time: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          end_time: new Date().toISOString().slice(0, 10),
          page_size: 50,
        },
        timeout: 15000,
      });

      const orders = res.data?.aliexpress_affiliate_order_list_response?.resp_result?.result?.orders?.order || [];

      for (const order of orders) {
        const exists = await this.repo.findOne({ where: { order_id: order.order_id, user_id: userId } });
        if (exists) continue;

        const commissionUsd = parseFloat(order.estimated_paid_commission) || 0;
        const orderAmountUsd = parseFloat(order.order_amount) || 0;

        const earning = this.repo.create({
          user_id: userId,
          order_id: String(order.order_id),
          product_id: String(order.product_id || 'unknown'),
          order_amount_usd: orderAmountUsd,
          commission_usd: commissionUsd,
          commission_ils: +(commissionUsd * rate).toFixed(2),
          status: order.paid_status === 'Settled' ? 'settled' : 'estimated',
          order_date: new Date(order.order_create_time),
          settlement_date: order.paid_status === 'Settled' ? new Date() : null,
        });

        await this.repo.save(earning);
        synced++;
      }
    } catch {
      // API not configured / failed — return 0 synced
    }

    return { synced };
  }

  private periodStart(period: string): Date | null {
    const days = { '7d': 7, '30d': 30, '90d': 90 };
    if (!days[period]) return null;
    const d = new Date();
    d.setDate(d.getDate() - days[period]);
    return d;
  }
}
