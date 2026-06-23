'use client';

import { useState, useEffect } from 'react';
import {
  Wand2, Star, ShoppingBag, Tag, DollarSign, Percent, Languages, Loader2,
} from 'lucide-react';
import type { AliProduct, PostTemplate } from '@/types';

const SYMBOLS: Record<string, string> = { ILS: '₪', EUR: '€', GBP: '£', USD: '$' };
const HE_RE = /[\u0590-\u05FF]/;

async function translateToHebrew(text: string): Promise<string> {
  if (HE_RE.test(text)) return text;
  try {
    const resp = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|he`
    );
    const data = await resp.json();
    if (data.responseData?.translatedText && HE_RE.test(data.responseData.translatedText)) {
      return data.responseData.translatedText;
    }
  } catch {}
  return text;
}


interface ProductEditPanelProps {
  product: AliProduct;
  rate: number;
  activeTemplate?: PostTemplate;
  onGenerate: (edited: AliProduct & { price_ils: number }) => void;
  onClose: () => void;
  isGenerating: boolean;
}

export function ProductEditPanel({
  product,
  rate,
  activeTemplate,
  onGenerate,
  isGenerating,
}: ProductEditPanelProps) {
  const [title, setTitle] = useState(product.title);
  const sym = SYMBOLS[product.currency] || product.currency || '₪';
  const [salePrice, setSalePrice] = useState(product.sale_price);
  const [origPrice, setOrigPrice] = useState(product.original_price);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setSalePrice(product.sale_price);
    setOrigPrice(product.original_price);
    setIsTranslating(true);
    translateToHebrew(product.title)
      .then(translated => setTitle(translated))
      .finally(() => setIsTranslating(false));
  }, [product.product_id]);

  const discountPct =
    origPrice > salePrice && origPrice > 0
      ? Math.round(((origPrice - salePrice) / origPrice) * 100)
      : 0;

  const handleGenerate = () => {
    onGenerate({
      ...product,
      title,
      sale_price: salePrice,
      original_price: origPrice,
      discount_percent: discountPct,
      price_ils: salePrice,
    });
  };

  return (
    <div className="bg-surface-secondary border border-edge rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-edge">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">עריכת מוצר</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-white/30">
          <span className="flex items-center gap-1">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            {product.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <ShoppingBag size={10} />
            {product.orders_count.toLocaleString()} הזמנות
          </span>
          {product.category && (
            <span className="flex items-center gap-1 truncate">
              <Tag size={10} />
              {product.category}
            </span>
          )}
        </div>

        {/* Editable title */}
        <div>
          <label className="block text-2xs font-medium text-white/40 mb-1.5 uppercase tracking-wider">
            שם המוצר
          </label>
          {isTranslating && (
            <span className="text-xs text-white/40 flex items-center gap-1 mt-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              מתרגם...
            </span>
          )}
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isTranslating}
            rows={3}
            className="w-full bg-white/5 border border-edge-hover rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors resize-none leading-relaxed"
            dir="auto"
          />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-2xs font-medium text-white/40 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={9} /> מחיר מבצע ({sym})
            </label>
            <input
              type="number"
              min={0}
              value={salePrice}
              onChange={(e) => setSalePrice(Math.max(0, +e.target.value))}
              className="w-full bg-white/5 border border-edge-hover rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-2xs font-medium text-white/40 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <DollarSign size={9} /> מחיר מקורי ({sym})
            </label>
            <input
              type="number"
              min={0}
              value={origPrice}
              onChange={(e) => setOrigPrice(Math.max(0, +e.target.value))}
              className="w-full bg-white/5 border border-edge-hover rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
              dir="ltr"
            />
          </div>
        </div>

        {/* Price-accuracy hint — the AliExpress API price can differ from the live
            site (variant / bulk tiers), so make verifying & correcting it one click. */}
        <p className="text-2xs text-white/30 -mt-1 flex items-center gap-1 flex-wrap">
          <span>מחיר משוער מ-AliExpress — מומלץ לוודא.</span>
          {product.product_url && (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              פתח את המוצר באתר לבדיקה/תיקון ↗
            </a>
          )}
        </p>

        {/* Discount preview */}
        {discountPct > 0 && (
          <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <Percent size={12} className="text-red-400 shrink-0" />
            <span className="text-red-400">הנחה מחושבת: <strong>{discountPct}%</strong></span>
            <span className="text-white/30 mr-auto">
              חיסכון: {sym}{(origPrice - salePrice).toFixed(2)}
            </span>
          </div>
        )}

        {/* Active template indicator */}
        {activeTemplate && activeTemplate.id !== 'builtin_default' && (
          <div className="flex items-center gap-2 text-xs bg-white/3 border border-edge rounded-lg px-3 py-2">
            <span>{activeTemplate.icon}</span>
            <span className="text-white/40">תבנית:</span>
            <span className="text-white/70 font-medium">{activeTemplate.name}</span>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !title.trim()}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Wand2 size={14} className={isGenerating ? 'animate-pulse' : ''} />
          {isGenerating ? 'מייצר פוסט...' : 'צור פוסט'}
        </button>
      </div>
    </div>
  );
}
