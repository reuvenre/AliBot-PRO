/**
 * Turn a Graph API failure into something the account owner can act on.
 *
 * Graph errors arrive as long English paragraphs describing every branch of a permission
 * model ("If posting to a group… If posting to a page…"), which lands in a Hebrew UI as a
 * wall of text that doesn't say which case applies or what to change. The owner needs the
 * one sentence that tells them where to click; the raw text is kept only when the code is
 * unknown, so nothing is silently swallowed.
 */

export interface FacebookErrorInfo {
  code: number | null;
  /** Actionable Hebrew message for the owner. */
  message: string;
  /** True when only the user can fix it — a retry will fail identically. */
  needsUserAction: boolean;
}

export function facebookError(err: any): FacebookErrorInfo {
  const e = err?.response?.data?.error ?? err?.error;
  const code: number | null = typeof e?.code === 'number' ? e.code : null;
  const raw = e?.message || err?.response?.data?.message || err?.message || 'שגיאה לא ידועה';

  const act = (message: string): FacebookErrorInfo => ({ code, message, needsUserAction: true });

  switch (code) {
    case 200:
    case 10:
      return act(
        'אין הרשאת פרסום לדף. נדרש Page Access Token (לא טוקן משתמש) של אדמין הדף, '
        + 'עם ההרשאות pages_manage_posts ו-pages_read_engagement.',
      );
    case 190:
      return act('טוקן הפייסבוק פג תוקף או בוטל. יש לחדש אותו בהגדרות ← אינטגרציות.');
    case 100:
    case 803:
      return act(
        'מזהה הדף (Page ID) אינו תקין או שהטוקן לא מכסה אותו. '
        + 'יש להשתמש במזהה שחוזר מ-GET /me/accounts, לא במספר מכתובת profile.php.',
      );
    case 368:
      return act('הדף חסום זמנית לפרסום על ידי פייסבוק. יש להמתין לפני ניסיון נוסף.');
    case 4:
    case 17:
    case 613:
      // Transient by nature — the scheduler's next run is the fix, so don't send the owner
      // chasing a settings change that isn't the problem.
      return { code, message: 'חריגה ממכסת הבקשות של פייסבוק — הפרסום יינסה שוב בריצה הבאה.', needsUserAction: false };
    default:
      return { code, message: raw, needsUserAction: false };
  }
}

/** One-line form for a post's error_message / the errors list shown in the UI. */
export function facebookErrorText(err: any): string {
  const { code, message } = facebookError(err);
  return code ? `(#${code}) ${message}` : message;
}
