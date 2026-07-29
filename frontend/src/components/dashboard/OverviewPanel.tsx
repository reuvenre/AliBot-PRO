'use client';

import { useEffect, useState } from 'react';
import { BadgeDollarSign, MousePointerClick, Send, TrendingDown, TrendingUp } from 'lucide-react';
import { statsApi } from '@/lib/api-client';
import { useCountUp } from '@/lib/hooks/useCountUp';
import type { OverviewStats } from '@/types';

/**
 * The dashboard headline: commissions, clicks and posts over the last 12 weeks, each with
 * its own trend and a shared weekly bar chart. One request feeds all of it.
 */

const WEEKS = 12;

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const max = Math.max(...points, 1);
  // A single data point has no line to draw; render nothing rather than a stray dot.
  if (points.length < 2) return <span className="h-5" />;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * 56},${18 - (p / max) * 15}`)
    .join(' ');
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" className="overflow-visible" aria-hidden>
      <path d={d} fill="none" stroke={positive ? '#34d399' : '#60a5fa'} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeltaBadge({ pct }: { pct: number | null }) {
  // Null means there was no previous period to compare with — showing "+100%" for a first
  // week of data would be an invented claim, so the badge simply doesn't appear.
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`flex items-center gap-0.5 text-2xs font-semibold px-1.5 py-0.5 rounded-full
        ${up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
      dir="ltr"
    >
      <Icon size={9} />{up ? '+' : ''}{pct}%
    </span>
  );
}

function Tile({
  label, value, series, delta, icon: Icon, accent,
}: {
  label: string; value: string; series: number[]; delta: number | null;
  icon: typeof Send; accent: string;
}) {
  return (
    <div className="bg-surface-secondary border border-edge rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-white/40">{label}</p>
        <Icon size={13} className={accent} />
      </div>
      <p className="text-2xl font-bold text-white tracking-tight mb-2" dir="ltr">{value}</p>
      <div className="flex items-center justify-between">
        <Sparkline points={series} positive={(delta ?? 0) >= 0} />
        <DeltaBadge pct={delta} />
      </div>
    </div>
  );
}

function WeeklyBars({ series, weekStarts }: { series: number[]; weekStarts: string[] }) {
  const max = Math.max(...series, 1);
  return (
    <div className="relative flex items-end gap-1 h-24" dir="ltr">
      {series.map((v, i) => {
        const recent = i >= series.length - 3;
        return (
          <div
            key={weekStarts[i] ?? i}
            // A zero week must still be visible as a baseline tick, otherwise a gap reads
            // as "no bar rendered" — a rendering bug rather than a quiet week.
            className="flex-1 rounded-t-[3px] min-h-[2px] transition-all duration-500"
            style={{
              height: `${Math.max(2, (v / max) * 100)}%`,
              background: recent
                ? 'linear-gradient(180deg,#3b82f6,#6366f1)'
                : 'linear-gradient(180deg,#3b82f6aa,#3b82f633)',
            }}
            title={`${weekStarts[i] ?? ''} · ₪${v.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`}
          />
        );
      })}
    </div>
  );
}

export function OverviewPanel() {
  const [data, setData] = useState<OverviewStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    statsApi.overview(WEEKS).then(setData).catch(() => setFailed(true));
  }, []);

  const m = data?.metrics;
  const commissions = useCountUp(m?.commissions.total ?? 0);
  const clicks = useCountUp(m?.clicks.total ?? 0);
  const posts = useCountUp(m?.posts.total ?? 0);

  if (failed) return null; // the rest of the dashboard still works without the headline

  if (!data || !m) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface-secondary border border-edge rounded-2xl p-4 h-[118px] animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAnything = m.commissions.total > 0 || m.clicks.total > 0 || m.posts.total > 0;

  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Tile
          label="עמלות" icon={BadgeDollarSign} accent="text-emerald-300"
          value={`₪${commissions.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
          series={m.commissions.series} delta={m.commissions.delta_pct}
        />
        <Tile
          label="קליקים" icon={MousePointerClick} accent="text-blue-300"
          value={Math.round(clicks).toLocaleString('he-IL')}
          series={m.clicks.series} delta={m.clicks.delta_pct}
        />
        <Tile
          label="פוסטים" icon={Send} accent="text-violet-300"
          value={Math.round(posts).toLocaleString('he-IL')}
          series={m.posts.series} delta={m.posts.delta_pct}
        />
      </div>

      <div className="bg-surface-secondary border border-edge rounded-2xl px-4 pt-4 pb-3 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white/70">עמלות · {data.weeks} שבועות</p>
          <span className="text-xs text-white/35" dir="ltr">
            ₪{m.commissions.total.toLocaleString('he-IL', { maximumFractionDigits: 0 })} סה״כ
          </span>
        </div>
        {hasAnything ? (
          <WeeklyBars series={m.commissions.series} weekStarts={data.week_starts} />
        ) : (
          // A brand-new account has a flat chart, which reads as broken rather than empty.
          <div className="h-24 flex flex-col items-center justify-center text-center gap-1">
            <p className="text-sm text-white/45">עוד אין נתונים להצגה</p>
            <p className="text-xs text-white/30">ברגע שהפוסטים הראשונים יפורסמו, המגמה תופיע כאן</p>
          </div>
        )}
      </div>
    </section>
  );
}
