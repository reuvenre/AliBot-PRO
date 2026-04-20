'use client';

import { Check, Zap, Star, Crown } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    price: '₪0',
    period: 'לחודש',
    color: 'white/30',
    accent: 'white/10',
    current: false,
    features: ['5 פוסטים ביום', '1 ערוץ', '100 קרדיטים AI בחודש', 'תבניות בסיסיות'],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: Star,
    price: '₪79',
    period: 'לחודש',
    color: 'blue-400',
    accent: 'blue-500/20',
    current: true,
    features: ['פוסטים ללא הגבלה', 'ערוצים ללא הגבלה', '1,500 קרדיטים AI בחודש', 'כל התבניות', 'לוח זמנים מתקדם', 'Auto Pilot'],
  },
  {
    id: 'business',
    name: 'Business',
    icon: Crown,
    price: '₪199',
    period: 'לחודש',
    color: 'violet-400',
    accent: 'violet-500/20',
    current: false,
    features: ['הכל ב-Pro', '5,000 קרדיטים AI בחודש', 'WhatsApp + Facebook + Instagram', 'API גישה', 'תמיכה עדיפה', 'ניתוח מתקדם'],
  },
];

export function SubscriptionForm() {
  return (
    <div className="space-y-6">
      {/* Current plan banner */}
      <section className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-4 flex items-center gap-3">
        <Star size={16} className="text-blue-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">תוכנית Pro פעילה</p>
          <p className="text-xs text-white/50 mt-0.5">מתחדשת ב-20 במאי 2026 · ₪79 לחודש</p>
        </div>
        <span className="mr-auto text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2.5 py-0.5 font-semibold">פעיל</span>
      </section>

      {/* AI Credits usage */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">קרדיטים AI החודש</h3>
          <span className="text-xs text-white/40">1,243 / 1,500</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" style={{ width: '82.9%' }} />
        </div>
        <p className="text-[10px] text-white/30 mt-2">257 קרדיטים נותרו · מתאפסים ב-1 במאי</p>
      </section>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-4">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`bg-[#0d0f1a] border rounded-xl p-5 transition-all
                ${plan.current ? 'border-blue-500/40' : 'border-white/5 hover:border-white/10'}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${plan.accent}`}>
                    <Icon size={16} className={`text-${plan.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{plan.name}</p>
                    <p className="text-xs text-white/40">{plan.price} <span className="text-white/25">{plan.period}</span></p>
                  </div>
                </div>
                {plan.current && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full px-2.5 py-0.5 font-semibold">התוכנית הנוכחית</span>
                )}
              </div>
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/55">
                    <Check size={11} className="text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!plan.current && (
                <button className={`w-full py-2 text-sm font-medium rounded-xl transition-all
                  ${plan.id === 'business'
                    ? 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-white/60 border border-white/10'}`}>
                  {plan.id === 'free' ? 'שדרג למטה' : 'שדרג לתוכנית זו'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-white/25 text-center">
        לשאלות בנוגע לחיוב פנה אלינו ל-support@alibot.pro
      </p>
    </div>
  );
}
