'use client';

import { useState } from 'react';
import { FileText, Plus, Check, MoreHorizontal, X, Loader2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  icon: string;
  content: string;
  builtin: boolean;
}

const BUILTIN: Template[] = [
  { id: 'builtin_default',  name: 'תבנית ברירת מחדל', icon: '✨', content: 'תבנית מערכת המלאכת לפרסום מוצרים',                                                                    builtin: true },
  { id: 'builtin_price',    name: 'תבנית מפורטת',      icon: '💰', content: 'תבנית מפורטת עם כלל הפרטים על המוצר',                                                              builtin: true },
  { id: 'builtin_compact',  name: 'Compact',            icon: '⚡', content: 'תבנית קצרה עם דירוג, מכירות והנחה',                                                                builtin: true },
];

// Sample preview texts per template
const PREVIEWS: Record<string, string> = {
  builtin_default:  '✨ אוזניות Bluetooth איכותיות\n\n🔧 אוזניות איכותיות עם תמיכה בבלוטוס, סוללה ל-20 שעות עם סאונד ברור ועשיר\n\n⭐ דירוג: 4.9',
  builtin_price:    '🔥 50% הנחה!\n\n💰 מחיר: ₪149.90 🏷️\n\n⭐⭐⭐⭐⭐\n\n🔧 אוזניות איכותיות עם תמיכה בבלוטוס, סוללה ל-20 שעות עם סאונד ברור ועשיר',
  builtin_compact:  '✨ דירוג של 4.9 📦 340 מכירות\n\n❌ עכשיו ב-33% הנחה!\n\n🔧 אוזניות איכותיות עם תמיכה בבלוטוס, סוללה ל-20 שעות עם סאונד ברור ועשיר',
};

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Template) => void }) {
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !instructions.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    onCreate({ id: Date.now().toString(), name: name.trim(), icon: '📝', content: instructions.trim(), builtin: false });
    onClose();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0f1a] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">צור תבנית חדשה</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">שם התבנית</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="לדוגמה: תבנית מבצעי קיץ"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">הוראות לבינה מלאכותית</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4}
              placeholder="לדוגמה: כתוב פוסט שמדגיש את ההנחה ויוצר תחושת דחיפות..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving || !name.trim() || !instructions.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            צור תבנית
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-xl transition-all">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [tab, setTab] = useState<'body' | 'footer'>('body');
  const [templates, setTemplates] = useState<Template[]>(BUILTIN);
  const [selectedId, setSelectedId] = useState('builtin_default');
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div dir="rtl">
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(t) => setTemplates(prev => [...prev, t])}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-white/30 text-xs mb-1">
            <FileText size={12} />
            <span>תבניות פוסטים</span>
          </div>
          <h1 className="text-2xl font-bold text-white">תבניות פוסטים</h1>
          <p className="text-sm text-white/40 mt-1">צור ונהל תבניות פוסטים</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all">
          <Plus size={14} />
          צור תבנית
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#0d0f1a] border border-white/5 rounded-xl p-1 gap-1 mb-6 w-fit">
        {[{ v: 'body' as const, l: 'תבניות גוף' }, { v: 'footer' as const, l: 'כותרות תחתונות לקבוצות' }].map(({ v, l }) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'footer' ? (
        <div className="bg-[#0d0f1a] border border-dashed border-white/10 rounded-2xl p-16 text-center">
          <p className="text-sm text-white/30">כותרות תחתונות לקבוצות — בקרוב</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((t) => {
            const isSelected = selectedId === t.id;
            const previewText = PREVIEWS[t.id] || t.content;
            return (
              <div key={t.id}
                className={`bg-[#0d0f1a] rounded-2xl border overflow-hidden transition-all
                  ${isSelected ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-white/8 hover:border-white/20'}`}>
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-sm font-semibold text-white">{t.name}</span>
                    <span className="text-[10px] bg-white/8 text-white/40 border border-white/10 rounded-full px-2 py-0.5">
                      {t.builtin ? 'System' : 'Custom'}
                    </span>
                  </div>
                  <button className="p-1.5 text-white/25 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all">
                    <MoreHorizontal size={14} />
                  </button>
                </div>

                {/* Preview */}
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider mb-2">תצוגה מקדימה</p>
                  <div className="bg-white/3 border border-white/5 rounded-xl p-3 min-h-[100px]">
                    <p className="text-xs text-white/60 leading-relaxed whitespace-pre-line">{previewText}</p>
                  </div>
                </div>

                {/* Select button */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400'
                        : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'}`}>
                    {isSelected && <Check size={13} />}
                    {isSelected ? 'Selected' : 'Select Template'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
