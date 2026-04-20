'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowRight, Loader2, AlertCircle, Save, Trash2,
  RotateCw, FileText, CheckCircle2, XCircle, Star,
  ShoppingBag, Package,
} from 'lucide-react';
import { catalogApi } from '@/lib/api-client';
import type { CatalogProduct } from '@/types';

const SYMS: Record<string, string> = { ILS: '₪', EUR: '€', GBP: '£', USD: '$' };

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  approved: 'אושר',
  rejected: 'נדחה',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/45 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = 'text', dir, rows,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  dir?: string;
  rows?: number;
}) {
  const cls = 'w-full bg-[#13151f] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13px] text-white/80 placeholder-white/20 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none';
  if (rows) {
    return (
      <textarea
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cls}
      />
    );
  }
  return (
    <input
      type={type}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className={cls}
    />
  );
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [origPrice, setOrigPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [coupon, setCoupon] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    catalogApi.get(id)
      .then((p) => {
        setProduct(p);
        setTitle(p.title);
        setDescription(p.description || '');
        setSalePrice(String(p.sale_price));
        setOrigPrice(String(p.original_price));
        setDiscount(String(p.discount_percent));
        setCoupon(p.coupon_code || '');
        setKeyword(p.keyword || '');
        setCategory(p.category || '');
        setAffiliateUrl(p.affiliate_url || '');
        setImageUrl(p.image_url || '');
      })
      .catch(() => setError('שגיאה בטעינת המוצר'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await catalogApi.update(id, {
        title,
        description: description || undefined,
        sale_price: parseFloat(salePrice) || 0,
        original_price: parseFloat(origPrice) || 0,
        discount_percent: parseInt(discount) || 0,
        coupon_code: coupon || undefined,
        keyword: keyword || undefined,
        category: category || undefined,
        affiliate_url: affiliateUrl || undefined,
        image_url: imageUrl || undefined,
      });
      setProduct(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('שגיאה בשמירת המוצר');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const updated = await catalogApi.sync(id);
      setProduct(updated);
      setTitle(updated.title);
      setSalePrice(String(updated.sale_price));
      setOrigPrice(String(updated.original_price));
      setDiscount(String(updated.discount_percent));
      setImageUrl(updated.image_url || '');
    } catch {
      setError('שגיאה בסנכרון');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm('למחוק מוצר זה מהקטלוג?')) return;
    await catalogApi.remove(id);
    router.push('/products');
  }

  async function handleApprove() {
    const updated = await catalogApi.approve(id);
    setProduct(updated);
  }

  async function handleReject() {
    const updated = await catalogApi.reject(id);
    setProduct(updated);
  }

  function handleCreatePost() {
    if (!product) return;
    sessionStorage.setItem('quick_post_catalog_product', JSON.stringify({
      product_id: product.product_id,
      title: product.title,
      original_price: product.original_price,
      sale_price: product.sale_price,
      discount_percent: product.discount_percent,
      image_url: product.image_url,
      product_url: product.product_url,
      affiliate_url: product.affiliate_url,
      category: product.category,
      orders_count: product.orders_count,
      rating: product.rating,
      currency: product.currency,
    }));
    router.push('/quick-post?from_catalog=1');
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-white/50">{error}</p>
          <button onClick={() => router.push('/products')} className="mt-4 text-blue-400 text-[13px] hover:underline">
            חזור למוצרים
          </button>
        </div>
      </div>
    );
  }

  const s = SYMS[product?.currency || 'ILS'] || '₪';

  return (
    <div style={{ direction: 'rtl' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/products')}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <ArrowRight size={15} />
          </button>
          <div>
            <h1 className="text-[20px] font-bold text-white tracking-tight">ערוך מוצר</h1>
            <p className="text-[12px] text-white/35 mt-0.5">עדכן פרטי מוצר</p>
          </div>
        </div>

        {/* Status Badge */}
        {product && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] font-medium ${STATUS_COLORS[product.status]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {STATUS_LABELS[product.status]}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">

        {/* ── Left: Form ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Basic Info */}
          <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Package size={13} className="text-white/30" />
              מידע בסיסי
            </h2>
            <div className="space-y-4">
              <Field label="כותרת מוצר *">
                <Input value={title} onChange={setTitle} placeholder="כותרת המוצר" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="קטגוריה">
                  <Input value={category} onChange={setCategory} placeholder="Electronics" />
                </Field>
                <Field label="מילת מפתח">
                  <Input value={keyword} onChange={setKeyword} placeholder="מילת מפתח" />
                </Field>
              </div>
              <Field label="תיאור" hint="עד 1000 תווים">
                <Input
                  value={description}
                  onChange={setDescription}
                  placeholder="תיאור המוצר..."
                  rows={4}
                />
                <p className="text-[10px] text-white/20 text-left mt-1">{description.length}/1000</p>
              </Field>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white/70 mb-4">$ תמחור ומסחר</h2>
            <div className="grid grid-cols-3 gap-3">
              <Field label="מחיר *">
                <Input value={salePrice} onChange={setSalePrice} type="number" dir="ltr" placeholder="0.00" />
              </Field>
              <Field label="מחיר מקורי">
                <Input value={origPrice} onChange={setOrigPrice} type="number" dir="ltr" placeholder="0.00" />
              </Field>
              <Field label="הנחה (%)">
                <Input value={discount} onChange={setDiscount} type="number" dir="ltr" placeholder="0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="קוד קופון">
                <Input value={coupon} onChange={setCoupon} dir="ltr" placeholder="SAVE10" />
              </Field>
            </div>
          </div>

          {/* Supplier */}
          <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-white/70 mb-4">🔗 פרטי ספק</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="ספק">
                  <div className="flex items-center h-[42px] px-3.5 bg-[#13151f] border border-white/[0.08] rounded-xl text-[13px] text-white/40">
                    {product?.supplier || 'AliExpress'}
                  </div>
                </Field>
                <Field label="מזהה מוצר">
                  <div className="flex items-center h-[42px] px-3.5 bg-[#13151f] border border-white/[0.08] rounded-xl text-[13px] text-white/40 font-mono" dir="ltr">
                    {product?.product_id}
                  </div>
                </Field>
              </div>
              <Field label="כתובת URL לקידום">
                <Input value={affiliateUrl} onChange={setAffiliateUrl} dir="ltr" placeholder="https://s.click.aliexpress.com/..." />
              </Field>
              <Field label="כתובת תמונה ראשית">
                <Input value={imageUrl} onChange={setImageUrl} dir="ltr" placeholder="https://ae01.alicdn.com/..." />
              </Field>
            </div>
          </div>

          {/* Performance */}
          {product && (
            <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-white/70 mb-4">📈 נתוני ביצועים</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#13151f] rounded-xl px-4 py-3 text-center">
                  <p className="text-[10px] text-white/30 mb-1">מכירות</p>
                  <p className="text-[18px] font-bold text-white">{product.orders_count.toLocaleString()}</p>
                </div>
                <div className="bg-[#13151f] rounded-xl px-4 py-3 text-center">
                  <p className="text-[10px] text-white/30 mb-1">דירוג</p>
                  <p className="text-[18px] font-bold text-white flex items-center justify-center gap-1">
                    <Star size={13} className="text-amber-400 fill-amber-400" />
                    {product.rating.toFixed(1)}
                  </p>
                </div>
                <div className="bg-[#13151f] rounded-xl px-4 py-3 text-center">
                  <p className="text-[10px] text-white/30 mb-1">עמלה</p>
                  <p className="text-[18px] font-bold text-emerald-400">
                    {product.commission_rate > 0 ? `${product.commission_rate}%` : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-[13px] text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* ── Right: Preview + Actions ───────────────────────────────────── */}
        <div className="space-y-4">

          {/* Product preview */}
          <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl overflow-hidden">
            {product?.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-[#13151f] flex items-center justify-center">
                <Package size={40} className="text-white/10" />
              </div>
            )}
            <div className="p-4">
              <p className="text-[12px] text-white/60 line-clamp-2 mb-2">{product?.title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[16px] font-bold text-white">
                  {s}{product?.sale_price.toFixed(2)}
                </span>
                {product && product.original_price > product.sale_price && (
                  <span className="text-[11px] text-white/25 line-through">
                    {s}{product.original_price.toFixed(2)}
                  </span>
                )}
              </div>
              {product?.rating ? (
                <div className="flex items-center gap-1 mt-1.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={10}
                      className={i < Math.round(product.rating) ? 'text-amber-400 fill-amber-400' : 'text-white/15'}
                    />
                  ))}
                  <span className="text-[10px] text-white/35 mr-1">{product.rating.toFixed(1)}</span>
                  <ShoppingBag size={9} className="text-white/25 mr-0.5" />
                  <span className="text-[10px] text-white/25">{product.orders_count.toLocaleString()}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-[#0e1016] border border-white/[0.06] rounded-xl p-4 space-y-2">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3">פעולות מהירות</p>

            <button
              onClick={handleCreatePost}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-400 text-[13px] font-medium transition-all"
            >
              <FileText size={13} />
              צור פוסט מהמוצר
            </button>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/15 text-blue-400 text-[13px] font-medium transition-all disabled:opacity-50"
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
              סנכרן נתונים מ-AliExpress
            </button>

            {product?.status !== 'approved' && (
              <button
                onClick={handleApprove}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/15 text-emerald-400 text-[13px] font-medium transition-all"
              >
                <CheckCircle2 size={13} />
                אשר מוצר
              </button>
            )}

            {product?.status !== 'rejected' && (
              <button
                onClick={handleReject}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/15 text-red-400 text-[13px] font-medium transition-all"
              >
                <XCircle size={13} />
                דחה מוצר
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Action Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/[0.06]">
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/15 text-red-400 text-[13px] font-medium transition-all"
        >
          <Trash2 size={13} />
          הסר מוצר
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/products')}
            className="px-4 py-2.5 text-[13px] text-white/40 hover:text-white/70 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold transition-all shadow-sm shadow-blue-600/20"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saved ? '✓ נשמר!' : 'עדכן מוצר'}
          </button>
        </div>
      </div>
    </div>
  );
}
