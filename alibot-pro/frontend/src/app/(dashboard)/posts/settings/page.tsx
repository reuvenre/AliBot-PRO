'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, FileText, Shuffle, MapPin, Clock, Image as ImageIcon,
  Globe, RefreshCw, Plane, ChevronRight, Save, Loader2,
} from 'lucide-react';

type Tab = 'ai' | 'templates' | 'variations' | 'tracking' | 'schedule' | 'media' | 'language' | 'republish' | 'autopilot';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ai',         label: 'הגדרות AI',      icon: Bot },
  { id: 'templates',  label: 'תבניות',          icon: FileText },
  { id: 'variations', label: 'וריאציות',        icon: Shuffle },
  { id: 'tracking',   label: 'מעקב',            icon: MapPin },
  { id: 'schedule',   label: 'תזמון',           icon: Clock },
  { id: 'media',      label: 'מדיה',            icon: ImageIcon },
  { id: 'language',   label: 'שפה ותסביע',      icon: Globe },
  { id: 'republish',  label: 'פרסום מחדש',      icon: RefreshCw },
  { id: 'autopilot',  label: 'Auto Pilot',      icon: Plane },
];

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

function SaveBtn({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button disabled={saving}
      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all">
      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור'}
    </button>
  );
}

/* ── Tab panels ────────────────────────────────────────────────────────────── */

