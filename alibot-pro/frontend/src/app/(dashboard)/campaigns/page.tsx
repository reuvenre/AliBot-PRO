'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Megaphone, Loader2 } from 'lucide-react';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { useCampaigns } from '@/lib/hooks/useCampaigns';

export default function CampaignsPage() {
  const router = useRouter();
  const { campaigns, total, isLoading, error, toggle, runNow, remove } = useCampaigns();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
            <Megaphone size={12} />
            <span>קמפיינים</span>
          </div>
          <h1 className="text-2xl font-bold text-white">קמפיינים</h1>
          {!isLoading && (
            <p className="text-sm text-white/40 mt-1">{total} קמפיינים סה״כ</p>
          )}
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Plus size={15} />
          קמפיין חדש
        </Link>
      </div>

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
        <div className="bg-[#0d0f1a] border border-dashed border-white/10 rounded-2xl p-16 flex flex-col items-center text-center">
          <Megaphone size={36} className="text-white/15 mb-4" />
          <h3 className="text-base font-semibold text-white/50 mb-2">אין קמפיינים עדיין</h3>
          <p className="text-sm text-white/25 mb-6 max-w-xs">
            קמפיין מריץ את הבוט אוטומטית — מחפש מוצרים, מייצר טקסט, ומפרסם לטלגרם
          </p>
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={14} />
            צור קמפיין ראשון
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
