'use client';

import { useState } from 'react';
import { ShoppingCart, TrendingUp, DollarSign, Package, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';

type OrderStatus = 'completed' | 'pending' | 'cancelled';

interface Order {
  id: string;
  orderId: string;
  product: { title: string; image: string };
  platform: 'aliexpress' | 'amazon';
  amount: number;
  commission: number;
  commissionStatus: 'confirmed' | 'estimated' | 'cancelled';
  status: OrderStatus;
  date: string;
}

const DEMO_ORDERS: Order[] = [
  { id: '1', orderId: '8155340294738', product: { title: 'Universal Automotive Windshield Wiper Kit 12V', image: 'https://ae01.alicdn.com/kf/S1a2b3c.jpg' }, platform: 'aliexpress', amount: 23.50, commission: 0.94, commissionStatus: 'confirmed', status: 'completed', date: 'אפר׳ 19, 2026, 20:17' },
  { id: '2', orderId: '8155340294739', product: { title: 'Wireless Bluetooth Earbuds Pro ANC', image: 'https://ae01.alicdn.com/kf/S4d5e6f.jpg' }, platform: 'aliexpress', amount: 15.99, commission: 0.64, commissionStatus: 'estimated', status: 'pending', date: 'אפר׳ 18, 2026, 15:30' },
  { id: '3', orderId: '8155340294740', product: { title: 'Grill LED Light Drive Red Blue Emergency Remote', image: 'https://ae01.alicdn.com/kf/S7g8h9i.jpg' }, platform: 'aliexpress', amount: 8.75, commission: 0.35, commissionStatus: 'estimated', status: 'completed', date: 'אפר׳ 18, 2026, 09:11' },
  { id: '4', orderId: '8155340294741', product: { title: '2Pcs Full Cover Tempered Glass Screen Protector', image: 'https://ae01.alicdn.com/kf/Sj0k1l2.jpg' }, platform: 'aliexpress', amount: 4.30, commission: 0.17, commissionStatus: 'confirmed', status: 'completed', date: 'אפר׳ 15, 2026, 07:22' },
];

const STATUS_CFG: Record<OrderStatus, { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: 'הושלם',  cls: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  pending:   { label: 'ממתין',  cls: 'bg-amber-500/10 text-amber-400',     icon: Clock },
  cancelled: { label: 'בוטל',   cls: 'bg-red-500/10 text-red-400',         icon: XCircle },
};

const COMM_CFG = {
  confirmed: { label: 'מאושר',  cls: 'bg-emerald-500/10 text-emerald-400' },
  estimated: { label: 'משוער',  cls: 'bg-blue-500/10 text-blue-400' },
  cancelled: { label: 'בוטל',   cls: 'bg-red-500/10 text-red-400' },
};

export default function OrdersPage() {
  const [orders] = useState<Order[]>(DEMO_ORDERS);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = orders.filter((o) => filter === 'all' || o.status === filter);
  const totalAmount = orders.reduce((s, o) => s + o.amount, 0);
  const totalComm   = orders.reduce((s, o) => s + o.commission, 0);
  const commRate    = totalAmount > 0 ? (totalComm / totalAmount) * 100 : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">הזמנות</h1>
          <p className="text-sm text-white/40 mt-1">מעקב אחר הזמנות ועמלות שותפים</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/60 text-sm rounded-xl transition-all">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          רענן
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'עמלה ממוצעת',   value: `${commRate.toFixed(1)}%`,            icon: TrendingUp,  accent: 'blue' },
          { label: 'סה״כ סכום',      value: `$${totalAmount.toFixed(2)}`,          icon: DollarSign,  accent: 'green' },
          { label: 'סה״כ עמלה',      value: `$${totalComm.toFixed(2)}`,            icon: DollarSign,  accent: 'violet' },
          { label: 'סה״כ הזמנות',    value: orders.length,                         icon: ShoppingCart, accent: 'amber' },
        ].map(({ label, value, icon: Icon, accent }) => {
          const map: Record<string, string> = { blue: 'text-blue-400 bg-blue-500/10', green: 'text-emerald-400 bg-emerald-500/10', violet: 'text-violet-400 bg-violet-500/10', amber: 'text-amber-400 bg-amber-500/10' };
          return (
            <div key={label} className="bg-[#0d0f1a] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/40">{label}</p>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${map[accent]}`}>
                  <Icon size={13} />
                </span>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex bg-[#0d0f1a] border border-white/5 rounded-xl p-1 gap-1 mb-5 w-fit">
        {[{ v: 'all' as const, l: 'הכל' }, { v: 'completed' as const, l: 'הושלם' }, { v: 'pending' as const, l: 'ממתין' }, { v: 'cancelled' as const, l: 'בוטל' }].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${filter === v ? 'bg-blue-600/20 text-blue-400' : 'text-white/40 hover:text-white/70'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#0d0f1a] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">סטטוס</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">מוצר</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">סכום</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">עמלה</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">מזהה הזמנה</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">תאריך</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Package size={32} className="text-white/15 mx-auto mb-3" />
                  <p className="text-sm text-white/30">אין הזמנות עדיין</p>
                  <p className="text-xs text-white/20 mt-1">הזמנות יופיעו כאן כשלקוחות ירכשו דרך קישורי השותפים שלך</p>
                </td>
              </tr>
            ) : filtered.map((order) => {
              const sc = STATUS_CFG[order.status];
              const cc = COMM_CFG[order.commissionStatus];
              const StatusIcon = sc.icon;
              return (
                <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${sc.cls}`}>
                      <StatusIcon size={10} />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 overflow-hidden">
                        <Package size={14} className="text-white/20" />
                      </div>
                      <p className="text-sm text-white/80 truncate max-w-[200px]">{order.product.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-sm font-semibold text-white">${order.amount.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cc.cls}`}>
                      ${order.commission.toFixed(2)} · {cc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-white/30 font-mono">{order.orderId}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="text-xs text-white/35">{order.date}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination hint */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-white/30">{filtered.length} הזמנות</p>
            <p className="text-xs text-white/20">עמוד 1 מתוך 1</p>
          </div>
        )}
      </div>
    </div>
  );
}
