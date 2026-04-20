'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, FileText, Shuffle, MapPin, Clock, Image as ImageIcon,
  Globe, RefreshCw, Plane, ChevronRight, Save, Loader2, Info,
} from 'lucide-react';

type Tab = 'ai' | 'templates' | 'variations' | 'tracking' | 'schedule' | 'media' | 'language' | 'republish' | 'autopilot';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ai',         label: 'הגדרות AI',   icon: Bot },
  { id: 'templates',  label: 'תבניות',       icon: FileText },
  { id: 'variations', label: 'וריאציות',     icon: Shuffle },
  { id: 'tracking',   label: 'מעקב',         icon: MapPin },
  { id: 'schedule',   label: 'תזמון',        icon: Clock },
  { id: 'media',      label: 'מדיה',         icon: ImageIcon },
  { id: 'language',   label: 'שפה ותסביע',   icon: Globe },
  { id: 'republish',  label: 'פרסום מחדש',   icon: RefreshCw },
  { id: 'autopilot',  label: 'Auto Pilot',   icon: Plane },
];

/* ── Shared settings state type ──────────────────────────────────────────── */

interface Settings {
  ai: { style: 'regular' | 'emoji'; instructions: string };
  templates: { selected: string };
  variations: { enabled: boolean; count: number };
  tracking: { trackingId: string };
  schedule: { smartEnabled: boolean; startTime: string; endTime: string; intervalMinutes: number };
  media: { sendImage: boolean; imageFirst: boolean };
  language: { bizName: string; suffix: string };
  republish: { enabled: boolean; days: number };
  autopilot: { enabled: boolean; postsPerDay: number };
}

const DEFAULT_SETTINGS: Settings = {
  ai:         { style: 'regular', instructions: '' },
  templates:  { selected: 'full' },
  variations: { enabled: false, count: 3 },
  tracking:   { trackingId: '' },
  schedule:   { smartEnabled: true, startTime: '09:00', endTime: '21:00', intervalMinutes: 120 },
  media:      { sendImage: true, imageFirst: true },
  language:   { bizName: '', suffix: '' },
  republish:  { enabled: false, days: 7 },
  autopilot:  { enabled: false, postsPerDay: 5 },
};

const STORAGE_KEY = 'alibot-posts-settings';

