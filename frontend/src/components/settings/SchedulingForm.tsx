'use client';

import { useState, useEffect } from 'react';
import {
  ListOrdered, Save, Loader2, CheckCircle2, Clock,
  Sun, Moon, Timer, Info, Zap,
} from 'lucide-react';
import { credentialsApi } from '@/lib/api-client';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const label = i === 0 ? '00:00 (חצות)'
    : i < 10 ? `0${i}:00`
    : `${i}:00`;
  return { value: i, label };
});

const INTERVALS = [
  { value: 15,   label: 'כל 15 דקות' },
  { value: 30,   label: 'כל 30 דקות' },
  { value: 60,   label: 'כל שעה' },
  { value: 120,  label: 'כל שעתיים' },
  { value: 180,  label: 'כל 3 שעות' },
  { value: 360,  label: 'כל 6 שעות' },
  { value: 720,  label: 'כל 12 שעות' },
  { value: 1440, label: 'פעם ביום' },
];

function estimatePostsPerDay(start: number, end: number, interval: number): number {
  const hours = Math.max(0, end - start);
  const minutes = hours * 60;
  return Math.floor(minutes / interval) + (minutes % interval === 0 ? 0 : 0);
}

export function SchedulingForm() {
  const [enabled, setEnabled] = useState(false);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(22);
  const [interval, setInterval] = useState(60);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    credentialsApi.get()
      .then((c) => {
        setEnabled(c.schedule_enabled ?? false);
        setStartHour(c.schedule_start_hour ?? 9);
        setEndHour(c.schedule_end_hour ?? 22);
        setInterval(c.schedule_interval_minutes ?? 60);
        setLastSentAt(c.schedule_last_sent_at ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const postsPerDay = estimatePostsPerDay(startHour, endHour, interval);

  async function handleSave() {
    if (startHour >= endHour) {
      setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await credentialsApi.upsert({
        aliexpress_app_key: '',
        aliexpress_app_secret: '',
        aliexpress_tracking_id: '',
        telegram_bot_token: '',
        telegram_channel_id: '',
        openai_api_key: '',
        schedule_enabled: enabled,
        schedule_start_hour: startHour,
        schedule_end_hour: endHour,
        schedule_interval_minutes: interval,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('שגיאה בשמירה. נסה שוב.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ direction: 'rtl' }}>

      {/* Master toggle */}
      <div className="bg-surface-secondary border border-edge rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${enabled ? 'bg-amber-500/15' : 'bg-white/[0.05]'}`}>
              <Zap size={18} className={enabled ? 'text-amber-400' : 'text-white/25'} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">שליחה אוטומטית</p>
              <p className="text-xs text-white/35 mt-0.5">
                {enabled ? 'פעיל — הפוסטים יישלחו אוטומטית לפי לוח הזמנים' : 'כבוי — הפוסטים נשמרים בתור אך לא נשלחים'}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${enabled ? 'bg-amber-500' : 'bg-white/10'}`}
            aria-label="Toggle auto-scheduling"
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${enabled ? 'right-0.5' : 'right-6'}`}
            />
          </button>
        </div>

        {lastSentAt && (
          <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white/[0.03] rounded-xl">
            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-white/40">
              שליחה אחרונה: {new Date(lastSentAt).toLocaleDateString('he-IL', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        )}
      </div>

      {/* Time Window */}
      <div className={`bg-surface-secondary border border-edge rounded-2xl p-5 space-y-4 transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={15} className="text-amber-400" />
          <h3 className="text-body font-semibold text-white">חלון שליחה</h3>
        </div>
        <p className="text-xs text-white/35 -mt-2">
          הגדר את שעות היום שבהן מותר לשלוח פוסטים אוטומטית
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Start hour */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-2">
              <Sun size={11} className="text-amber-300" />
              שעת התחלה
            </label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full bg-surface-tertiary border border-edge rounded-xl px-3 py-2.5 text-body text-white/80 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            >
              {HOURS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>

          {/* End hour */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-2">
              <Moon size={11} className="text-blue-300" />
              שעת סיום
            </label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-full bg-surface-tertiary border border-edge rounded-xl px-3 py-2.5 text-body text-white/80 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
            >
              {HOURS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual timeline */}
        <div className="relative h-8 bg-white/[0.03] rounded-full overflow-hidden mt-2">
          <div
            className="absolute h-full bg-amber-500/20 border-x border-amber-500/30 rounded-full transition-all"
            style={{
              left: `${(startHour / 24) * 100}%`,
              width: `${(Math.max(0, endHour - startHour) / 24) * 100}%`,
            }}
          />
          {/* Hour marks */}
          {[0, 6, 12, 18].map((h) => (
            <div
              key={h}
              className="absolute top-1/2 -translate-y-1/2 text-[9px] text-white/20 font-medium"
              style={{ left: `${(h / 24) * 100}%`, transform: 'translate(-50%, -50%)' }}
            >
              {h}:00
            </div>
          ))}
        </div>
      </div>

      {/* Interval */}
      <div className={`bg-surface-secondary border border-edge rounded-2xl p-5 space-y-3 transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <Timer size={15} className="text-amber-400" />
          <h3 className="text-body font-semibold text-white">מרווח בין פוסטים</h3>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setInterval(opt.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center
                ${interval === opt.value
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-white/[0.03] border-edge text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {enabled && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/8 border border-amber-500/15 rounded-2xl">
          <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-body font-medium text-amber-400">סיכום לוח שליחה</p>
            <p className="text-xs text-white/45 mt-1 leading-relaxed">
              שליחה בין <strong className="text-white/60">{startHour}:00</strong> ל-<strong className="text-white/60">{endHour}:00</strong>
              {' '}— עד <strong className="text-white/60">{postsPerDay}</strong> פוסטים ביום
              {' '}({INTERVALS.find(i => i.value === interval)?.label || `כל ${interval} דקות`})
            </p>
            <p className="text-xs text-white/30 mt-1">
              הפוסטים ישלחו לפי הסדר שנקבע בתור. המערכת בודקת כל דקה.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-start pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 text-body font-semibold rounded-xl transition-all disabled:opacity-50
            ${saved
              ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
            }`}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={14} />
          ) : (
            <Save size={14} />
          )}
          {saved ? 'נשמר!' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  );
}
