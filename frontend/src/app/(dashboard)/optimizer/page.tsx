'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Brain, ChevronDown, ChevronUp, Loader2, Play, RotateCcw, Undo2,
} from 'lucide-react';
import { optimizerApi } from '@/lib/api-client';
import type { OptimizerAction } from '@/types';

/**
 * What the learning engine did, and how to take it back.
 *
 * The morning report used to be the only window into the engine, and it had grown into a
 * fifty-line document that told the owner what HE should go do. It is now a glance, the
 * engine makes the changes itself — and this screen is where those changes live: every one
 * of them named, with the measured reason behind it, and a button that puts it back.
 */

/** dd.MM HH:mm in the reader's own timezone. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Actions grouped under the calendar day they happened on. */
function byDay(actions: OptimizerAction[]): Array<{ day: string; items: OptimizerAction[] }> {
  const groups = new Map<string, OptimizerAction[]>();
  for (const a of actions) {
    const d = new Date(a.at);
    const key = Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const list = groups.get(key);
    if (list) list.push(a); else groups.set(key, [a]);
  }
  return Array.from(groups, ([day, items]) => ({ day, items }));
}

export default function OptimizerPage() {
  const [actions, setActions] = useState<OptimizerAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setActions(await optimizerApi.actions(14));
    } catch {
      setError('טעינת הפעולות נכשלה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const undo = async (id: string) => {
    setUndoing(id);
    try {
      const res = await optimizerApi.undo(id);
      // The row stays in the list either way — "the engine did X and I undid it" is the
      // history worth keeping — so a refresh is what shows the new state.
      if (!res.ok) setError(res.reason || 'הביטול נכשל');
      await load();
    } catch {
      setError('הביטול נכשל');
    } finally {
      setUndoing(null);
    }
  };

  const openDetail = async () => {
    if (showDetail) { setShowDetail(false); return; }
    setShowDetail(true);
    if (detail === null) {
      const res = await optimizerApi.detail().catch(() => ({ detail: null }));
      setDetail(res.detail || 'אין דוח שמור עדיין.');
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await optimizerApi.run();
      if (!res.ok) setError(res.reason || 'ההרצה נכשלה');
      setDetail(res.detail ?? null);
      await load();
    } catch {
      setError('ההרצה נכשלה');
    } finally {
      setRunning(false);
    }
  };

  const standing = actions.filter((a) => !a.undone).length;

  return (
    <div dir="rtl" className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">המוח הלומד</h1>
            <p className="text-sm text-white/50">
              כל שינוי שהמנוע ביצע בעצמו — עם הסיבה המדודה, ואפשרות להחזיר אותו.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openDetail}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-secondary border border-edge-hover text-sm text-white/80 hover:text-white"
          >
            {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            הדוח המלא
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            הרץ עכשיו
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {showDetail && (
        <section className="rounded-2xl border border-edge bg-surface-secondary p-4">
          <h2 className="text-sm font-semibold text-white/70 mb-2">הדוח המלא של הריצה האחרונה</h2>
          {detail === null
            ? <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            : <pre className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed font-sans">{detail}</pre>}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">
            {loading ? 'טוען…' : `${standing} שינויים עומדים · 14 הימים האחרונים`}
          </h2>
          <button onClick={load} className="text-white/40 hover:text-white/70" aria-label="רענן">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {!loading && !actions.length && (
          <div className="rounded-2xl border border-edge bg-surface-secondary p-8 text-center text-white/50 text-sm">
            המנוע עוד לא ביצע שינויים. הדוח הראשון יגיע בבוקר.
          </div>
        )}

        {byDay(actions).map(({ day, items }) => (
          <div key={day} className="space-y-2">
            <div className="text-xs text-white/40 px-1">{day}</div>
            {items.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                  a.undone
                    ? 'border-edge bg-surface-secondary/40 opacity-60'
                    : 'border-edge-hover bg-surface-secondary'
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-sm ${a.undone ? 'text-white/50 line-through' : 'text-white'}`}>
                    {a.label}
                  </div>
                  {a.reason && <div className="text-xs text-white/45 mt-1">{a.reason}</div>}
                  <div className="text-[11px] text-white/30 mt-1">{when(a.at)}</div>
                </div>

                {a.undone ? (
                  <span className="shrink-0 text-xs text-white/40">בוטל</span>
                ) : a.undoable ? (
                  <button
                    onClick={() => undo(a.id)}
                    disabled={undoing === a.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-primary border border-edge-hover text-xs text-white/70 hover:text-white disabled:opacity-50"
                  >
                    {undoing === a.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Undo2 className="w-3.5 h-3.5" />}
                    בטל
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
