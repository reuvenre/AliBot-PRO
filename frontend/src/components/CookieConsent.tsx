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

  // Themed with the design TOKENS, not fixed colours: the banner floats over the marketing
  // pages, which render in the LIGHT theme by default — a hardcoded #161b22 card sat on
  // them as a black slab, and its `text-white` label was flipped to near-black by the
  // light-theme override in globals.css, i.e. dark text on a dark card. Tokens follow
  // whichever theme is active. Note the buttons set their label colour INLINE for the same
  // reason: `text-white` is not white in light mode, and these sit on solid colour.
  return (
    <div
      dir="rtl"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border backdrop-blur p-4 sm:p-5"
      style={{
        background: 'color-mix(in srgb, var(--bg-secondary) 96%, transparent)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-elevated)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          אנחנו משתמשים ב-cookies לצורך <b style={{ color: 'var(--text)' }}>אנליטיקה</b> (Google Analytics) כדי לשפר את השירות.
          אפשר לאשר או לדחות. פרטים ב<Link href="/privacy" className="underline text-blue-600 hover:text-blue-500">מדיניות הפרטיות</Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium border transition-opacity hover:opacity-75"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderColor: 'var(--border)' }}
          >
            דחייה
          </button>
          <button
            onClick={() => choose(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 transition-colors"
            style={{ color: '#fff' }}
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
