'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  LayoutDashboard,
  Megaphone,
  Zap,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Bot,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: '××©×××¨×',     icon: LayoutDashboard },
  { href: '/campaigns', label: '×§××¤××× ××',    icon: Megaphone },
  { href: '/quick-post',label: '×¤××¡× ××××¨',   icon: Zap },
  { href: '/posts',     label: '×¤××¡×××',      icon: FileText },
  { href: '/groups',    label: '×¢×¨××¦××',       icon: Users },
  { href: '/reports',   label: '×××××ª',        icon: BarChart3 },
  { href: '/settings',  label: '××××¨××ª',      icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed right-0 top-0 h-full w-60 bg-[#0a0c17] border-l border-white/[0.04] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.04]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white tracking-tight">AliBot Pro</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
            >
              <Icon size={16} className={active ? 'text-blue-400' : ''} />
              <span>{label}</span>
              {active && (
                <span className="mr-auto w-0.5 h-3.5 rounded-full bg-blue-400/80" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/50 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="××ª× ×ª×§"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
