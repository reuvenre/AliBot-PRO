'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { credentialsApi, channelsApi } from '@/lib/api-client';
import type { Channel } from '@/types';

export function IntegrationsForm() {
  const [botToken, setBotToken] = useState('');
  const [defaultChannel, setDefaultChannel] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [telegramOk, setTelegramOk] = useState<boolean | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    credentialsApi.get()
      .then((c) => { setDefaultChannel(c.telegram_channel_id || ''); })
      .catch(() => {});

    channelsApi.list()
      .then(setChannels)
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await credentialsApi.upsert({
        aliexpress_app_key: '',
        aliexpress_app_secret: '',
        aliexpress_tracking_id: '',
        telegram_bot_token: botToken,
        telegram_channel_id: defaultChannel,
        openai_api_key: '',
      });
      setSaved(true);
      setBotToken('');
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await credentialsApi.verify();
      setTelegramOk(res.telegram);
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('למחוק את הערוץ?')) return;
    await channelsApi.delete(id).catch(() => {});
    setChannels((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Default Telegram Bot */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-lg">📨</span> Telegram Bot ראשי
          {telegramOk !== null && (
            telegramOk
              ? <CheckCircle2 size={13} className="text-emerald-400" />
              : <XCircle size={13} className="text-red-400" />
          )}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Bot Token</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="השאר ריק לשמור על הנוכחי"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
                dir="ltr"
              />
              <button type="button" onClick={() => setShowToken((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="text-[10px] text-white/25 mt-1">מ-@BotFather · ממולא רק בעת עדכון</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">ערוץ ברירת מחדל</label>
            <input
              value={defaultChannel}
              onChange={(e) => setDefaultChannel(e.target.value)}
              placeholder="@mychannel או -100123456789"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors"
              dir="ltr"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור'}
          </button>
          <button onClick={handleVerify} disabled={verifying}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-60 text-white/60 text-sm rounded-xl transition-all">
            {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            בדוק חיבור
          </button>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-lg">💬</span> WhatsApp Business
          </h3>
          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2.5 py-0.5 font-medium">בקרוב</span>
        </div>
        <p className="text-xs text-white/35">שילוב עם WhatsApp Business API לשליחת פוסטים לקבוצות ואנשי קשר.</p>
        <button disabled className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/5 text-white/30 text-xs rounded-xl cursor-not-allowed opacity-50">
          <Plus size={12} /> חבר WhatsApp
        </button>
      </section>

      {/* Facebook */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-lg">📘</span> Facebook Pages
          </h3>
          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2.5 py-0.5 font-medium">בקרוב</span>
        </div>
        <p className="text-xs text-white/35">פרסום לדפי פייסבוק ישירות מהמערכת.</p>
        <button disabled className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/5 text-white/30 text-xs rounded-xl cursor-not-allowed opacity-50">
          <Plus size={12} /> חבר דף פייסבוק
        </button>
      </section>

      {/* Instagram */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-lg">📸</span> Instagram Business
          </h3>
          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-2.5 py-0.5 font-medium">בקרוב</span>
        </div>
        <p className="text-xs text-white/35">פרסום Reels ופוסטים לחשבון Instagram Business שלך.</p>
        <button disabled className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/5 text-white/30 text-xs rounded-xl cursor-not-allowed opacity-50">
          <Plus size={12} /> חבר חשבון Instagram
        </button>
      </section>

      {/* Additional Channels */}
      <section className="bg-[#0d0f1a] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="text-lg">📋</span> ערוצים נוספים
          </h3>
          <a href="/groups"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <Plus size={12} />
            נהל ערוצים
          </a>
        </div>
        {loadingChannels ? (
          <div className="py-4 flex justify-center"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
        ) : channels.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-4">אין ערוצים נוספים — <a href="/groups" className="text-blue-400 hover:underline">הוסף ערוץ</a></p>
        ) : (
          <div className="space-y-2">
            {channels.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 px-3 bg-white/3 rounded-lg">
                <span className="text-base">📨</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name}</p>
                  <p className="text-xs text-white/30">{c.channel_id || 'ללא Channel ID'}</p>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                  {c.is_active ? 'פעיל' : 'מושבת'}
                </div>
                <button onClick={() => handleDeleteChannel(c.id)}
                  className="p-1 text-white/20 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
