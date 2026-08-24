'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { storeApi, yupooImg } from '@/lib/api-client';
import type { StoreMeta, StoreProduct } from '@/types';
import { StoreShell } from './StoreShell';
import './store.css';

/**
 * The public storefront: everything this seller publishes, on one shelf.
 *
 * A follower who scrolled past a deal on Tuesday has no way back to it in the channel
 * feed on Thursday. This is that way back — and the place where someone who arrived for
 * one product discovers the other forty.
 */

function priceLabel(p: StoreProduct): string {
  const symbol = p.currency === 'ILS' ? '₪' : p.currency === 'USD' ? '$' : '';
  const value = Math.round(p.price * 100) / 100;
  return symbol ? `${symbol} ${value}` : `${value} ${p.currency}`;
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const params = useSearchParams();

  const brand = params.get('brand') || '';
  const group = params.get('group') || '';
  const q = params.get('q') || '';

  const [meta, setMeta] = useState<StoreMeta | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    storeApi.meta(slug).then(setMeta).catch(() => setMissing(true));
  }, [slug]);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await storeApi.products(slug, { page: p, brand, group, q });
      // Page 1 replaces; a "load more" appends — the shelf keeps growing under the reader
      // instead of resetting their scroll position.
      setProducts((prev) => (p === 1 ? res.products : [...prev, ...res.products]));
      setPages(res.pages);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [slug, brand, group, q]);

  useEffect(() => { void load(1); }, [load]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/s/${slug}${next.toString() ? `?${next}` : ''}`);
  };

  if (missing) {
    return (
      <div className="store-root flex items-center justify-center p-8" dir="rtl">
        <div className="text-center">
          <h1 className="store-wordmark text-2xl font-bold mb-2">החנות לא נמצאה</h1>
          <p className="text-sm text-[var(--store-muted)]">ייתכן שהכתובת שגויה או שהחנות אינה פעילה.</p>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="store-root flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-[var(--store-gold)]" />
      </div>
    );
  }

  const hasFilters = meta.brands.length > 0 || meta.groups.length > 0;

  return (
    <StoreShell meta={meta} search={q} onSearch={(v) => setParam('q', v)}>
      <h1 className="text-3xl sm:text-4xl font-bold mb-1">
        {brand || group || 'כל המוצרים'}
      </h1>
      <p className="text-sm text-[var(--store-muted)] mb-5">
        {total > 0 ? `${total} מוצרים` : loading ? 'טוען…' : 'אין מוצרים להצגה'}
        {q && ` · חיפוש: "${q}"`}
      </p>

      {hasFilters && (
        <div className="mb-6">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="store-chip flex items-center gap-2"
            data-active={showFilters || !!(brand || group)}
          >
            <SlidersHorizontal size={14} /> סינון
          </button>

          {showFilters && (
            <div className="mt-3 space-y-3">
              {meta.brands.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button className="store-chip" data-active={!brand} onClick={() => setParam('brand', '')}>
                    כל המותגים
                  </button>
                  {meta.brands.map((b) => (
                    <button key={b} className="store-chip" data-active={brand === b}
                      onClick={() => setParam('brand', brand === b ? '' : b)}>
                      {b}
                    </button>
                  ))}
                </div>
              )}
              {meta.groups.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button className="store-chip" data-active={!group} onClick={() => setParam('group', '')}>
                    הכל
                  </button>
                  {meta.groups.map((g) => (
                    <button key={g} className="store-chip" data-active={group === g}
                      onClick={() => setParam('group', group === g ? '' : g)}>
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map((p) => (
          <Link key={p.id} href={`/s/${slug}/p/${encodeURIComponent(p.id)}`} className="store-card block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={yupooImg(p.image || '')} alt={p.title} className="store-photo" loading="lazy" />
            <div className="p-3">
              <h2 className="text-sm font-medium leading-snug line-clamp-2 mb-1.5">{p.title}</h2>
              <div className="store-price text-base mb-1">{priceLabel(p)}</div>
              {p.brand && <div className="store-brand text-[11px]">{p.brand}</div>}
            </div>
          </Link>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-[var(--store-gold)]" />
        </div>
      )}

      {!loading && page < pages && (
        <div className="flex justify-center py-8">
          <button onClick={() => load(page + 1)} className="store-chip px-6 py-2.5">
            טען עוד מוצרים
          </button>
        </div>
      )}
    </StoreShell>
  );
}
