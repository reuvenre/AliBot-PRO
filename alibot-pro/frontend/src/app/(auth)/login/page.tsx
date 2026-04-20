'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Bot, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (!e.response) {
        setError('שגיאת חיבור — ייתכן שהשרת לא פועל או שכתובת ה-API לא הוגדרה');
      } else {
        setError('אימייל או סיסמה שגויים');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ direction: 'rtl' }}>

      {/* ── Right: form panel (RTL → right side first) ── */}
      <div className="w-full lg:w-[47%] flex flex-col bg-[#f3f4f6] relative">

        {/* Card area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-[390px] bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">

            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">ברוכים הבאים ל-AliBot Pro!</h2>
              <p className="text-gray-500 text-sm mt-1">הזן את האימייל שלך כדי להתחבר לחשבונך</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">אימייל</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-white"
                  style={{ WebkitTextFillColor: '#111827', color: '#111827' }}
                  dir="ltr"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">סיסמה</label>
                  <Link href="/forgot-password" className="text-sm text-blue-600 underline hover:text-blue-500 transition-colors">
                    שכחת סיסמה?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all bg-white"
                  style={{ WebkitTextFillColor: '#111827', color: '#111827' }}
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#8b9ed4] hover:bg-[#7a8ec8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 size={15} className="animate-spin" />}
                {isLoading ? 'מתחבר...' : 'כניסה'}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium tracking-widest">או המשך עם</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google button */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/google`}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all text-sm text-gray-700 font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.7 37.3 46.5 31.3 46.5 24.5z"/>
                <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6L2.5 13.3A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8-6z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.3-7.7 2.3-6.3 0-11.6-4.2-13.5-10l-8 6.2C6.6 42.6 14.6 48 24 48z"/>
              </svg>
              המשך עם Google
            </a>

            {/* Sign up link */}
            <div className="mt-5 text-center">
              <p className="text-sm text-gray-500">
                אין לך חשבון?{' '}
                <Link href="/register" className="text-gray-800 font-semibold underline hover:text-gray-600 transition-colors">
                  הירשם
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Left: hero panel ── */}
      <div
        className="hidden lg:flex lg:flex-1 flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d1b4b 0%, #0a0e1f 45%, #160a30 100%)' }}
      >
        <div className="absolute top-1/4 right-1/4 w-[28rem] h-[28rem] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/3 left-1/4 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex justify-start p-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/90 flex items-center justify-center">
              <Bot size={14} className="text-gray-900" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">AliBot Pro</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative z-10 px-12 max-w-lg text-center">
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-5">
              תשדרג את העסק שלך
              <br />
              <span className="gradient-text-hero">
                #withAliBot
              </span>
            </h1>
            <p className="text-white/45 text-base leading-relaxed">
              ממוצרים ותוכן ועד פרסום ומעקב,<br />
              נהל את כל עסק השיווק השותפים שלך בפלטפורמה אחת.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex justify-center pb-10">
          <p className="text-white/30 text-sm tracking-wide">
            פרסום רב-פלטפורמות &nbsp;|&nbsp; חינם להתחלה
          </p>
        </div>
      </div>
    </div>
  );
}
