'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Cookie/analytics consent banner (GDPR / ePrivacy / Israeli Privacy Protection Law).
 * Google Analytics loads in Consent Mode v2 with analytics_storage DENIED by default
 * (see the consent-default script in layout.tsx); this banner is the only thing that can
 * grant it. Until the user accepts, GA sends cookieless pings only.
 */
const KEY = 'nx_cookie_consent'; // 'granted' | 'denied'

declare global {
  interface Window { gtag?: (...args: any[]) => void }
}

function updateConsent(granted: boolean) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const v = granted ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    analytics_storage: v,
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
  });
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (saved === 'granted') { updateConsent(true); return; }
    if (saved === 'denied') { return; }
    setShow(true);
  }, []);

  const choose = (granted: boolean) => {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch { /* ignore */ }
    updateConsent(granted);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div dir="rtl" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#161b22]/95 backdrop-blur shadow-2xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-white/80 flex-1 leading-relaxed">
          אנחנו משתמשים ב-cookies לצורך <b className="text-white">אנליטיקה</b> (Google Analytics) כדי לשפר את השירות.
          אפשר לאשר או לדחות. פרטים ב<Link href="/privacy" className="text-amber-400 hover:text-amber-300 underline">מדיניות הפרטיות</Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            דחייה
          </button>
          <button
            onClick={() => choose(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors"
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
