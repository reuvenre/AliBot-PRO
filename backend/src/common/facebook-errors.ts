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

export type MetaPlatform = 'facebook' | 'instagram';

/** Codes that mean the request died at the wire — DNS/socket — before reaching Graph. */
const CONNECTION_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH',
]);

/**
 * Inside an AggregateError the codes come from Node's Happy Eyeballs CONNECT loop, so an
 * INNER ETIMEDOUT is a connect-phase timeout — the socket never opened and nothing reached
 * Meta (same distinction telegram-retry.ts documents). A TOP-LEVEL ETIMEDOUT stays
 * non-retryable: on an established connection the request may have arrived and only the
 * reply was lost. Issue #50 was exactly the inner case going un-retried.
 */
const AGGREGATE_CONNECT_CODES = new Set([...CONNECTION_CODES, 'ETIMEDOUT']);

/** Every error code hiding in the failure — its own plus an AggregateError's inner ones
 *  (Node's Happy Eyeballs connect throws those with an EMPTY top-level message). */
function errorCodes(err: any): string[] {
  const inner = Array.isArray((err as AggregateError)?.errors) ? (err as AggregateError).errors : [];
  return Array.from(new Set(
    [err?.code, ...inner.map((e: any) => e?.code)].filter((c): c is string => typeof c === 'string' && !!c),
  ));
}

/**
 * True when a Graph request provably never REACHED Meta — a connection-level failure with
 * no HTTP response. Safe to send again: nothing was published. (A timeout is NOT this —
 * the request may have arrived and only the reply was lost.)
 */
export function isMetaConnectionError(err: any): boolean {
  if (err?.response) return false;
  const inner = Array.isArray((err as AggregateError)?.errors) ? (err as AggregateError).errors : [];
  const innerCodes = inner
    .map((e: any) => e?.code)
    .filter((c: any): c is string => typeof c === 'string' && !!c);
  // Aggregate (connect-phase) failures may include ETIMEDOUT — see AGGREGATE_CONNECT_CODES.
  if (innerCodes.length) return innerCodes.every((c: string) => AGGREGATE_CONNECT_CODES.has(c));
  const codes = errorCodes(err);
  return codes.length > 0 && codes.every((c) => CONNECTION_CODES.has(c));
}

