'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { authApi } from '@/lib/api-client';

export function SecurityForm() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (form.next.length < 6) {
      setError('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      setSuccess(true);
      setForm({ current: '', next: '', confirm: '' });
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'שגיאה בשינוי הסיסמה');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label, field, placeholder,
  }: {
    label: string; field: 'current' | 'next' | 'confirm'; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show[field] ? 'text' : 'password'}
          value={form[field]}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setShow((s) => ({ ...s, [field]: !s[field] }))}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          {show[field] ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-400" />
          שינוי סיסמה
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="סיסמה נוכחית" field="current" placeholder="הסיסמה הנוכחית שלך" />
          <div className="h-px bg-white/5" />
          <Field label="סיסמה חדשה" field="next" placeholder="לפחות 6 תווים" />
          <Field label="אימות סיסמה חדשה" field="confirm" placeholder="הכנס שוב את הסיסמה החדשה" />

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5 text-xs text-emerald-400">
              ✓ הסיסמה עודכנה בהצלחה
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {saving ? 'שומר...' : 'עדכן סיסמה'}
          </button>
        </form>
      </section>
    </div>
  );
}
