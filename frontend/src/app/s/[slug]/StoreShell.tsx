'use client';

import Link from 'next/link';
import { Search, X, Menu } from 'lucide-react';
import { useState } from 'react';
import type { StoreMeta } from '@/types';

/**
 * The store's chrome: wordmark, menu, search.
 *
 * Shared by the grid and the product page so a follower who lands deep — which is what a
 * link in a post produces — still has a way into the rest of the catalog. That is the
 * whole point of the store: they came for one product, they should leave having seen ten.
 */
export function StoreShell({
  meta, children, search, onSearch,
}: {
  meta: StoreMeta;
  children: React.ReactNode;
  search?: string;
  onSearch?: (v: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState(search || '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(term);
    setMenu(false);
  };

  return (
    <div className="store-root" dir="rtl">
      <header className="sticky top-0 z-30 bg-[var(--store-bg)]/95 backdrop-blur border-b border-[var(--store-line)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => setMenu(true)}
            aria-label="תפריט"
            className="p-2 -mr-2 text-[var(--store-ink)]"
          >
            <Menu size={22} />
          </button>
          <Link href={`/s/${meta.slug}`} className="store-wordmark text-xl sm:text-2xl font-bold">
            {meta.name}
          </Link>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-40" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <nav
            className="absolute inset-y-0 right-0 w-[85%] max-w-sm bg-[var(--store-bg)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setMenu(false)} aria-label="סגור"><X size={20} /></button>
              <span className="font-semibold">תפריט</span>
            </div>

            <form onSubmit={submit} className="relative mb-6">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--store-muted)]" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="חפש מוצרים…"
                className="w-full bg-[var(--store-card)] border border-[var(--store-line)] rounded-xl py-3 pr-10 pl-3 text-sm outline-none focus:border-[var(--store-gold)]"
              />
            </form>

            <div className="space-y-1 text-lg">
              <Link href={`/s/${meta.slug}`} onClick={() => setMenu(false)} className="block py-2.5">
                כל המוצרים
              </Link>
              {meta.brands.slice(0, 12).map((b) => (
                <Link
                  key={b}
                  href={`/s/${meta.slug}?brand=${encodeURIComponent(b)}`}
                  onClick={() => setMenu(false)}
                  className="block py-2.5 text-[var(--store-muted)]"
                >
                  {b}
                </Link>
              ))}
            </div>

            {meta.whatsapp && (
              <a
                href={waLink(meta.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="store-whatsapp mt-8"
              >
                צור קשר בוואטסאפ
              </a>
            )}
          </nav>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-[var(--store-line)] mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-[var(--store-muted)] space-y-2">
          {meta.tagline && <p>{meta.tagline}</p>}
          <p>© {new Date().getFullYear()} {meta.name}</p>
        </div>
      </footer>
    </div>
  );
}

/** wa.me wants digits only — a pasted number arrives with +, dashes and spaces. */
export function waLink(number: string, text?: string): string {
  const digits = String(number || '').replace(/\D/g, '');
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${q}`;
}
