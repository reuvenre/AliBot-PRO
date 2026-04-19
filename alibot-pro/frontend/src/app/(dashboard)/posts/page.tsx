'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Loader2, RotateCcw,
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { postsApi } from '@/lib/api-client';
import type { Post } from '@/types';

const STATUS_TABS = [
  { value: '', label: 'הכל' },
  { value: 'sent', label: 'נשלח' },
  { value: 'scheduled', label: 'מתוזמן' },
  { value: 'pending', label: 'ממתין' },
  { value: 'failed', label: 'נכשל' },
] as const;

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  sent:      { label: 'נשלח',    cls: 'bg-emerald-500/10 text-emerald-400',  Icon: CheckCircle2 },
  scheduled: { label: 'מתוזמן', cls: 'bg-purple-500/10 text-purple-400',    Icon: Clock },
  pending:   { label: 'ממתין',   cls: 'bg-blue-500/10 text-blue-400',        Icon: Clock },
  failed:    { label: 'נכשל',    cls: 'bg-red-500/10 text-red-400',          Icon: XCircle },
};

const LIMITS = [10, 20, 50, 100];

function PostRow({ post, onRetry }: { post: Post; onRetry: (id: string) => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const cfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry(post.id).catch(() => {});
    setRetrying(false);
  };

  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          {post.product_image ? (
            <img src={post.product_image} alt="" className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-white/5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm text-white truncate max-w-xs">{post.product_title}</p>
            {post.campaign_name && (
              <p className="text-xs text-white/30">{post.campaign_name}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${cfg.cls}`}>
          <cfg.Icon size={11} />
          {cfg.label}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-white/50">
        ₪{post.price_ils?.toFixed(2) || '—'}
      </td>
      <td className="py-3 px-4 text-xs text-white/30">
        {post.status === 'scheduled' && post.scheduled_at ? (
          <span className="text-purple-400">
            🕐 {new Date(post.scheduled_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : post.sent_at ? (
          new Date(post.sent_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        ) : (
          new Date(post.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        )}
      </td>
      <td className="py-3 px-4">
        {post.status === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/60 rounded-lg transition-all"
          >
            {retrying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            נסה שוב
          </button>
        )}
        {post.error_message && (
          <p className="text-[10px] text-red-400/70 mt-1 max-w-[180px] truncate" title={post.error_message}>
            {post.error_message}
          </p>
        )}
      </td>
    </tr>
  );
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await postsApi.list({ page, limit, status: status || undefined });
      setPosts(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, status]);

  useEffect(() => { load(); }, [load]);

  const handleRetry = async (id: string) => {
    await postsApi.retry(id);
    load({ silent: true });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
            <FileText size={12} />
            <span>פוסטים</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ניהול פוסטים</h1>
        </div>
        <button
          onClick={() => load({ silent: true })}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/60 text-sm rounded-xl transition-all"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          רענן
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-[#0d0f1a] border border-white/5 rounded-xl p-1 mb-6 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatus(t.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${status === t.value
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-[#0d0f1a] border border-dashed border-white/10 rounded-2xl p-16 text-center">
          <FileText size={36} className="text-white/15 mx-auto mb-4" />
          <p className="text-sm text-white/30">אין פוסטים</p>
        </div>
      ) : (
        <div className="bg-[#0d0f1a] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/5">
                <th className="py-3 px-4 text-right font-medium">מוצר</th>
                <th className="py-3 px-4 text-right font-medium">סטטוס</th>
                <th className="py-3 px-4 text-right font-medium">מחיר</th>
                <th className="py-3 px-4 text-right font-medium">תאריך</th>
                <th className="py-3 px-4 text-right font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <PostRow key={p.id} post={p} onRetry={handleRetry} />
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <span>שורות:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 outline-none"
              >
                {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <span>מתוך {total}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
              <span className="text-xs text-white/50 px-2">עמוד {page} מתוך {totalPages || 1}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
