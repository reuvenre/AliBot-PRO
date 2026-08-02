'use client';

import { Save, Loader2 } from 'lucide-react';

/**
 * The ONE save control a settings tab gets.
 *
 * The settings screens had grown a save button per section — and whole sections with no
 * button at all. An owner would flip a toggle, see nothing nearby to press, and either
 * navigate away and lose the change or assume it had saved itself. Neither is a guess a
 * settings screen should force.
 *
 * One sticky bar per tab makes the contract obvious: everything on this screen saves
 * together, with one button, and that button is on-screen no matter where you scrolled.
 * Section-level ACTION buttons (test connection, verify page) stay in their sections —
 * they run things; this bar is the only thing that persists them.
 */
export function SettingsSaveBar({ onSave, saving, saved }: {
  onSave: () => void | Promise<void>;
  saving: boolean;
  saved: boolean;
}) {
  // Just the button — sticky so it's reachable from anywhere on the tab, but no card, no
  // caption. The wrapping panel this started with read as one more section to parse, and
  // the owner's reaction was right: a save button explains itself.
  return (
    <div className="sticky bottom-3 z-10 mt-6 flex justify-start">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-black/25"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saved ? 'נשמר ✓' : saving ? 'שומר...' : 'שמור הגדרות'}
      </button>
    </div>
  );
}
