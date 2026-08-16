'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Gift, Loader2, Plus, Power, RefreshCw, Trash2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { campaignsApi, incentiveApi } from '@/lib/api-client';
import type { IncentiveProgram, IncentiveInput } from '@/lib/api-client';
import type { Campaign } from '@/types';

/**
 * The owner's registered AliExpress incentive campaigns (portal bonus pools).
 *
 * The affiliate API has no endpoint for these — registration happens in the portal — so
 * this screen is how the fact reaches the autopilot: while a pool is live, its keywords
 * join the rotation of the campaigns publishing to the pool's groups, so the products
 * that earn a bonus get the airtime.
 */

/** The Incentive Campaign page in the affiliate portal. Verified by the owner —
 *  the older /campaign/index.htm path now answers with a 404 error page. */
const PORTAL_URL = 'https://portals.aliexpress.com/affiportals/web/incentive.htm';

/** <input type="date"> value from an ISO string. */
function toDateInput(iso?: string | null, fallback?: Date): string {
  const d = iso ? new Date(iso) : (fallback || new Date());
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function endOfThisMonth(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59);
}

function parseKeywords(json: string): string[] {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
function parseTargets(json: string | null): string[] {
  try { const a = json ? JSON.parse(json) : []; return Array.isArray(a) ? a : []; } catch { return []; }
}

function statusOf(p: IncentiveProgram): { label: string; cls: string } {
  const now = Date.now();
  if (!p.active) return { label: 'כבוי', cls: 'bg-white/5 text-white/40 border-edge' };
  if (new Date(p.starts_at).getTime() > now) return { label: 'מתוכנן', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30' };
  if (new Date(p.ends_at).getTime() < now) return { label: 'הסתיים', cls: 'bg-white/5 text-white/40 border-edge' };
  return { label: 'פעיל — מזכה בבונוס', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
}

const inputCls = 'w-full bg-white/5 border border-edge-hover rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-500/50';
const labelCls = 'block text-xs text-white/50 mb-1.5';

export default function IncentivesPage() {
  const [rows, setRows] = useState<IncentiveProgram[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, camps] = await Promise.all([
        incentiveApi.list(),
        campaignsApi.list({ limit: 100 }).then((r) => r.data).catch(() => [] as Campaign[]),
      ]);
      setRows(list); setCampaigns(camps); setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'טעינת קמפייני הבונוס נכשלה');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const liveCount = rows.filter((p) => statusOf(p).label.startsWith('פעיל')).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift size={22} className="text-amber-400" /> קמפייני בונוס
          </h1>
          <p className="text-sm text-white/40 mt-1">
            הפולים של תוכנית השותפים באלי אקספרס — הטייס יעדיף מוצרים מהקטגוריות שנרשמת אליהן.
          </p>
        </div>
        <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-1">
          <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 text-sm rounded-xl transition-all">
            <ExternalLink size={14} /> לפורטל להרשמה
          </a>
          <button onClick={() => setAdding(true)}
            className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-xl transition-all">
            <Plus size={14} /> הוסף קמפיין
          </button>
          <button onClick={load} disabled={loading}
            className="shrink-0 whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/70 text-sm rounded-xl transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> רענן
          </button>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-5">
        <p className="text-xs text-white/60 leading-relaxed">
          <b className="text-amber-300">איך זה עובד:</b> נרשמים לקמפיין בפורטל (חינם), ואז מוסיפים אותו כאן עם
          מילות החיפוש של הקטגוריה. כל עוד הקמפיין פעיל, הטייסים שבחרת יכניסו את
          המילים האלה לרוטציה — כך שהמוצרים שמזכים בבונוס מקבלים זמן אוויר. בתום התאריך הכל חוזר לשגרה לבד.
          תזכורת להירשם מחדש נשלחת ב-1 לכל חודש.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1.5 mb-4"><AlertTriangle size={14} /> {error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-white/30" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-surface-secondary border border-edge rounded-xl p-8 text-center">
          <Gift size={28} className="text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/50">עדיין לא הוספת קמפייני בונוס.</p>
          <p className="text-xs text-white/30 mt-1">היכנס לפורטל, הירשם למה שרלוונטי לקהל שלך, וחזור לכאן להוסיף.</p>
        </div>
      ) : (
        <>
          {liveCount > 0 && (
            <p className="text-xs text-emerald-300/80 mb-3">{liveCount} קמפייני בונוס פעילים כרגע ומשפיעים על הטייסים.</p>
          )}
          <div className="space-y-3">
            {rows.map((p) => (
              <ProgramCard key={p.id} program={p} campaigns={campaigns} onChanged={load} />
            ))}
          </div>
        </>
      )}

      {adding && (
        <ProgramModal campaigns={campaigns} onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); load(); }} />
      )}
    </div>
  );
}

