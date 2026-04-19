'use client';

import { Star, ShoppingBag } from 'lucide-react';
import type { AliProduct } from '@/types';

const SYMBOLS: Record<string, string> = { ILS: '₪', EUR: '€', GBP: '£', USD: '$' };

interface ProductCardProps {
  product: AliProduct;
  onSelect: (product: AliProduct) => void;
  isSelected?: boolean;
}

export function ProductCard({ product, onSelect, isSelected }: ProductCardProps) {
  const sym = SYMBOLS[product.currency] || product.currency || '$';
  const fmt = (v: number) =>
    v.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group relative cursor-pointer rounded-xl overflow-hidden border transition-all
        ${isSelected
          ? 'border-blue-500/60 bg-blue-500/5'
          : 'border-white/5 bg-[#0d0f1a] hover:border-white/15 hover:bg-[#111320]'
        }`}
    >
      {/* Discount badge */}
      {product.discount_percent > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          -{product.discount_percent}%
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-square bg-white/5 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-white/70 line-clamp-2 leading-relaxed mb-2 min-h-[2.5rem]">
          {product.title}
        </p>

        {/* Prices — converted from USD using live exchange rate */}
        <div className="flex items-end gap-2 mb-2">
          <span className="text-sm font-bold text-white">
            {sym}{fmt(product.sale_price)}
          </span>
          {product.original_price > product.sale_price && (
            <span className="text-xs text-white/30 line-through">
              {sym}{fmt(product.original_price)}
            </span>
          )}
        </div>
        {product.sale_price_usd !== undefined && product.currency !== 'USD' && (
          <p className="text-[9px] text-white/20 mb-1">${product.sale_price_usd.toFixed(2)} USD</p>
        )}

        {/* Rating & Orders */}
        <div className="flex items-center gap-3 text-[10px] text-white/30">
          <span className="flex items-center gap-0.5">
            <Star size={9} className="text-amber-400 fill-amber-400" />
            {product.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-0.5">
            <ShoppingBag size={9} />
            {product.orders_count.toLocaleString()}
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded-xl pointer-events-none" />
      )}
    </div>
  );
}
