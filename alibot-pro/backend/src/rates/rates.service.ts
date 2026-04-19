import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface RateCache {
  USD_ILS: number;
  USD_EUR: number;
  USD_GBP: number;
  updated_at: string;
}

@Injectable()
export class RatesService {
  private cache: RateCache = {
    USD_ILS: 3.7,
    USD_EUR: 0.92,
    USD_GBP: 0.79,
    updated_at: new Date().toISOString(),
  };
  private lastFetch = 0;
  private readonly TTL = 60 * 60 * 1000; // 1 hour

  async getRates(): Promise<RateCache> {
    if (Date.now() - this.lastFetch > this.TTL) {
      await this.refresh();
    }
    return this.cache;
  }

  async getRate(pair: string): Promise<number> {
    const rates = await this.getRates();
    if (pair === 'USD_ILS') return rates.USD_ILS;
    if (pair === 'USD_EUR') return rates.USD_EUR;
    if (pair === 'USD_GBP') return rates.USD_GBP;
    return 1;
  }

  private async refresh() {
    try {
      const res = await axios.get(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { timeout: 8000 },
      );
      const r = res.data.rates;
      this.cache = {
        USD_ILS: r.ILS || 3.7,
        USD_EUR: r.EUR || 0.92,
        USD_GBP: r.GBP || 0.79,
        updated_at: new Date().toISOString(),
      };
      this.lastFetch = Date.now();
    } catch {
      // Keep using cached values
    }
  }
}
