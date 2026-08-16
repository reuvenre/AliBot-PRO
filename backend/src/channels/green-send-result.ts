/**
 * Read Green API's answer to a send attempt.
 *
 * Green API answers 200 with a body for success AND for several refusals, so the HTTP
 * status alone decides nothing — `idMessage` is the only proof a message actually entered
 * the queue. This matters most for the channel probe: an instance that merely ACCEPTS an
 * `@newsletter` chat id without queueing anything would otherwise read as success, and we
 * would wire publishing to a target that silently drops every post.
 */

export interface GreenSendResult {
  ok: boolean;
  /** Hebrew, shown to the owner as-is. */
  detail: string;
}

export function describeGreenSendResult(status: number, data: unknown): GreenSendResult {
  const body = (data ?? {}) as Record<string, any>;
  const id = typeof body.idMessage === 'string' ? body.idMessage : '';
  if (status >= 200 && status < 300 && id) {
    return { ok: true, detail: `נשלח (idMessage: ${id})` };
  }

  const raw = String(
    body.message || body.error || body.description
    || (typeof data === 'string' ? data : '') || '',
  ).trim();

  if (status === 401 || status === 403) {
    return { ok: false, detail: 'Instance ID / Token של Green API אינם תקינים.' };
  }
  if (status === 466) {
    // Green API's own code for "quota / instance not paid".
    return { ok: false, detail: 'המכסה של ה-instance נגמרה או שהמנוי לא פעיל ב-Green API.' };
  }
  // The answer Green API gives for an @newsletter target: its send API accepts only a
  // person, a LID chat or a group. Verified 16.08.2026 against a live instance — worth
  // naming in Hebrew instead of making the owner parse an English validation dump.
  if (/must be one of the next formats/i.test(raw) && /@c\.us/i.test(raw)) {
    return {
      ok: false,
      detail: 'Green API לא תומך בפרסום לערוצים — ה-API מקבל רק מספר אישי, chat_id@lid או קבוצה (@g.us).',
    };
  }
  if (status >= 400) {
    return { ok: false, detail: `נדחה (HTTP ${status})${raw ? ` — ${raw}` : ''}` };
  }
  return { ok: false, detail: raw ? `לא התקבל אישור שליחה — ${raw}` : 'לא התקבל idMessage — ההודעה לא נכנסה לתור.' };
}
