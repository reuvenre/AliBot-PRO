'use client';

import { useState } from 'react';
import {
  Tag, Plus, Trash2, Edit3, ToggleLeft, ToggleRight,
  Search, FolderOpen,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  keywords: string[];
  active: boolean;
  createdAt: string;
  productsCount: number;
}

const DEMO: Category[] = [
  { id: '1', name: 'Electronics & Gadgets', keywords: ['smartphones', 'smart watch', 'wireless earbuds', 'laptop', 'tablet'], active: true,  createdAt: 'אפר׳ 18, 2026', productsCount: 12 },
  { id: '2', name: 'ביגוד ואופנה',          keywords: ['t-shirt', 'dress', 'jeans', 'shoes'],                                  active: true,  createdAt: 'אפר׳ 15, 2026', productsCount: 5  },
  { id: '3', name: 'בית וגינה',             keywords: ['furniture', 'garden tools', 'kitchen'],                                active: false, createdAt: 'אפר׳ 10, 2026', productsCount: 0  },
];

interface AddModalProps { onClose: () => void; onAdd: (cat: Category) => void }
function AddModal({ onClose, onAdd }: AddModalProps) {
  const [name, setName] = useState('');
  const [kw, setKw] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  const addKw = () => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords((k) => [...k, trimmed]);
      setKw('');
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({ id: Date.now().toString(), name: name.trim(), keywords, active: true, createdAt: 'עכשיו', productsCount: 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0f1a] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-white mb-5">הוסף קטגוריה חדשה</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">שם קטגוריה</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: Electronics & Gadgets"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">מילות מפתח</label>
            <div className="flex gap-2">
              <input value={kw} onChange={(e) => setKw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKw()}
                placeholder="הוסף מילת מפתח..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
              <button onClick={addKw}
                className="px-4 py-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm hover:bg-blue-600/30 transition-all">
                הוסף
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {keywords.map((k) => (
                <span key={k} className="flex items-center gap-1 px-2.5 py-1 bg-white/8 border border-white/10 rounded-full text-xs text-white/70">
                  {k}
                  <button onClick={() => setKeywords((ks) => ks.filter((x) => x !== k))}
                    className="text-white/30 hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleSubmit}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all">
            צור קטגוריה
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(DEMO);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const toggleActive = (id: string) =>
    setCategories((cs) => cs.map((c) => c.id === id ? { ...c, active: !c.active } : c));

  const deleteCategory = (id: string) => {
    if (!confirm('למחוק קטגוריה זו?')) return;
    setCategories((cs) => cs.filter((c) => c.id !== id));
  };

  const filtered = categories
    .filter((c) => filter === 'all' || (filter === 'active' ? c.active : !c.active))
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase())));

  const total = categories.length;
  const activeCount = categories.filter((c) => c.active).length;
  const totalKw = categories.reduce((s, c) => s + c.keywords.length, 0);

  return (
    <div>
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onAdd={(cat) => setCategories((cs) => [cat, ...cs])}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">קטגוריות</h1>
          <p className="text-sm text-white/40 mt-1">ארגן מוצרים ופוסטים לפי נושא עם הגדרות מותאמות AI</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all">
          <Plus size={14} /> הוסף קטגוריה
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'סה״כ קטגוריות', value: total,       icon: Tag },
          { label: 'קטגוריות פעילות', value: activeCount, icon: ToggleRight },
          { label: 'סה״כ מילות מפתח', value: totalKw,    icon: Search },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#0d0f1a] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Icon size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex bg-[#0d0f1a] border border-white/5 rounded-xl p-1 gap-1">
          {[{ v: 'all' as const, l: 'הכל' }, { v: 'active' as const, l: 'פעיל' }, { v: 'inactive' as const, l: 'לא פעיל' }].map(({ v, l }) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${filter === v ? 'bg-blue-600/20 text-blue-400' : 'text-white/40 hover:text-white/70'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="חפש קטגוריה או מילת מפתח..."
            className="w-full bg-[#0d0f1a] border border-white/5 rounded-xl px-3 py-2 pr-9 text-sm text-white placeholder-white/25 outline-none focus:border-blue-500/30 transition-colors" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0d0f1a] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">סטטוס</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">קטגוריה</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">מילות מפתח</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">תאריך</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/30 uppercase tracking-wider">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <FolderOpen size={32} className="text-white/15 mx-auto mb-3" />
                  <p className="text-sm text-white/30">אין קטגוריות</p>
                  <button onClick={() => setShowAdd(true)}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    + הוסף קטגוריה ראשונה
                  </button>
                </td>
              </tr>
            ) : filtered.map((cat) => (
              <tr key={cat.id} className="border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3.5">
                  <button onClick={() => toggleActive(cat.id)}
                    className={`transition-colors ${cat.active ? 'text-blue-400 hover:text-blue-300' : 'text-white/20 hover:text-white/40'}`}>
                    {cat.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  </button>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-sm font-medium text-white">{cat.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{cat.productsCount} מוצרים</p>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {cat.keywords.slice(0, 3).map((k) => (
                      <span key={k} className="px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-[10px] text-white/50">{k}</span>
                    ))}
                    {cat.keywords.length > 3 && (
                      <span className="px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-[10px] text-white/35">
                        +{cat.keywords.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <span className="text-xs text-white/35">{cat.createdAt}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-white/25 hover:text-white/60 hover:bg-white/5 rounded-lg transition-all">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 text-white/25 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
