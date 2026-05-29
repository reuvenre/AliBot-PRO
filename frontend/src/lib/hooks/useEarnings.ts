'use client';

import { useState, useEffect, useCallback } from 'react';
import { earningsApi } from '@/lib/api-client';
import type { EarningsSummary } from '@/types';

type Period = '7d' | '30d' | '90d' | 'all';

export function useEarnings(initialPeriod: Period = '30d') {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (p: Period) => {
    setIsLoading(true);
    try {
      const data = await earningsApi.summary({ period: p });
      setSummary(data);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message || 'שגיאה בטעינת הרווחים');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(period); }, [fetch, period]);

  const sync = async () => {
    const res = await earningsApi.sync();
    await fetch(period);
    return res;
  };

  return { summary, period, setPeriod, isLoading, error, sync, refetch: () => fetch(period) };
}
