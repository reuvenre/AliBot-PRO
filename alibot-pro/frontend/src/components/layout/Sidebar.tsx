'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTheme } from '@/lib/hooks/useTheme';
import {
  LayoutDashboard,
  Megaphone,
  Zap,
  FileText,
  Layout,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  Tag,
  ShoppingCart,
  Sun,
  Moon,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',  label: 'דשבורד',      icon: LayoutDashboard },
  { href: '/campaigns',  label: 'קמפיינים',     icon: Megaphone },
  { href: '/quick-post', label: 'פוסט מהיר',    icon: Zap },
  { href: '/posts',      label: 'פוסטים',       icon: FileText },
  { href: '/templates',  label: 'תבניות',       icon: Layout },
  { href: '/categories', label: 'קטגוריות',     icon: Tag },
  { href: '/groups',     label: 'ערוצים',        icon: Users },
  { href: '/orders',     label: 'הזמנות',        icon: ShoppingCart },
  { href: '/reports',    label: 'דוחות',         icon: BarChart3 },
  { href: '/settings',   label: 'הגדרות',       icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="fixed right-0 top-0 h-full w-60 bg-[#0d0f1a] border-l border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
          <Bot size={18} className="text-white" style={{ color: 'white' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">AliBot Pro</p>
          <p className="text-[10px] text-white/30">v2.0</p>
        </div>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 transition-all shrink-0"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
              <Icon size={16} className={active ? 'text-blue-400' : ''} style={active ? { color: 'rgb(96 165 250)' } : {}} />
              <span>{label}</span>
              {active && (
                <span className="mr-auto w-1 h-4 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-[11px] font-bold shrink-0" style={{ color: 'white' }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="התנתק"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
