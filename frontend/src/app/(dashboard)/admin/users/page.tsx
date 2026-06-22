'use client';

import { useEffect, useState } from 'react';
import { Users, Shield, Loader2, Mail, BadgeCheck, RefreshCw } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { adminApi } from '@/lib/api-client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { AdminUser, AdminStats } from '@/types';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.stats(), adminApi.users()])
      .then(([s, u]) => { setStats(s); setUsers(u); setForbidden(false); })
      .catch((e) => { if (e?.response?.status === 403) setForbidden(true); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (forbidden || (user && user.role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Shield size={32} className="text-white/20 mb-4" />
        <h1 className="text-xl font-bold text-white">גישת מנהל בלבד</h1>
        <p className="text-sm text-white/40 mt-2">העמוד הזה זמין רק למשתמשי אדמין.</p>
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-blue-400" /> ניהול משתמשים
          </h1>
          <p className="text-sm text-white/40 mt-1">כל המשתמשים שנרשמו למערכת</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 text-sm rounded-xl transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="סך משתמשים" value={stats?.total_users ?? 0} icon={Users} accent="blue" />
        <StatCard label="מנהלים" value={stats?.admins ?? 0} icon={Shield} accent="violet" />
        <StatCard label="דרך Google" value={stats?.google_users ?? 0} icon={BadgeCheck} accent="green" />
      </div>

      <section className="bg-surface-secondary border border-edge rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-edge flex items-center gap-2">
          <Mail size={15} className="text-white/40" />
          <h3 className="text-sm font-semibold text-white">רשומים ({users.length})</h3>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 size={20} className="animate-spin text-blue-400" /></div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/40">אין עדיין משתמשים רשומים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-2xs text-white/35 border-b border-edge">
                  <th className="px-5 py-2.5 font-medium">אימייל</th>
                  <th className="px-3 py-2.5 font-medium">תפקיד</th>
                  <th className="px-3 py-2.5 font-medium text-center">פוסטים</th>
                  <th className="px-3 py-2.5 font-medium text-center">קמפיינים</th>
                  <th className="px-3 py-2.5 font-medium">הצטרף</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-edge last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white/80" dir="ltr">{u.email}</td>
                    <td className="px-3 py-3">
                      <span className={`text-2xs px-2 py-0.5 rounded-full border ${u.role === 'admin'
                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/25'
                        : 'bg-white/5 text-white/45 border-edge'}`}>
                        {u.role === 'admin' ? 'אדמין' : 'משתמש'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-white/60">{u.posts_count}</td>
                    <td className="px-3 py-3 text-center text-white/60">{u.campaigns_count}</td>
                    <td className="px-3 py-3 text-white/45">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
