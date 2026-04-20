'use client';

import { useState } from 'react';
import {
  Sparkles, FileText, GitBranch, TrendingUp, Clock, Image, Globe, RefreshCw, Bot,
  ChevronDown, Save, X, Lock, Info, Check, Plus
} from 'lucide-react';

// ────────────────────────────── types ──────────────────────────────
type Tab =
  | 'ai' | 'templates' | 'variations' | 'tracking'
  | 'scheduling' | 'media' | 'locale' | 'reposting' | 'autopilot';

interface PostSettings {
  aiTone: string;
  aiInstructions: string;
  selectedTemplate: string;
  variationsEnabled: boolean;
  variationsCount: number;
  trackingEnabled: boolean;
  schedulingEnabled: boolean;
  scheduleStart: string;
  scheduleEnd: string;
  schedulingInterval: number;
  multipleImages: boolean;
  includeVideo: boolean;
  language: string;
  currency: string;
  repostingEnabled: boolean;
  repostingInterval: number;
}

// ────────────────────────────── mock templates ──────────────────────────────
const TEMPLATES = [
  {
    id: 'smart',
    name: 'תבנית ברירת מחדל',
    badge: 'System',
    desc: 'תבנית מערכת אוטומלית לפרסום מוצרים',
    preview: '🎧 אוזניות אייקוניות Bluetooth\n🎵 אוזניות אייקוניות עם תמיכה בבלוטוס, סוללה ל-20 שעות עם סאונד ברור ועשיר',
    selected: true,
  },
  {
    id: 'extended',
    name: 'תבנית מפורטת',
    badge: 'System',
    desc: 'תבנית מפורטת עם כלל הפרטים על המוצר',
    preview: '🎧 אוזניות אייקוניות Bluetooth\n🔥 50% הנחה!\n💰 מחיר: ₪149.90\n⭐⭐⭐⭐⭐\n🎵 אוזניות אייקוניות עם תמיכה בבלוטוס...',
    selected: false,
  },
  {
    id: 'compact',
    name: 'Compact',
    badge: 'System',
    desc: 'תבנית קצרה עם דגש על מכירות והנחה',
    preview: '⭐ דירוג של 4.9 📋 340 מכירות\n🎉 עכשיו ב-33%- הנחה!\n🎵 אוזניות אייקוניות עם תמיכה בבלוטוס...',
    selected: false,
  },
];

const TONES = ['😊 רגיל', '🔥 נלהב', '💼 מקצועי', '😂 הומוריסטי', '🌟 יוקרתי'];
const LANGUAGES = ['עברית ז׳', 'English', 'العربية', 'Español', 'Français'];
const CURRENCIES = ['₪ Israeli Shekel', '$ US Dollar', '€ Euro', '£ British Pound'];

// ────────────────────────────── helpers ──────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-white/20'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white"
      >
        <span>{value}</span>
        <ChevronDown className="w-4 h-4 text-white/40" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 w-full bg-[#1e2130] border border-white/10 rounded-lg shadow-xl z-20">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="w-full text-right px-4 py-2 text-sm text-white hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── tab panels ──────────────────────────────
function AiTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-semibold mb-1">סגנון AI</h3>
        <Select
          value={settings.aiTone}
          options={TONES}
          onChange={v => setSettings({ ...settings, aiTone: v })}
        />
        <p className="text-white/40 text-xs mt-1">הסגנון והטון הכללי לתוכן שנמצר על ידי AI</p>
      </div>
      <div>
        <h3 className="text-white font-semibold mb-1">הוראה מותאמת אישית ל-AI</h3>
        <textarea
          value={settings.aiInstructions}
          onChange={e => setSettings({ ...settings, aiInstructions: e.target.value })}
          placeholder="הוסף הוראות AI מותאמות אישית ליצירת תוכן AI (אופציונלי)..."
          rows={4}
          maxLength={500}
          dir="rtl"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50 resize-none"
        />
        <p className="text-white/40 text-xs mt-1 text-left">{settings.aiInstructions.length}/500</p>
        <p className="text-white/40 text-xs">עקוף את התנהגות ברירת המחדל של AI עם הוראות ספציפיות</p>
      </div>
    </div>
  );
}

function TemplatesTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  const [activeTab, setActiveTab] = useState<'body' | 'groups'>('body');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'body' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
        >
          תבניות גוף
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'groups' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
        >
          כותרות תחתונות לקבוצות
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map(tpl => (
          <div
            key={tpl.id}
            className={`border rounded-xl p-4 cursor-pointer transition-all ${settings.selectedTemplate === tpl.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
            onClick={() => setSettings({ ...settings, selectedTemplate: tpl.id })}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-white font-medium text-sm">{tpl.name}</span>
                <span className="mr-2 text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded">{tpl.badge}</span>
              </div>
            </div>
            <p className="text-white/50 text-xs mb-3">{tpl.desc}</p>
            <div className="bg-black/20 rounded-lg p-3 text-xs text-white/70 whitespace-pre-line leading-relaxed mb-3">
              {tpl.preview}
            </div>
            <button className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm transition-colors ${settings.selectedTemplate === tpl.id ? 'bg-blue-600 text-white' : 'border border-white/10 text-white/60 hover:bg-white/10'}`}>
              {settings.selectedTemplate === tpl.id ? <><Check className="w-4 h-4" /> נבחר</> : 'בחר תבנית'}
            </button>
          </div>
        ))}
        <div className="border border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/40 transition-colors min-h-[180px]">
          <Plus className="w-6 h-6 text-white/40" />
          <span className="text-white/40 text-sm">צור תבנית</span>
        </div>
      </div>
    </div>
  );
}

function VariationsTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">צור וריאציות אוטומטית</h3>
          <p className="text-white/40 text-xs mt-0.5">צור אוטומטית וריאציות הודעות כאשר פוסטים מפורסמים נוצרים</p>
        </div>
        <Toggle value={settings.variationsEnabled} onChange={v => setSettings({ ...settings, variationsEnabled: v })} />
      </div>
      {settings.variationsEnabled && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">מספר וריאציות</h3>
            <span className="text-blue-400 font-bold">{settings.variationsCount}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.variationsCount}
            onChange={e => setSettings({ ...settings, variationsCount: +e.target.value })}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>1</span><span>5</span><span>10</span>
          </div>
        </div>
      )}
      {!settings.variationsEnabled && (
        <p className="text-orange-400 text-xs">אפשר יצירה אוטומטית כדי להתאים את מספר הווריאציות</p>
      )}
    </div>
  );
}

function TrackingTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">אפשר מעקב פוסטים</h3>
          <p className="text-white/40 text-xs mt-0.5">עקוב אחר קליקים על קישורים אפיליאטים והמרות לניתוח ביצועים</p>
        </div>
        <Toggle value={settings.trackingEnabled} onChange={v => setSettings({ ...settings, trackingEnabled: v })} />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        <h3 className="text-white font-semibold text-sm">איך מעקב עובד</h3>
        <ul className="space-y-1.5 text-xs text-white/50 list-disc list-inside">
          <li>כאשר מופעל, מוזה מעקב יחודי לקישורי אפיליאט (למשל, cn=a1b2?)</li>
          <li>עקוב אחר איל פוסטים מייצרים מכירות ותשב עמלה לכל פוסט</li>
          <li>צפה בניתוחים מפורטים במקטע פוסטים תחת דחות</li>
          <li>כאשר מושבת, קישורי אפיליאט נוצרים ללא פרמטרי מעקב</li>
        </ul>
      </div>
    </div>
  );
}

function SchedulingTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">אפשר תזמון חכם</h3>
          <p className="text-white/40 text-xs mt-0.5">תזמן אוטומטית פוסטים על בסיס עדיפות ומשבצות זמן</p>
        </div>
        <Toggle value={settings.schedulingEnabled} onChange={v => setSettings({ ...settings, schedulingEnabled: v })} />
      </div>
      {settings.schedulingEnabled && (
        <>
          <div>
            <h3 className="text-white font-semibold mb-3">חלון פרסום יומי</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs mb-1 block">זמן התחלה</label>
                <input
                  type="time"
                  value={settings.scheduleStart}
                  onChange={e => setSettings({ ...settings, scheduleStart: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs mb-1 block">זמן סיום</label>
                <input
                  type="time"
                  value={settings.scheduleEnd}
                  onChange={e => setSettings({ ...settings, scheduleEnd: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <p className="text-white/40 text-xs mt-1">פוסטים יתפרסמו רק בתוך חלון הזמן היומי הזה</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">מרווח בין פוסטים (דקות)</h3>
            <input
              type="number"
              min={15}
              max={1440}
              value={settings.schedulingInterval}
              onChange={e => setSettings({ ...settings, schedulingInterval: +e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <p className="text-white/40 text-xs mt-1">פרסם פוסטים כל N דקות בתוך החלון היומי (מינימום: 15 דקות)</p>
          </div>
        </>
      )}
      {settings.schedulingEnabled && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1.5">
          <h3 className="text-white font-semibold text-sm">איך תזמון חכם עובד</h3>
          <ul className="space-y-1 text-xs text-white/50 list-disc list-inside">
            <li>פוסטים מאושרים מוקמים אוטומטית למשבצות זמן על פי העדיפויות שלהם</li>
            <li>פוסטים בעדיפות 1 (דחוף) מתפרסמים ראשונים, ואחרהם עדיפות 2, 3, 4 ו-5</li>
            <li>פוסטים עם אותה עדיפות מתפרסמים בסדר FIFO (נוצר ראשון, מתפרסם ראשון)</li>
            <li>המתזמן מוצל כל 15 דקות כדי לתזמן פוסטים ולפרסם שלהם מגיע</li>
            <li>כאשר מושבת, פוסטים ישתמשו במערכת הפרסום השעתית הישנה</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function MediaTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">שלח תמונות מרובות</h3>
          <p className="text-white/40 text-xs mt-0.5">כאשר מופעל, כל תמונות המוצר ישלחו לפלטפורמות שתמכות בכך. כאשר מושבת, רק תמונת המוצר הראשית תכלל.</p>
          <p className="text-white/40 text-xs mt-1 font-medium">תמיכה בפלטפורמות:</p>
          <ul className="text-white/40 text-xs list-disc list-inside">
            <li>טלגרם: תומר בתמונות מרובות (קבצות מדיה)</li>
            <li>WhatsApp: שולח רק את התמונה הראשית (מגבלת API)</li>
          </ul>
        </div>
        <Toggle value={settings.multipleImages} onChange={v => setSettings({ ...settings, multipleImages: v })} />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">כלול וידאו</h3>
          <p className="text-white/40 text-xs mt-0.5">כאשר מופעל, וידאו יכללו אם זמינים. כאשר מושבת, וידאו לעולם לא ישלחו.</p>
          <p className="text-white/40 text-xs mt-0.5">הערה: לא לכל המוצרים יש וידאו. הגדרה זו חלה רק כאשר וידאו זמין.</p>
        </div>
        <Toggle value={settings.includeVideo} onChange={v => setSettings({ ...settings, includeVideo: v })} />
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-white font-semibold text-sm mb-2">תצורה נכחית</h3>
        <p className="text-white/50 text-xs">תמונות: שלח את כל התמונות הזמינות</p>
        <p className="text-white/50 text-xs">וידאו: כלול וידאו אם זמין</p>
      </div>
    </div>
  );
}

function LocaleTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white font-semibold mb-1">שפת תוכן</h3>
        <Select
          value={settings.language}
          options={LANGUAGES}
          onChange={v => setSettings({ ...settings, language: v })}
        />
        <p className="text-white/40 text-xs mt-1">השפה המשמשת לתוכן פוסטים שנוצר על ידי AI ותבניות</p>
      </div>
      <div>
        <h3 className="text-white font-semibold mb-1">מטבע</h3>
        <Select
          value={settings.currency}
          options={CURRENCIES}
          onChange={v => setSettings({ ...settings, currency: v })}
        />
        <p className="text-white/40 text-xs mt-1">המטבע המשמש להצגת מחירי מוצרים בפוסטים</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-white font-semibold text-sm mb-2">תצורה נכחית</h3>
        <p className="text-white/50 text-xs">שפה: {settings.language}</p>
        <p className="text-white/50 text-xs">מטבע: {settings.currency}</p>
      </div>
    </div>
  );
}

function RepostingTab({ settings, setSettings }: { settings: PostSettings; setSettings: (s: PostSettings) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">הפעל פרסום מחדש</h3>
          <p className="text-white/40 text-xs mt-0.5">פרסם מחדש באופן אוטומטי תוכן שפורסם במרווחי זמן מוגדרים כדי לשמור על מעורבות</p>
        </div>
        <Toggle value={settings.repostingEnabled} onChange={v => setSettings({ ...settings, repostingEnabled: v })} />
      </div>
      {settings.repostingEnabled && (
        <div>
          <h3 className="text-white font-semibold mb-2">מרווח פרסום מחדש (ימים)</h3>
          <input
            type="number"
            min={1}
            max={90}
            value={settings.repostingInterval}
            onChange={e => setSettings({ ...settings, repostingInterval: +e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <p className="text-white/40 text-xs mt-1">מספר ימים מינימלי מאז הפרסום האחרון לפני שניתן לפרסם מחדש (1-90 ימים)</p>
        </div>
      )}
    </div>
  );
}

function AutopilotTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Lock className="w-12 h-12 text-white/20" />
      <p className="text-white/50 text-sm text-center">זמין בתכונית Autopilot</p>
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
        שדרג עכשיו
      </button>
    </div>
  );
}

// ────────────────────────────── sidebar nav ──────────────────────────────
const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'ai',         label: 'הגדרות AI',      icon: <Sparkles className="w-4 h-4" /> },
  { id: 'templates',  label: 'תבניות',          icon: <FileText className="w-4 h-4" /> },
  { id: 'variations', label: 'וריאציות',        icon: <GitBranch className="w-4 h-4" /> },
  { id: 'tracking',   label: 'מעקב',            icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'scheduling', label: 'תזמון',           icon: <Clock className="w-4 h-4" /> },
  { id: 'media',      label: 'מדיה',            icon: <Image className="w-4 h-4" /> },
  { id: 'locale',     label: 'שפה ומטבע',       icon: <Globe className="w-4 h-4" /> },
  { id: 'reposting',  label: 'פרסום מחדש',      icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'autopilot',  label: 'Auto Pilot',      icon: <Bot className="w-4 h-4" /> },
];

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  ai:         { title: 'הגדרות AI ✨',      subtitle: 'הגדר כיצד AI מייצר ומייעל את תוכן הפוסט שלך' },
  templates:  { title: 'תבניות פוסטים 📄',  subtitle: 'צור ונהל תבניות פוסטים' },
  variations: { title: 'הגדרות וריאציות 🔀', subtitle: 'שלוט בייצרה אוטומטית של וריאציות לפוסטים' },
  tracking:   { title: 'הגדרות מעקב 📈',    subtitle: 'שלוט במעקב פוסטים לניתוח המרות וביצועים' },
  scheduling: { title: 'תזמון חכם ⏰',      subtitle: 'הגדר תזמון מבוסס על משבצות זמן וחלונות יומיים' },
  media:      { title: 'הגדרות מדיה 🖼️',    subtitle: 'שלוט בייצד תמונות ווידאו של מוצרים נכללים בפוסטים שפורסמו' },
  locale:     { title: 'הגדרות שפה ומטבע 🌐', subtitle: 'הגדר שפה ומטבע ליצירת פוסטים ותמחור מוצרים' },
  reposting:  { title: 'הגדרות פרסום מחדש 🔄', subtitle: 'פרסם מחדש באופן אוטומטי תוכן שפורסם במרווחי זמן מוגדרים כדי לשמור על מעורבות' },
  autopilot:  { title: 'טייס אוטומטי 🤖',   subtitle: 'כאשר מופעל, מוצרים שנמצאו ופוסטים שנמצאו מאושרים אוטומטית — ללא צורך בבדיקה ידנית.' },
};

// ────────────────────────────── main component ──────────────────────────────
export function PostSettingsPanel({
  categoryName = 'כל הקטגוריות',
  onClose,
  onSave,
}: {
  categoryName?: string;
  onClose?: () => void;
  onSave?: (settings: PostSettings) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('ai');
  const [settings, setSettings] = useState<PostSettings>({
    aiTone: '😊 רגיל',
    aiInstructions: '',
    selectedTemplate: 'smart',
    variationsEnabled: false,
    variationsCount: 3,
    trackingEnabled: false,
    schedulingEnabled: true,
    scheduleStart: '09:00',
    scheduleEnd: '21:00',
    schedulingInterval: 120,
    multipleImages: true,
    includeVideo: true,
    language: 'עברית ז׳',
    currency: '₪ Israeli Shekel',
    repostingEnabled: false,
    repostingInterval: 21,
  });

  const { title, subtitle } = TAB_META[activeTab];

  const handleSave = () => {
    onSave?.(settings);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="text-right">
          <h1 className="text-xl font-bold">הגדרות פוסטים {categoryName}</h1>
          <p className="text-white/40 text-sm">הגדר כיצד פוסטים מיוצרים ומתפרסמים עבור קטגוריה זו</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              {NAV.find(n => n.id === activeTab)?.icon}
              <h2 className="text-lg font-bold">{title}</h2>
            </div>
            <p className="text-white/40 text-sm mb-6">{subtitle}</p>

            {activeTab === 'ai'         && <AiTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'templates'  && <TemplatesTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'variations' && <VariationsTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'tracking'   && <TrackingTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'scheduling' && <SchedulingTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'media'      && <MediaTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'locale'     && <LocaleTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'reposting'  && <RepostingTab settings={settings} setSettings={setSettings} />}
            {activeTab === 'autopilot'  && <AutopilotTab />}

            {activeTab !== 'autopilot' && (
              <div className="flex justify-start gap-3 mt-8 pt-4 border-t border-white/10">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  שמור
                </button>
                {onClose && (
                  <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm text-white/60 hover:bg-white/10 transition-colors">
                    ביטול
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar nav */}
        <div className="w-52 border-r border-white/10 py-4 flex-shrink-0">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2 justify-end px-4 py-3 text-sm transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{item.label}</span>
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