export function facebookError(err: any, platform: MetaPlatform = 'facebook'): FacebookErrorInfo {
  const e = err?.response?.data?.error ?? err?.error;
  const code: number | null = typeof e?.code === 'number' ? e.code : null;
  const subcode: number | null = typeof e?.error_subcode === 'number' ? e.error_subcode : null;
  const raw = e?.message || err?.response?.data?.message || err?.message || 'שגיאה לא ידועה';

  const act = (message: string): FacebookErrorInfo => ({ code, message, needsUserAction: true });

  // A timeout is not a Graph error and carries no code, but it is the most common failure
  // when a post attaches a link: Graph fetches that URL to build the preview before it
  // answers, so the round trip can outlast a short client timeout.
  if (!code && /timeout|ETIMEDOUT|ECONNABORTED/i.test(String(raw))) {
    return { code: null, message: 'פייסבוק לא השיבה בזמן. הפרסום יינסה שוב בריצה הבאה.', needsUserAction: false };
  }

  // No Graph response and no usable message — the wire failed before Meta ever answered
  // (an AggregateError's message is EMPTY, so `raw` fell through to the generic fallback,
  // and the owner used to see a bare "שגיאה לא ידועה" with nothing to act on). Name the
  // network codes: they ARE the diagnosis, and there is nothing to fix in the settings.
  if (!code && !err?.response && raw === 'שגיאה לא ידועה') {
    const codes = errorCodes(err);
    return {
      code: null,
      message: `החיבור לשרתי מטא נכשל ברמת הרשת (${codes.join(', ') || 'שגיאת חיבור'}) — תקלה זמנית, נסה שוב.`,
      needsUserAction: false,
    };
  }

  switch (code) {
    case 1:
    case 2:
      // Graph's "unknown error" / "service temporarily unavailable" family — including the
      // "(#1) Please reduce the amount of data you're asking for, then retry your request"
      // flavour that photo publishes hit under load. Facebook itself says to retry; nothing
      // was published, nothing on the user's side is wrong.
      return {
        code,
        message: `תקלה זמנית בשרתי פייסבוק — בוצע ניסיון חוזר אוטומטי. (פייסבוק אמרה: ${raw})`,
        needsUserAction: false,
      };
    case 10:
      // #10 means two different things depending on the surface, and the Facebook wording
      // sent Instagram users to re-issue a Page token that was never the problem.
      return act(platform === 'instagram'
        ? 'חסרה ההרשאה instagram_content_publish. במסך האישור של פייסבוק יש לאשר פרסום תוכן באינסטגרם — '
          + 'ההרשאה instagram_manage_events אינה מספיקה לפרסום.'
        : 'אין הרשאת פרסום לדף. נדרש Page Access Token (לא טוקן משתמש) של אדמין הדף, '
          + 'עם ההרשאות pages_manage_posts ו-pages_read_engagement.');
    case 200:
      return act(
        'אין הרשאת פרסום לדף. נדרש Page Access Token (לא טוקן משתמש) של אדמין הדף, '
        + 'עם ההרשאות pages_manage_posts ו-pages_read_engagement.',
      );
    case 190:
      // #190 covers four different owner actions, and the generic "renew the token" wording
      // sent the account owner to re-paste a token from a session Facebook had already killed
      // — which fails identically, every time. The subcode is the only thing that says which
      // action actually helps, so it decides the message.
      if (subcode === 460) {
        return act(
          'הסשן של פייסבוק בוטל בעקבות שינוי סיסמה או איפוס אבטחה. '
          + 'העתקה מחדש של אותו טוקן לא תעזור — כל הטוקנים מהסשן הקודם מתו. '
          + 'יש להתחבר מחדש לפייסבוק, להפיק Page Access Token חדש לכל דף בנפרד, ולעדכן כל קבוצה.',
        );
      }
      if (subcode === 458) {
        return act(
          'האפליקציה הוסרה מחשבון הפייסבוק. יש לאשר אותה מחדש במסך האישור של פייסבוק '
          + '(ולסמן שם את הדפים הרלוונטיים) ואז להפיק Page Access Token חדש.',
        );
      }
      if (subcode === 492) {
        return act(
          'המשתמש שהפיק את הטוקן אינו אדמין של הדף הזה. יש להפיק Page Access Token '
          + 'ממשתמש עם הרשאת אדמין על הדף.',
        );
      }
      return act('טוקן הפייסבוק פג תוקף או בוטל. יש לחדש אותו בהגדרות ← אינטגרציות.');
    case 100:
    case 803: {
      // #100 is Graph's GENERIC "invalid parameter" — a wrong Page ID is only its most
      // common cause. It also fires on a bad `link`, an unknown field, or a malformed
      // argument, and blaming the Page ID unconditionally sent the owner to re-check an id
      // that was correct while the real culprit sat untouched. Graph names the offending
      // parameter in its own message, so let that decide, and never drop what it said.
      if (/\blink\b/i.test(raw)) {
        return act(
          'פייסבוק דחתה את הקישור שבפוסט. הקישור חייב להיות כתובת מלאה וציבורית '
          + `שפייסבוק יכולה לפתוח. (פייסבוק אמרה: ${raw})`,
        );
      }
      if (/nonexisting|does not exist|cannot be loaded|Unsupported (get|post) request/i.test(raw)) {
        return act(
          'מזהה הדף (Page ID) אינו תקין או שהטוקן לא מכסה אותו. '
          + 'יש להשתמש במזהה שחוזר מ-GET /me/accounts, לא במספר מכתובת profile.php.',
        );
      }
      // Unknown flavour of #100: say what Facebook said rather than guess a cause.
      return act(
        'פייסבוק דחתה את הבקשה כלא תקינה. '
        + `הסיבה הנפוצה היא Page ID שגוי, אך פייסבוק אמרה: ${raw}`,
      );
    }
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

/** Marks a failure that provably never reached Meta — see telegram-retry.ts NET_SAFE_TAG. */
export const NET_SAFE_TAG = '[net]';

/** One-line form for a post's error_message / the errors list shown in the UI. */
export function facebookErrorText(err: any, platform: MetaPlatform = 'facebook'): string {
  const { code, message } = facebookError(err, platform);
  const text = code ? `(#${code}) ${message}` : message;
  // The tag is the auto-retry's only input: a connect-phase failure published nothing, so
  // re-sending it cannot duplicate. Everything else is left for the owner to read.
  return isMetaConnectionError(err) ? `${text} ${NET_SAFE_TAG}` : text;
}

/**
 * May this Graph failure be sent again safely?
 *
 * ONLY an explicit Graph error response with a transient code (#1 unknown / #2 service
 * unavailable) qualifies: Facebook answered, said "try again", and published nothing — a
 * retry cannot duplicate. A timeout is deliberately NOT retryable here even though it is
 * transient too: Facebook may have published before the reply was lost, and a retry would
 * put the post on the page twice (see the long-timeout comment at the send site).
 */
export function isTransientFacebookError(err: any): boolean {
  const e = err?.response?.data?.error;
  return typeof e?.code === 'number' && (e.code === 1 || e.code === 2);
}
