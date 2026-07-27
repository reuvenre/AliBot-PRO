import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import { cacheGet, cacheSet } from '../common/safe-cache';

export interface RateCache {
  USD_ILS: number;
  USD_EUR: number;
  USD_GBP: number;
  updated_at: string;
}

const RATES_CACHE_KEY = 'exchange_rates';
const RATES_LAST_GOOD_KEY = 'exchange_rates_last_good';
const RATES_TTL_SEC = 60 * 60; // 1 hour
const LAST_GOOD_TTL_SEC = 30 * 24 * 60 * 60; // 30 days — survives a long upstream outage

const FALLBACK: RateCache = {
  USD_ILS: 3.7,
  USD_EUR: 0.92,
  USD_GBP: 0.79,
  updated_at: new Date().toISOString(),
};

@Injectable()
export class RatesService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getRates(): Promise<RateCache> {
    // safe-cache: a dead Redis must degrade to a direct fetch, never hang the
    // request (this exact call used to freeze every products endpoint).
    const cached = await cacheGet<RateCache>(this.cacheManager, RATES_CACHE_KEY);
    if (cached) return cached;

    const fresh = await this.fetchRates();
    await cacheSet(this.cacheManager, RATES_CACHE_KEY, fresh, RATES_TTL_SEC * 1000);
    return fresh;
  }

  async getRate(pair: string): Promise<number> {
    const rates = await this.getRates();
    if (pair === 'USD_ILS') return rates.USD_ILS;
    if (pair === 'USD_EUR') return rates.USD_EUR;
    if (pair === 'USD_GBP') return rates.USD_GBP;
    return 1;
  }

  private async fetchRates(): Promise<RateCache> {
    try {
      const res = await axios.get(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { timeout: 8000 },
      );
      const r = res.data.rates;
      const fresh: RateCache = {
        USD_ILS: r.ILS || FALLBACK.USD_ILS,
        USD_EUR: r.EUR || FALLBACK.USD_EUR,
        USD_GBP: r.GBP || FALLBACK.USD_GBP,
        updated_at: new Date().toISOString(),
      };
      // Persist the last KNOWN-GOOD rate separately (long TTL) so an upstream outage
      // falls back to a real recent rate instead of the stale hardcoded 3.7.
      await cacheSet(this.cacheManager, RATES_LAST_GOOD_KEY, fresh, LAST_GOOD_TTL_SEC * 1000);
      return fresh;
    } catch {
      const lastGood = await cacheGet<RateCache>(this.cacheManager, RATES_LAST_GOOD_KEY);
      return lastGood || FALLBACK;
    }
  }
}