function AITab() {
  const [style, setStyle] = useState<'regular' | 'emoji'>('regular');
  const [instructions, setInstructions] = useState('');
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">סגנון AI</label>
        <div className="flex gap-2">
          {[{ v: 'regular' as const, label: 'רגיל' }, { v: 'emoji' as const, label: '😊 עם אמוג\'י' }].map(({ v, label }) => (
            <button key={v} onClick={() => setStyle(v)}
              className={`px-4 py-2 rounded-xl text-sm border transition-all
                ${style === v ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50 hover:border-white/25'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-1.5">הסגנון הכללי שיוחל לתוכן שנוצר על ידי AI</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">הוראה מותאמת אישית ל-AI</label>
        <p className="text-xs text-white/35 mb-2">הוסף הוראות מותאמות לייצור תוכן AI (אופציונלי)</p>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4}
          placeholder="לדוגמה: כתוב תמיד בעברית, הוסף מחיר בשקלים, השתמש בטון נלהב..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 resize-none" />
        <p className="text-[10px] text-white/25 mt-1">{instructions.length}/500</p>
      </div>
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function TemplatesTab() {
  const [selected, setSelected] = useState('full');
  const TEMPLATES = [
    { id: 'full',    label: 'חבילה מלאה',    desc: 'כותרת, תיאור, מחיר, קישור, hashtags', badge: 'System' },
    { id: 'short',   label: 'תבנית מקוצרת',  desc: 'כותרת קצרה + מחיר + קישור', badge: 'System' },
    { id: 'compact', label: 'Compact',        desc: 'שורה אחת עם מחיר וקישור', badge: 'System' },
  ];
  return (
    <div className="space-y-3">
      {TEMPLATES.map((t) => (
        <button key={t.id} onClick={() => setSelected(t.id)}
          className={`w-full text-right px-4 py-3.5 rounded-xl border transition-all
            ${selected === t.id ? 'bg-blue-500/10 border-blue-500/35' : 'bg-white/3 border-white/8 hover:border-white/18'}`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">{t.label}</p>
            <span className="text-[10px] bg-white/8 text-white/40 rounded-full px-2 py-0.5">{t.badge}</span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{t.desc}</p>
        </button>
      ))}
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function VariationsTab() {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState(3);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-[#0d0f1a] border border-white/8 rounded-xl">
        <div>
          <p className="text-sm font-medium text-white">וריאציות מופעלות</p>
          <p className="text-xs text-white/40 mt-0.5">הפק מספר גרסאות שונות לכל פוסט</p>
        </div>
        <Toggle enabled={enabled} onChange={() => setEnabled(!enabled)} />
      </div>
      {enabled && (
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">מספר וריאציות</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCount(n)}
                className={`w-10 h-10 rounded-xl text-sm border transition-all
                  ${count === n ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function TrackingTab() {
  const [trackingId, setTrackingId] = useState('');
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">מזהה מעקב לפוסטים</label>
        <p className="text-xs text-white/35 mb-2">הוסף מזהה ייחודי לקישורי השותפים בפוסטים אלו</p>
        <input value={trackingId} onChange={(e) => setTrackingId(e.target.value)}
          placeholder="campaign_tracking_123" dir="ltr"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
      </div>
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function ScheduleTab() {
  const [immediate, setImmediate] = useState(true);
  const [time, setTime] = useState('09:00');
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {[{ v: true, label: 'שליחה מיידית', desc: 'פוסטים נשלחים ברגע שנוצרים' },
          { v: false, label: 'תזמון לשעה קבועה', desc: 'פוסטים נשלחים בשעה שתבחר' }].map(({ v, label, desc }) => (
          <button key={String(v)} onClick={() => setImmediate(v)}
            className={`w-full text-right px-4 py-3 rounded-xl border transition-all
              ${immediate === v ? 'bg-blue-500/10 border-blue-500/35' : 'bg-white/3 border-white/8 hover:border-white/18'}`}>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>
      {!immediate && (
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">שעת שליחה</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr"
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50" />
        </div>
      )}
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function MediaTab() {
  const [sendImage, setSendImage] = useState(true);
  const [imageFirst, setImageFirst] = useState(true);
  return (
    <div className="space-y-4">
      {[
        { label: 'שלח תמונה', desc: 'הוסף תמונת מוצר לכל פוסט', val: sendImage, set: setSendImage },
        { label: 'תמונה לפני טקסט', desc: 'שלח תמונה לפני הטקסט בהודעה', val: imageFirst, set: setImageFirst },
      ].map(({ label, desc, val, set }) => (
        <div key={label} className="flex items-center justify-between p-4 bg-[#0d0f1a] border border-white/8 rounded-xl">
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </div>
          <Toggle enabled={val} onChange={() => set(!val)} />
        </div>
      ))}
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function LanguageTab() {
  const [bizName, setBizName] = useState('');
  const [suffix, setSuffix] = useState('');
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">שם עסק</label>
        <input value={bizName} onChange={(e) => setBizName(e.target.value)}
          placeholder="החנות שלי"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">תסביע (Suffix)</label>
        <input value={suffix} onChange={(e) => setSuffix(e.target.value)}
          placeholder="@המותג שלי · linktr.ee/brand"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
        <p className="text-[10px] text-white/25 mt-1">יתווסף בסוף כל פוסט</p>
      </div>
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function RepublishTab() {
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(7);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-[#0d0f1a] border border-white/8 rounded-xl">
        <div>
          <p className="text-sm font-medium text-white">פרסום מחדש אוטומטי</p>
          <p className="text-xs text-white/40 mt-0.5">פרסם מחדש פוסטים ישנים לאחר מספר ימים</p>
        </div>
        <Toggle enabled={enabled} onChange={() => setEnabled(!enabled)} />
      </div>
      {enabled && (
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">כל כמה ימים לפרסם מחדש</label>
          <div className="flex gap-2 flex-wrap">
            {[3, 5, 7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all
                  ${days === d ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
                {d} ימים
              </button>
            ))}
          </div>
        </div>
      )}
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

function AutoPilotTab() {
  const [enabled, setEnabled] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(5);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 bg-blue-500/8 border border-blue-500/20 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Plane size={14} className="text-blue-400" /> Auto Pilot
          </p>
          <p className="text-xs text-white/40 mt-0.5">המערכת מוצאת מוצרים ומפרסמת אוטומטית ללא התערבות</p>
        </div>
        <Toggle enabled={enabled} onChange={() => setEnabled(!enabled)} />
      </div>
      {enabled && (
        <>
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">פוסטים ביום</label>
            <div className="flex gap-2">
              {[2, 5, 10, 20].map((n) => (
                <button key={n} onClick={() => setPostsPerDay(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all
                    ${postsPerDay === n ? 'bg-blue-500/15 border-blue-500/40 text-blue-400' : 'bg-white/3 border-white/10 text-white/50'}`}>
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
      <SaveBtn saving={false} saved={false} />
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PostsSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('ai');
  const active = TABS.find((t) => t.id === tab)!;

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
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <active.icon size={15} className="text-blue-400" />
            {active.label}
          </h2>
          {tab === 'ai'         && <AITab />}
          {tab === 'templates'  && <TemplatesTab />}
          {tab === 'variations' && <VariationsTab />}
          {tab === 'tracking'   && <TrackingTab />}
          {tab === 'schedule'   && <ScheduleTab />}
          {tab === 'media'      && <MediaTab />}
          {tab === 'language'   && <LanguageTab />}
          {tab === 'republish'  && <RepublishTab />}
          {tab === 'autopilot'  && <AutoPilotTab />}
        </div>
      </div>
    </div>
  );
}
