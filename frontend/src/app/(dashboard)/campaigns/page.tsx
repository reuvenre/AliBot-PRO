'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, Megaphone, Loader2, Languages } from 'lucide-react';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { useCampaigns } from '@/lib/hooks/useCampaigns';
import { campaignsApi } from '@/lib/api-client';

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, total, isLoading, error, toggle, runNow, remove } = useCampaigns();

  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string | null>(null);
  const translateKeywords = async () => {
    if (!confirm('לתרגם את כל מילות המפתח בכל הקמפיינים מעברית לאנגלית? הפעולה מעדכנת את הקמפיינים.')) return;
    setTranslating(true); setTranslateMsg(null);
    try {
      const r = await campaignsApi.translateKeywords();
      setTranslateMsg(r.translations.length
        ? `✓ עודכנו ${r.campaigns_updated} קמפיינים · ${r.translations.length} מילות מפתח תורגמו: ${r.translations.slice(0, 8).map((t) => `${t.before}→${t.after}`).join(' · ')}${r.translations.length > 8 ? ' …' : ''}`
        : '✓ כל מילות המפתח כבר באנגלית — לא נדרש שינוי.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setTranslateMsg(`⚠️ ${err?.response?.data?.message || 'התרגום נכשל'}`);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
            <Megaphone size={12} />
            <span>הטייס האוטומטי</span>
          </div>
          <h1 className="text-2xl font-bold text-white">הטייס האוטומטי</h1>
          {!isLoading && (
            <p className="text-sm text-white/40 mt-1">{total} טייסים אוטומטיים סה״כ</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={translateKeywords}
            disabled={translating}
            title="תרגם את מילות המפתח בכל הקמפיינים מעברית לאנגלית — כדי שהחיפוש ב-AliExpress יתאים לאתר"
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 text-sm rounded-xl transition-all"
          >
            {translating ? <Loader2 size={15} className="animate-spin" /> : <Languages size={15} />}
            תרגם מילות מפתח לאנגלית
          </button>
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={15} />
            טייס אוטומטי חדש
          </Link>
        </div>
      </div>

      {translateMsg && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${translateMsg.startsWith('✓')
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          : 'bg-red-500/10 border-red-500/25 text-red-300'}`}>
          {translateMsg}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && campaigns.length === 0 && (
        <div className="bg-surface-secondary border border-dashed border-edge-hover rounded-2xl p-16 flex flex-col items-center text-center">
          <Megaphone size={36} className="text-white/15 mb-4" />
          <h3 className="text-base font-semibold text-white/50 mb-2">עדיין לא הגדרת טייס אוטומטי</h3>
          <p className="text-sm text-white/25 mb-6 max-w-xs">
            הטייס האוטומטי מריץ את הבוט בשבילך — מחפש מוצרים, מייצר טקסט, ומפרסם לטלגרם
          </p>
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={14} />
            הגדר טייס אוטומטי ראשון
          </Link>
        </div>
      )}

      {/* Grid */}
      {!isLoading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onToggle={toggle}
              onRunNow={runNow}
              onDelete={remove}
              onClick={(id) => router.push(`/campaigns/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
