'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface NotifToggle {
  id: string;
  group: string;
  label: string;
  desc: string;
  enabled: boolean;
}

const DEFAULTS: NotifToggle[] = [
  { id: 'daily_summary',     group: 'דוחות',         label: 'סיכום ביצועים יומי',        desc: 'קבל מייל יומי עם ההזמנות, הכנסות ועמלות שלך',                  enabled: true },
  { id: 'product_discovery', group: 'AI ואוטומציה',  label: 'גילוי מוצרים הושלם',        desc: 'קבל התראה כשה-AI מייבא מוצרים חדשים לקטלוג',                   enabled: true },
  { id: 'campaign_errors',   group: 'AI ואוטומציה',  label: 'שגיאות קמפיין',             desc: 'התראה כשקמפיין נתקל בבעיה בשליחה',                             enabled: false },
  { id: 'post_sent',         group: 'פוסטים',        label: 'פוסט פורסם',                desc: 'אישור כשפוסט מתפרסם בהצלחה בערוץ',                             enabled: false },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative rounded-full transition-colors duration-200 shrink-0 ${enabled ? 'bg-blue-600' : 'bg-white/15'}`}
      style={{ height: '22px', width: '40px' }}
    >
      <span
        className="absolute rounded-full bg-white shadow transition-all duration-200"
        style={{ width: '18px', height: '18px', top: '2px', right: enabled ? '2px' : '20px' }}
      />
    </button>
  );
}

export function NotificationsForm() {
  const [toggles, setToggles] = useState<NotifToggle[]>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const toggle = (id: string) =>
    setToggles((ts) => ts.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const groups = [...new Set(toggles.map((t) => t.group))];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group} className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">{group}</h3>
          <div className="space-y-4">
            {toggles.filter((t) => t.group === group).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{t.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{t.desc}</p>
                </div>
                <Toggle enabled={t.enabled} onChange={() => toggle(t.id)} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-white/25">
        אימות, איפוס סיסמה ומיילי onboarding נשלחים תמיד ולא ניתן להשבית אותם.
      </p>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור הגדרות'}
      </button>
    </div>
  );
}
