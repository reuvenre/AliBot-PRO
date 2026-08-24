'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StoreMeta, StoreSort } from '@/types';

/**
 * The filter panel: a column on a desktop, a drawer on a phone.
 *
 * Everything it changes lives in the URL rather than in its own state, so a filtered
 * shelf can be sent to somebody, opened in a second tab, or reached with the back button
 * — which is what a shopper expects of a shop and what component state cannot give.
 */

const SORTS: { id: StoreSort; label: string }[] = [
  { id: 'newest', label: 'מהחדש לישן' },
  { id: 'oldest', label: 'מהישן לחדש' },
  { id: 'price_asc', label: 'מחיר: נמוך לגבוה' },
  { id: 'price_desc', label: 'מחיר: גבוה לנמוך' },
];

function Section({ title, children, open: initial = true }: {
  title: string; children: React.ReactNode; open?: boolean;
}) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="border border-[var(--store-line)] rounded-xl bg-[var(--store-card)] mb-3">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="text-sm font-semibold">{title}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function FilterPanel({
  meta, sort, brand, category, minPrice, maxPrice, bounds, onChange,
}: {
  meta: StoreMeta;
  sort: StoreSort;
  brand: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  bounds: { min: number; max: number };
  onChange: (patch: Record<string, string>) => void;
}) {
  // The price boxes are typed into, so they hold local text until the shopper is done —
  // pushing a URL change on every keystroke would refetch the shelf four times while
  // somebody types "120", and fight the caret doing it.
  const [lo, setLo] = useState(minPrice);
  const [hi, setHi] = useState(maxPrice);
  useEffect(() => { setLo(minPrice); setHi(maxPrice); }, [minPrice, maxPrice]);

  const applyPrice = () => onChange({ min_price: lo, max_price: hi, page: '' });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">סינון</h2>

      <Section title="מיון">
        <div className="space-y-2">
          {SORTS.map((s) => (
            <label key={s.id} className="flex items-center justify-end gap-2 text-sm cursor-pointer">
              <span>{s.label}</span>
              <input
                type="radio"
                name="store-sort"
                checked={sort === s.id}
                onChange={() => onChange({ sort: s.id, page: '' })}
                className="accent-[var(--store-gold)]"
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="מחיר">
        <div className="flex items-center gap-2" dir="ltr">
          <input
            inputMode="numeric"
            value={lo}
            onChange={(e) => setLo(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
            placeholder={String(bounds.min)}
            aria-label="מחיר מינימלי"
            className="w-full border border-[var(--store-line)] rounded-lg px-3 py-2 text-sm text-center outline-none focus:border-[var(--store-gold)]"
          />
          <span className="text-[var(--store-muted)]">–</span>
          <input
            inputMode="numeric"
            value={hi}
            onChange={(e) => setHi(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
            placeholder={String(bounds.max)}
            aria-label="מחיר מקסימלי"
            className="w-full border border-[var(--store-line)] rounded-lg px-3 py-2 text-sm text-center outline-none focus:border-[var(--store-gold)]"
          />
        </div>
        {(minPrice || maxPrice) && (
          <button
            onClick={() => onChange({ min_price: '', max_price: '', page: '' })}
            className="mt-2 text-xs text-[var(--store-muted)] underline"
          >
            נקה טווח
          </button>
        )}
      </Section>

      {meta.categories.length > 0 && (
        <Section title="קטגוריות">
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {meta.categories.map((c) => (
              <label key={c} className="flex items-center justify-end gap-2 text-sm cursor-pointer">
                <span className={category === c ? 'text-[var(--store-gold)]' : ''}>{c}</span>
                <input
                  type="checkbox"
                  checked={category === c}
                  onChange={() => onChange({ category: category === c ? '' : c, page: '' })}
                  className="accent-[var(--store-gold)]"
                />
              </label>
            ))}
          </div>
        </Section>
      )}

      {meta.brands.length > 0 && (
        <Section title="מותגים">
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {meta.brands.map((b) => (
              <label key={b} className="flex items-center justify-end gap-2 text-sm cursor-pointer">
                <span className={brand === b ? 'text-[var(--store-gold)]' : ''} dir="auto">{b}</span>
                <input
                  type="checkbox"
                  checked={brand === b}
                  onChange={() => onChange({ brand: brand === b ? '' : b, page: '' })}
                  className="accent-[var(--store-gold)]"
                />
              </label>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
