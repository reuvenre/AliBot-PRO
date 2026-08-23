/**
 * The buttons under the morning brief.
 *
 * The report stopped being a document the owner reads and became a message he ACTS on:
 * the evidence is one tap away instead of delivered unasked, and every change the engine
 * made on its own authority can be taken back from the same message.
 *
 * callback_data has a hard 64-BYTE limit that Telegram enforces by rejecting the whole
 * message — a silently unsendable report is exactly the failure this file exists to
 * prevent, so the payloads are built and length-checked here, and tested.
 */

export const CALLBACK_MAX_BYTES = 64;

export interface Button { text: string; callback_data?: string; url?: string }
export type Keyboard = Button[][];

/** Action prefixes, kept to two characters so a uuid still fits beside them. */
export const CB_DETAIL = 'od';   // show the full report
export const CB_UNDO_LIST = 'ol'; // list tonight's changes with an undo button each
export const CB_UNDO = 'ou';     // undo one change

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

/** `prefix:arg`, or the bare prefix when there is no argument. Never over the limit. */
export function callback(prefix: string, arg?: string | null): string {
  const data = arg ? `${prefix}:${arg}` : prefix;
  if (bytes(data) > CALLBACK_MAX_BYTES) {
    // Truncating a uuid would address the wrong row; dropping the argument makes the
    // button fall back to "show me the list", which is wrong but harmless.
    return prefix;
  }
  return data;
}

/**
 * The brief's own keyboard. `runId` addresses the report whose detail to open — omitted
 * (a run row that failed to save) the button still works and opens the latest run.
 */
export function digestKeyboard(runId?: string | null, appUrl = process.env.FRONTEND_URL): Keyboard {
  const row: Button[] = [
    { text: '📋 פירוט מלא', callback_data: callback(CB_DETAIL, runId) },
    { text: '↩️ בטל שינוי', callback_data: CB_UNDO_LIST },
  ];
  const keyboard: Keyboard = [row];
  // The dashboard link is a plain URL button — no callback, so it works even when the
  // bot's webhook is down. Skipped entirely when the app URL isn't configured, because a
  // button pointing at "undefined/optimizer" is worse than no button.
  if (appUrl && /^https?:\/\//.test(appUrl)) {
    keyboard.push([{ text: '📊 מסך המוח הלומד', url: `${appUrl.replace(/\/$/, '')}/optimizer` }]);
  }
  return keyboard;
}

/** One row per undoable change, plus a way out. */
export function undoKeyboard(actions: Array<{ id: string; text: string }>, max = 8): Keyboard {
  const rows: Keyboard = actions.slice(0, max).map((a) => [{
    text: `↩️ ${trimButton(a.text)}`,
    callback_data: callback(CB_UNDO, a.id),
  }]);
  rows.push([{ text: '✖️ סגור', callback_data: 'x' }]);
  return rows;
}

/**
 * Button captions are one line in the client; a long one is truncated by Telegram at an
 * arbitrary point, which can cut mid-word inside a quoted keyword. Cut it ourselves.
 */
export function trimButton(text: string, max = 42): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}