/* ── Shared UI components ───────────────────────────────────────────────── */

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative rounded-full transition-colors duration-200 shrink-0 ${enabled ? 'bg-blue-600' : 'bg-white/15'}`}
      style={{ height: '22px', width: '40px' }}>
      <span className="absolute rounded-full bg-white shadow transition-all duration-200"
        style={{ width: '18px', height: '18px', top: '2px', right: enabled ? '2px' : '20px' }} />
    </button>
  );
}

function SaveBtn({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <button type="button" onClick={onSave} disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all">
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור'}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{children}</p>
  );
}

function Divider() {
  return <div className="border-t border-white/5 my-5" />;
}

/* ── Tab panels ─────────────────────────────────────────────────────────── */

function AITab({ s, set, onSave, saving, saved }: {
  s: Settings['ai']; set: (v: Settings['ai']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader>סגנון AI</SectionHeader>
        <div className="flex gap-2">
          {[{ v: 'regular' as const, label: 'רגיל' }, { v: 'emoji' as const, label: "😊 עם אמוג'י" }].map(({ v, label }) => (
            <button key={v} onClick={() => set({ ...s, style: v })}
              className={`px-4 py-2 rounded-xl text-sm border transition-all
                ${s.style === v ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50 hover:border-white/25'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-1.5">הסגנון הכללי שיוחל לתוכן שנוצר על ידי AI</p>
      </div>
      <div>
        <SectionHeader>הוראה מותאמת אישית ל-AI</SectionHeader>
        <p className="text-xs text-white/35 mb-2">הוסף הוראות מותאמות לייצור תוכן AI (אופציונלי)</p>
        <textarea value={s.instructions} onChange={(e) => set({ ...s, instructions: e.target.value })} rows={4}
          placeholder="לדוגמה: כתוב תמיד בעברית, הוסף מחיר בשקלים, השתמש בטון נלהב..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 resize-none" />
        <p className="text-[10px] text-white/25 mt-1">{s.instructions.length}/500</p>
      </div>
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function TemplatesTab({ s, set, onSave, saving, saved }: {
  s: Settings['templates']; set: (v: Settings['templates']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  const TEMPLATES = [
    { id: 'full',    label: 'חבילה מלאה',   desc: 'כותרת, תיאור, מחיר, קישור, hashtags', badge: 'System' },
    { id: 'short',   label: 'תבנית מקוצרת', desc: 'כותרת קצרה + מחיר + קישור', badge: 'System' },
    { id: 'compact', label: 'Compact',       desc: 'שורה אחת עם מחיר וקישור', badge: 'System' },
  ];
  return (
    <div className="space-y-3">
      {TEMPLATES.map((t) => (
        <button key={t.id} onClick={() => set({ selected: t.id })}
          className={`w-full text-right px-4 py-3.5 rounded-xl border transition-all
            ${s.selected === t.id ? 'bg-blue-500/10 border-blue-500/35' : 'bg-white/3 border-white/8 hover:border-white/18'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">{t.label}</p>
            <span className="text-[10px] bg-white/8 text-white/40 rounded-full px-2 py-0.5">{t.badge}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{t.desc}</p>
        </button>
      ))}
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function VariationsTab({ s, set, onSave, saving, saved }: {
  s: Settings['variations']; set: (v: Settings['variations']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
        <div>
          <p className="text-sm font-medium text-white">וריאציות מופעלות</p>
          <p className="text-xs text-white/40 mt-0.5">הפק מספר גרסאות שונות לכל פוסט</p>
        </div>
        <Toggle enabled={s.enabled} onChange={() => set({ ...s, enabled: !s.enabled })} />
      </div>
      {s.enabled && (
        <div>
          <SectionHeader>מספר וריאציות</SectionHeader>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => set({ ...s, count: n })}
                className={`w-10 h-10 rounded-xl text-sm border transition-all
                  ${s.count === n ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function TrackingTab({ s, set, onSave, saving, saved }: {
  s: Settings['tracking']; set: (v: Settings['tracking']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader>מזהה מעקב לפוסטים</SectionHeader>
        <p className="text-xs text-white/35 mb-2">הוסף מזהה ייחודי לקישורי השותפים בפוסטים אלו</p>
        <input value={s.trackingId} onChange={(e) => set({ trackingId: e.target.value })}
          placeholder="campaign_tracking_123" dir="ltr"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
      </div>
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function ScheduleTab({ s, set, onSave, saving, saved }: {
  s: Settings['schedule']; set: (v: Settings['schedule']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-0">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs text-white/35 mt-1">הגדר תזמון מבוסס עדיפות עם משבצות זמן וחלונות יומיים</p>
        </div>
      </div>

      {/* Enable smart scheduling */}
      <div className="flex items-center justify-between py-4 border-b border-white/5">
        <div>
          <p className="text-sm font-semibold text-white">אפשר תזמון חכם</p>
          <p className="text-xs text-white/40 mt-0.5">תזמן אוטומטית פוסטים על בסיס עדיפות ומשבצות זמן</p>
        </div>
        <Toggle enabled={s.smartEnabled} onChange={() => set({ ...s, smartEnabled: !s.smartEnabled })} />
      </div>

      <Divider />

      {/* Daily publish window */}
      <div className="mb-5">
        <SectionHeader>חלון פרסום יומי</SectionHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-2">זמן התחלה</label>
            <div className="relative">
              <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="time"
                value={s.startTime}
                onChange={(e) => set({ ...s, startTime: e.target.value })}
                dir="ltr"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-2">זמן סיום</label>
            <div className="relative">
              <Clock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="time"
                value={s.endTime}
                onChange={(e) => set({ ...s, endTime: e.target.value })}
                dir="ltr"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>
        </div>
        <p className="text-[11px] text-white/30 mt-2 text-left" dir="rtl">
          פוסטים יתפרסמו רק בתוך חלון הזמן היומי הזה
        </p>
      </div>

      <Divider />

      {/* Interval */}
      <div className="mb-5">
        <SectionHeader>מרווח בין פוסטים (דקות)</SectionHeader>
        <input
          type="number"
          min={15}
          max={1440}
          value={s.intervalMinutes}
          onChange={(e) => set({ ...s, intervalMinutes: Math.max(15, Number(e.target.value)) })}
          dir="ltr"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
        />
        <p className="text-[11px] text-white/30 mt-2">
          פרסם פוסטים כל {s.intervalMinutes} דקות בתוך החלון היומי (מינימום: 15 דקות)
        </p>
      </div>

      <Divider />

      {/* How it works */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Info size={13} className="text-blue-400 shrink-0" />
          <p className="text-sm font-semibold text-white">איך תזמון חכם עובד</p>
        </div>
        <ul className="space-y-1.5 text-right" dir="rtl">
          {[
            'פוסטים מאושרים מוקצים אוטומטית למשבצות זמן על פי העדיפות שלהם',
            'פוסטים בעדיפות 1 (דחוף) מתפרסמים ראשונים, ואחריהם עדיפות 2, 3, 4 ו-5',
            'פוסטים עם אותה עדיפות מתפרסמים בסדר FIFO (נוצר ראשון, מתפרסם ראשון)',
            'המתזמן פועל כל 15 דקות כדי להקצות פוסטים ולפרסם כשהזמן מגיע',
            'כאשר מושבת, פוסטים ישתמשו במערכת הפרסום הישנה',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-xs text-white/50">
              <span className="text-blue-400 mt-0.5 shrink-0">•</span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function MediaTab({ s, set, onSave, saving, saved }: {
  s: Settings['media']; set: (v: Settings['media']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-4">
      {[
        { key: 'sendImage' as const,  label: 'שלח תמונה',          desc: 'הוסף תמונת מוצר לכל פוסט' },
        { key: 'imageFirst' as const, label: 'תמונה לפני טקסט',    desc: 'שלח תמונה לפני הטקסט בהודעה' },
      ].map(({ key, label, desc }) => (
        <div key={key} className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </div>
          <Toggle enabled={s[key]} onChange={() => set({ ...s, [key]: !s[key] })} />
        </div>
      ))}
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function LanguageTab({ s, set, onSave, saving, saved }: {
  s: Settings['language']; set: (v: Settings['language']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader>שם עסק</SectionHeader>
        <input value={s.bizName} onChange={(e) => set({ ...s, bizName: e.target.value })}
          placeholder="החנות שלי"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
      </div>
      <div>
        <SectionHeader>תסביע (Suffix)</SectionHeader>
        <input value={s.suffix} onChange={(e) => set({ ...s, suffix: e.target.value })}
          placeholder="@המותג שלי · linktr.ee/brand"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
        <p className="text-[10px] text-white/25 mt-1">יתווסף בסוף כל פוסט</p>
      </div>
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function RepublishTab({ s, set, onSave, saving, saved }: {
  s: Settings['republish']; set: (v: Settings['republish']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
        <div>
          <p className="text-sm font-medium text-white">פרסום מחדש אוטומטי</p>
          <p className="text-xs text-white/40 mt-0.5">פרסם מחדש פוסטים ישנים לאחר מספר ימים</p>
        </div>
        <Toggle enabled={s.enabled} onChange={() => set({ ...s, enabled: !s.enabled })} />
      </div>
      {s.enabled && (
        <div>
          <SectionHeader>כל כמה ימים לפרסם מחדש</SectionHeader>
          <div className="flex gap-2 flex-wrap">
            {[3, 5, 7, 14, 30].map((d) => (
              <button key={d} onClick={() => set({ ...s, days: d })}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all
                  ${s.days === d ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
                {d} ימים
              </button>
            ))}
          </div>
        </div>
      )}
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

function AutoPilotTab({ s, set, onSave, saving, saved }: {
  s: Settings['autopilot']; set: (v: Settings['autopilot']) => void;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-blue-500/8 border border-blue-500/20 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Plane size={14} className="text-blue-400" /> Auto Pilot
          </p>
          <p className="text-xs text-white/40 mt-0.5">המערכת מוצאת מוצרים ומפרסמת אוטומטית ללא התערבות</p>
        </div>
        <Toggle enabled={s.enabled} onChange={() => set({ ...s, enabled: !s.enabled })} />
      </div>
      {s.enabled && (
        <>
          <div>
            <SectionHeader>פוסטים ביום</SectionHeader>
            <div className="flex gap-2">
              {[2, 5, 10, 20].map((n) => (
                <button key={n} onClick={() => set({ ...s, postsPerDay: n })}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all
                    ${s.postsPerDay === n ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-400">⚠️ Auto Pilot ישתמש בקרדיטים AI אוטומטית. ודא שיש מספיק קרדיטים.</p>
          </div>
        </>
      )}
      <SaveBtn saving={saving} saved={saved} onSave={onSave} />
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PostsSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('schedule');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      await new Promise((r) => setTimeout(r, 400)); // short visual delay
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const active = TABS.find((t) => t.id === tab)!;

  const tabProps = { saving, saved, onSave: handleSave } as const;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <button onClick={() => router.push('/posts')} className="hover:text-white/70 transition-colors">
          פוסטים
        </button>
        <ChevronRight size={14} className="text-white/20" />
        <span className="text-white/70">הגדרות פוסטים</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">הגדרות פוסטים</h1>
        <p className="text-sm text-white/40 mt-1">הגדר כיצד AI מייצר ומפרסם פוסטים עבור קמפיין זה</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 space-y-0.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-right
                ${tab === id
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}>
              <Icon size={14} className={tab === id ? 'text-blue-400' : 'text-white/30'} />
              {label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 bg-[#0d0f1a] border border-white/5 rounded-xl p-6">
          {/* Tab header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <active.icon size={15} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-white">{active.label}</h2>
            </div>
          </div>

          {tab === 'ai'         && <AITab         s={settings.ai}         set={(v) => setSettings((p) => ({ ...p, ai: v }))}         {...tabProps} />}
          {tab === 'templates'  && <TemplatesTab  s={settings.templates}  set={(v) => setSettings((p) => ({ ...p, templates: v }))}  {...tabProps} />}
          {tab === 'variations' && <VariationsTab s={settings.variations} set={(v) => setSettings((p) => ({ ...p, variations: v }))} {...tabProps} />}
          {tab === 'tracking'   && <TrackingTab   s={settings.tracking}   set={(v) => setSettings((p) => ({ ...p, tracking: v }))}   {...tabProps} />}
          {tab === 'schedule'   && <ScheduleTab   s={settings.schedule}   set={(v) => setSettings((p) => ({ ...p, schedule: v }))}   {...tabProps} />}
          {tab === 'media'      && <MediaTab      s={settings.media}      set={(v) => setSettings((p) => ({ ...p, media: v }))}      {...tabProps} />}
          {tab === 'language'   && <LanguageTab   s={settings.language}   set={(v) => setSettings((p) => ({ ...p, language: v }))}   {...tabProps} />}
          {tab === 'republish'  && <RepublishTab  s={settings.republish}  set={(v) => setSettings((p) => ({ ...p, republish: v }))}  {...tabProps} />}
          {tab === 'autopilot'  && <AutoPilotTab  s={settings.autopilot}  set={(v) => setSettings((p) => ({ ...p, autopilot: v }))}  {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
