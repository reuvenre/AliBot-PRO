'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { credentialsApi } from '@/lib/api-client';
import type { CredentialSetInput } from '@/types';

type VerifyStatus = { aliexpress: boolean; telegram: boolean; openai: boolean } | null;

export function CredentialsForm() {
  const [form, setForm] = useState<CredentialSetInput>({
    aliexpress_app_key: '',
    aliexpress_app_secret: '',
    aliexpress_tracking_id: '',
    telegram_bot_token: '',
    telegram_channel_id: '',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    currency_pair: 'USD_ILS',
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    credentialsApi.get()
      .then((c) => {
        setForm((prev) => ({
          ...prev,
          aliexpress_app_key: c.aliexpress_app_key || '',
          aliexpress_tracking_id: c.aliexpress_tracking_id || '',
          telegram_channel_id: c.telegram_channel_id || '',   // non-secret, always load
          openai_model: c.openai_model || 'gpt-4o-mini',
          currency_pair: c.currency_pair || 'USD_ILS',
          // Secrets: leave empty — backend keeps existing value when empty is submitted
          aliexpress_app_secret: '',
          telegram_bot_token: '',
          openai_api_key: '',
        }));
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await credentialsApi.upsert(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await credentialsApi.verify();
      setVerifyStatus(res);
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleShow = (key: string) => setShow((s) => ({ ...s, [key]: !s[key] }));

  const Field = ({
    label,
    field,
    placeholder,
    secret = false,
    hint,
  }: {
    label: string;
    field: keyof CredentialSetInput;
    placeholder?: string;
    secret?: boolean;
    hint?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={secret && !show[field] ? 'password' : 'text'}
          value={form[field] as string}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors pr-10"
          dir="ltr"
        />
        {secret && (
          <button
            type="button"
            onClick={() => toggleShow(field)}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            {show[field] ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  );

  const VerifyIcon = ({ ok }: { ok: boolean }) =>
    ok ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />;

  return (
    <div className="space-y-6">
      {/* AliExpress */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">🛍</span> AliExpress API
          {verifyStatus && (
            <VerifyIcon ok={verifyStatus.aliexpress} />
          )}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <Field label="מפתח אפליקציה (App Key)" field="aliexpress_app_key" placeholder="1234567890" />
          <Field label="סוד אפליקציה (App Secret)" field="aliexpress_app_secret" secret placeholder="מפתח סודי..." hint="ממולא רק בעת עדכון" />
          <Field label="מזהה מעקב (Tracking ID)" field="aliexpress_tracking_id" placeholder="affiliate_tracking_id" />
        </div>
      </section>

      {/* OpenAI */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">🤖</span> OpenAI
          {verifyStatus && (
            <VerifyIcon ok={verifyStatus.openai} />
          )}
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <Field label="מפתח API" field="openai_api_key" secret placeholder="sk-proj-..." />
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">מודל</label>
            <select
              value={form.openai_model}
              onChange={(e) => setForm((f) => ({ ...f, openai_model: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="gpt-4o-mini">gpt-4o-mini (מהיר וחסכוני)</option>
              <option value="gpt-4o">gpt-4o (איכות גבוהה)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (זול ביותר)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'נשמר ✓' : isSaving ? 'שומר...' : 'שמור הגדרות'}
        </button>

        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/70 text-sm rounded-xl transition-all"
        >
          {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          בדוק חיבורים
        </button>
      </div>
    </div>
  );
}
