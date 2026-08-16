/**
 * Does this Green API instance know about WhatsApp CHANNELS?
 *
 * Channels (the broadcast surface under "Updates") are a different object from a group:
 * their chat id ends in `@newsletter` instead of `@g.us`. Green API documents groups and
 * direct chats; channels appear nowhere in its method reference — so the only trustworthy
 * answer is the one the owner's OWN instance gives, which is what this classifies.
 *
 * Three verdicts, because two of them are not "no":
 *   supported   — the instance returned at least one @newsletter chat. It sees channels.
 *   unsupported — the instance rejected getChats outright (method not in this plan/build).
 *   unknown     — it answered, but nothing in the list is a channel. That is expected when
 *                 the owner follows no channel at all, so it must NOT be reported as "no".
 */

export interface ChannelChat { id: string; name: string }

export interface ChannelSupport {
  verdict: 'supported' | 'unsupported' | 'unknown';
  /** Chats the instance reported, so a suspiciously empty answer is visible. */
  total_chats: number;
  channels: ChannelChat[];
  /** Hebrew, shown to the owner as-is. */
  message: string;
}

export function classifyChannelChats(status: number, data: unknown): ChannelSupport {
  if (status === 401 || status === 403) {
    return {
      verdict: 'unknown', total_chats: 0, channels: [],
      message: 'ה-Instance ID או ה-Token של Green API אינם תקינים — תקן אותם ונסה שוב.',
    };
  }
  if (status >= 400) {
    return {
      verdict: 'unsupported', total_chats: 0, channels: [],
      message: `ה-instance שלך דחה את הבקשה (HTTP ${status}) — שיטת getChats לא זמינה בתוכנית שלך, ולכן גם פרסום לערוץ לא יעבוד.`,
    };
  }

  const chats = Array.isArray(data) ? data : [];
  const channels: ChannelChat[] = [];
  for (const chat of chats) {
    const id = String((chat as any)?.id || '');
    if (!id.endsWith('@newsletter')) continue;
    channels.push({ id, name: String((chat as any)?.name || (chat as any)?.subject || '') });
  }

  if (channels.length) {
    return {
      verdict: 'supported', total_chats: chats.length, channels,
      message: `נמצאו ${channels.length} ערוצים — ה-instance שלך מזהה ערוצים, אבל זיהוי אינו פרסום: `
        + 'נכון לאוגוסט 2026 שליחה של Green API דוחה מזהה @newsletter ומקבלת רק מספר אישי, '
        + 'chat_id@lid או קבוצה. לחץ "שלח בדיקה" כדי לבדוק אם זה השתנה.',
    };
  }
  return {
    verdict: 'unknown', total_chats: chats.length, channels: [],
    message: chats.length
      ? `ה-instance החזיר ${chats.length} צ'אטים, אף אחד מהם אינו ערוץ. אם אינך עוקב אחרי אף ערוץ — הבדיקה לא חד-משמעית: תעקוב אחרי ערוץ כלשהו בוואטסאפ ותריץ שוב.`
      : 'ה-instance לא החזיר צ\'אטים כלל. סרוק מחדש את ה-QR בקונסולת Green API ונסה שוב.',
  };
}
