'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import type { EarningsSummary } from '@/types';

interface EarningsChartProps {
  summary: EarningsSummary;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-white font-medium">
          ₪{p.value.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
};

export function EarningsChart({ summary }: EarningsChartProps) {
  const data = summary.by_month.map((m) => ({
    name: m.month,
    מוסדר: m.settled,
    משוער: m.estimated,
  }));

  return (
    <div className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white">הכנסות לפי חודש</h3>
        <div className="flex items-center gap-3 text-[10px] text-white/40">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
            מוסדר
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
            משוער
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} barCategoryGap="35%">
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₪${v}`}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="מוסדר" fill="#10b981" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#10b981" opacity={0.8} />
            ))}
          </Bar>
          <Bar dataKey="משוער" fill="#3b82f6" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#3b82f6" opacity={0.5} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">מוסדר</p>
          <p className="text-sm font-bold text-emerald-400">
            ₪{summary.total_settled.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">משוער</p>
          <p className="text-sm font-bold text-blue-400">
            ₪{summary.total_estimated.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-0.5">בוטל</p>
          <p className="text-sm font-bold text-red-400">
            ₪{summary.total_cancelled.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
