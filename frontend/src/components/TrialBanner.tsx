'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { subscriptionApi } from '@/lib/api-client';
import type { SubscriptionStatus } from '@/types';

/**
 * The trial countdown, and the one screen after it lapses.
 *
 * A trial that nobody notices is a discount, not a demo: the account quietly has agents and
 * five platforms for two weeks, nothing says so, and on day fifteen features "break". So
 * the banner does two jobs — it names what is currently unlocked WHILE it is unlocked, and
 * the day it ends it says plainly what was switched off and what it costs to keep.
 *
 * Only ever shown to an account that is actually on a lower plan than its trial: a paying
 * Autopilot customer inside their first two weeks is borrowing nothing and is told nothing.
 */

/** Remembered per browser so a dismissed banner stays dismissed for that day only — the
 *  count changes daily, and a countdown nobody can see again is not a countdown. */
const DISMISS_KEY = 'nexlify.trialBannerDismissed';

export function TrialBanner() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState('');

  useEffect(() => {
    subscriptionApi.status().then(setStatus).catch(() => {});
    try { setDismissed(localStorage.getItem(DISMISS_KEY) || ''); } catch { /* private mode */ }
  }, []);

  if (!status) return null;

  const daysLeft = status.trial_days_left ?? 0;
  const borrowing = !!status.effective_plan && status.effective_plan !== status.plan;
  // The trial ENDED recently: it exists, it is spent, and the account never upgraded.
  const justEnded = !!status.trial_ends_at && daysLeft === 0 && status.plan === 'free'
    && Date.now() - new Date(status.trial_ends_at).getTime() < 14 * 24 * 3600_000;

  if (!borrowing && !justEnded) return null;

  const key = borrowing ? `active:${daysLeft}` : 'ended';
  if (dismissed === key) return null;

  const dismiss = () => {
    setDismissed(key);
    try { localStorage.setItem(DISMISS_KEY, key); } catch { /* private mode */ }
  };

  if (justEnded) {
    return (
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-start gap-3" dir="rtl">
        <Sparkles size={16} className="text-white/40 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">תקופת ההתנסות הסתיימה</p>
          <p className="text-xs text-white/45 mt-1 leading-relaxed">
            סוכני ה-AI, המנוע הלומד, העונתיות האוטומטית והפרסום לפייסבוק, אינסטגרם, פינטרסט
            ווואטסאפ כבויים כרגע. הטייסים ממשיכים לרוץ בטלגרם עם אלי אקספרס כרגיל.{' '}
            <Link href="/settings?tab=subscription" className="text-amber-300 underline underline-offset-2">
              להחזיר אותם
            </Link>
          </p>
        </div>
        <button onClick={dismiss} aria-label="סגור" className="text-white/25 hover:text-white/60 shrink-0">
          <X size={15} />
        </button>
      </div>
    );
  }

  const urgent = daysLeft <= 3;
  return (
    <div
      className={`mb-5 rounded-2xl border p-4 flex items-start gap-3 ${urgent
        ? 'border-amber-400/40 bg-amber-500/10'
        : 'border-violet-400/30 bg-violet-500/10'}`}
      dir="rtl"
    >
      <Sparkles size={16} className={`shrink-0 mt-0.5 ${urgent ? 'text-amber-300' : 'text-violet-300'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          {daysLeft === 1 ? 'היום האחרון להתנסות' : `נותרו ${daysLeft} ימים להתנסות`}
        </p>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          כרגע פתוח לך <b className="text-white/75">הכל</b> — סוכני AI, המנוע הלומד, עונתיות
          אוטומטית, קמפייני ספקים ואמזון, ופרסום לפייסבוק, אינסטגרם, פינטרסט ווואטסאפ.
          נצל את הימים האלה כדי לראות מה המערכת עושה כשהיא רצה לבד.{' '}
          <Link
            href="/settings?tab=subscription"
            className={`underline underline-offset-2 ${urgent ? 'text-amber-300' : 'text-violet-300'}`}
          >
            לשמור על זה
          </Link>
        </p>
      </div>
      <button onClick={dismiss} aria-label="סגור" className="text-white/25 hover:text-white/60 shrink-0">
        <X size={15} />
      </button>
    </div>
  );
}
