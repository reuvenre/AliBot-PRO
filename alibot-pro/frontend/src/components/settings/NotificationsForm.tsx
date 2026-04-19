'use client';

import { useState } from 'react';
import { Bell, Save, Loader2 } from 'lucide-react';

interface Toggle {
  id: string;
  label: string;
  desc: string;
  defaultOn: boolean;
}

const TOGGLES: Toggle[] = [
  { id: 'daily_summary',    label: 'סיכום יומי',              desc: 'קבל סיכום ביצועים יומי עם נתוני הכנסות ופוסטים',    defaultOn: true },
  { id: 'campaign_errors',  label: 'שגיאות קמפיין',           desc: 'התראה כאשר קמפיין נכשל בהרצה',                       defaultOn: true },
  { id: 'post_sent',        label: 'אישור שליחת פוסט',        desc: 'קבל התראה לאחר כל פרסום מוצלח',                      defaultOn: false },
  { id: 'new_products',     label: 'מוצרים חדשים בטרנד',      desc: 'עדכונים שבועיים על מוצרים פופולריים',                defaultOn: false },
  { id: 'earnings_update',  label: 'עדכון הכנסות',            desc: 'קבל התראה כשעמלה חדשה מוסדרת',                       defaultOn: true },
];

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0
        ${on ? 'bg-blue-600' : 'bg-white/10'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200
        ${on ? 'right-0.5' : 'left-0.5'}`}
      />
    </button>
  );
}

export function NotificationsForm() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((t) => [t.id, t.defaultOn])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
          <Bell size={15} className="text-blue-400" />
          העדפות התראות
        </h3>

        <div className="space-y-4">
          {TOGGLES.map((t, i) => (
            <div key={t.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-white/80 font-medium">{t.label}</p>
                  <p className="text-xs text-white/35 mt-0.5">{t.desc}</p>
                </div>
                <ToggleSwitch
                  on={prefs[t.id]}
                  onChange={(v) => setPrefs((p) => ({ ...p, [t.id]: v }))}
                />
              </div>
              {i < TOGGLES.length - 1 && <div className="h-px bg-white/5 mt-4" />}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור העדפות'}
        </button>
      </section>
    </div>
  );
}
