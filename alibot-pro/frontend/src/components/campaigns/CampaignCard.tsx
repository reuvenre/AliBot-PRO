'use client';

import { useState } from 'react';
import { Play, Pause, Trash2, ChevronRight, Clock, FileText } from 'lucide-react';
import type { Campaign } from '@/types';

const STATUS_STYLES: Record<Campaign['status'], string> = {
  active:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  paused:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  draft:   'bg-white/5 text-white/40 border-white/10',
  error:   'bg-red-500/15 text-red-400 border-red-500/25',
};

const STATUS_LABEL: Record<Campaign['status'], string> = {
  active:  'פעיל',
  paused:  'מושהה',
  draft:   'טיוטה',
  error:   'שגיאה',
};

interface CampaignCardProps {
  campaign: Campaign;
  onToggle: (id: string, status: Campaign['status']) => Promise<void>;
  onRunNow: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onClick: (id: string) => void;
}

export function CampaignCard({ campaign, onToggle, onRunNow, onDelete, onClick }: CampaignCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsToggling(true);
    await onToggle(campaign.id, campaign.status).finally(() => setIsToggling(false));
  };

  const handleRunNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRunning(true);
    await onRunNow(campaign.id).finally(() => setIsRunning(false));
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`למחוק את קמפיין "${campaign.name}"?`)) {
      await onDelete(campaign.id);
    }
  };

  return (
    <div
      onClick={() => onClick(campaign.id)}
      className="group bg-[#0d0f1a] border border-white/5 hover:border-white/10 rounded-xl p-5 cursor-pointer transition-all hover:bg-[#111320]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[campaign.status]}`}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white truncate">{campaign.name}</h3>
        </div>
        <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 transition-colors mt-0.5 mr-2 flex-shrink-0 rotate-180" />
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap gap-1 mb-4">
        {campaign.keywords.slice(0, 3).map((kw) => (
          <span key={kw} className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-md">
            {kw}
          </span>
        ))}
        {campaign.keywords.length > 3 && (
          <span className="text-[10px] text-white/25">+{campaign.keywords.length - 3}</span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-white/30 mb-4">
        <span className="flex items-center gap-1">
          <FileText size={11} />
          {campaign.posts_count} פוסטים
        </span>
        {campaign.next_run_at && (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(campaign.next_run_at).toLocaleString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
        <button
          onClick={handleToggle}
          disabled={isToggling || campaign.status === 'draft'}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-40 transition-all"
        >
          {campaign.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
          {campaign.status === 'active' ? 'השהה' : 'הפעל'}
        </button>

        <button
          onClick={handleRunNow}
          disabled={isRunning || campaign.status !== 'active'}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 disabled:opacity-40 transition-all"
        >
          <Play size={12} />
          {isRunning ? 'שולח...' : 'הרץ עכשיו'}
        </button>

        <button
          onClick={handleDelete}
          className="mr-auto p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