function ProgramCard({ program, campaigns, onChanged }: {
  program: IncentiveProgram; campaigns: Campaign[]; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = statusOf(program);
  const keywords = parseKeywords(program.keywords_json);
  const targetIds = parseTargets(program.target_campaigns);
  const targetNames = targetIds.length
    ? targetIds.map((id) => campaigns.find((c) => c.id === id)?.name || id).join(', ')
    : 'כל הטייסים';

  const toggle = async () => {
    setBusy(true);
    try { await incentiveApi.update(program.id, { active: !program.active }); onChanged(); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await incentiveApi.remove(program.id); onChanged(); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-surface-secondary border border-edge rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">{program.name}</h3>
            <span className={`text-2xs px-2 py-0.5 rounded-full border ${status.cls}`}>{status.label}</span>
          </div>
          <p className="text-2xs text-white/40 mt-1.5">
            {new Date(program.starts_at).toLocaleDateString('he-IL')} — {new Date(program.ends_at).toLocaleDateString('he-IL')} · יעד: {targetNames}
          </p>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {keywords.map((k) => (
                <span key={k} dir="ltr" className="text-2xs bg-white/5 border border-edge rounded-full px-2 py-0.5 text-white/60">{k}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setEditing(true)} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs">ערוך</button>
          <button onClick={toggle} disabled={busy} title={program.active ? 'כבה' : 'הפעל'}
            className={`p-2 rounded-lg ${program.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/40'} hover:opacity-80`}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
          </button>
          <button onClick={remove} disabled={busy} title="מחק"
            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"><Trash2 size={13} /></button>
        </div>
      </div>

      {editing && (
        <ProgramModal program={program} campaigns={campaigns} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onChanged(); }} />
      )}
    </div>
  );
}

function ProgramModal({ program, campaigns, onClose, onSaved }: {
  program?: IncentiveProgram; campaigns: Campaign[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(program?.name || '');
  const [keywords, setKeywords] = useState(parseKeywords(program?.keywords_json || '[]').join(', '));
  const [startsAt, setStartsAt] = useState(toDateInput(program?.starts_at));
  const [endsAt, setEndsAt] = useState(toDateInput(program?.ends_at, endOfThisMonth()));
  const [targetIds, setTargetIds] = useState<string[]>(parseTargets(program?.target_campaigns || null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const kws = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (!name.trim()) { setError('תן שם לקמפיין (כמו בפורטל)'); return; }
    if (!kws.length) { setError('הוסף לפחות מילת חיפוש אחת באנגלית'); return; }
    setSaving(true); setError('');
    const dto: IncentiveInput = {
      name: name.trim(), keywords: kws, target_campaigns: targetIds,
      starts_at: new Date(`${startsAt}T00:00:00`).toISOString(),
      ends_at: new Date(`${endsAt}T23:59:59`).toISOString(),
    };
    try {
      if (program) await incentiveApi.update(program.id, dto);
      else await incentiveApi.create(dto);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'השמירה נכשלה');
      setSaving(false);
    }
  };

  const toggleTarget = (id: string) =>
    setTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-surface-secondary border border-edge rounded-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto"
        dir="rtl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Gift size={16} className="text-amber-400" /> {program ? 'עריכת קמפיין בונוס' : 'קמפיין בונוס חדש'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>שם הקמפיין (כמו בפורטל)</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Home & Living Pool" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>מילות חיפוש באנגלית — מופרדות בפסיק</label>
            <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} dir="ltr"
              placeholder="storage box, kitchen organizer, closet organizer"
              className={`${inputCls} resize-none`} />
            <p className="text-2xs text-white/30 mt-1">אלה המילים שהטייס יחפש בהן — כדאי 3–6 ממוקדות לקטגוריה שמזכה בבונוס.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>מתאריך</label>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} dir="ltr" />
            </div>
            <div>
              <label className={labelCls}>עד תאריך</label>
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} dir="ltr" />
            </div>
          </div>

          <div>
            <label className={labelCls}>לאילו טייסים זה רלוונטי (ריק = כל הטייסים)</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {campaigns.map((c) => {
                const on = targetIds.includes(c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors
                    ${on ? 'border-amber-500/60 bg-amber-500/10' : 'border-edge hover:border-edge-hover bg-white/[0.03]'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleTarget(c.id)} className="accent-amber-500" />
                    <span className="text-sm text-white/80 flex-1 truncate">{c.name}</span>
                    {c.status !== 'active' && <span className="text-2xs text-white/30">מושהה</span>}
                  </label>
                );
              })}
              {campaigns.length === 0 && <p className="text-2xs text-white/30">אין טייסים מוגדרים.</p>}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-bold">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} שמור
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-sm">ביטול</button>
          </div>
        </div>
      </div>
    </div>
  );
}
