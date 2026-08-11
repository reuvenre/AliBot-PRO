/**
 * What Pinterest actually GRANTED, as opposed to what we asked for.
 *
 * These are not the same thing, and the difference is silent. An app may only request the
 * scopes it is configured for in the developer portal; anything beyond that is dropped from
 * the consent without an error. The handshake still succeeds, the token still works — for
 * reading. The first publish is where it surfaces, hours later, as "your token does not
 * have sufficient permissions".
 *
 * That is exactly how the first pin failed: the connection reported itself healthy because
 * listing boards worked, and listing boards proves nothing at all about writing. So the
 * grant is now recorded at connect time and checked against what publishing needs, instead
 * of being inferred from a read that cannot answer the question.
 */

/** Publishing a pin needs precisely this. Reads are useful; without this nothing ships. */
export const PUBLISH_SCOPE = 'pins:write';

/** Everything the app needs to be fully functional: publish, pick a board, read analytics. */
export const REQUIRED_SCOPES = ['boards:read', 'pins:read', PUBLISH_SCOPE];

/**
 * The `scope` field of a token response → a clean list.
 *
 * Pinterest has returned this space-separated and comma-separated at different times, so
 * accept both rather than betting on one and silently reading zero scopes — which would
 * make a perfectly good connection look broken.
 */
export function parseGrantedScopes(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Which required scopes are absent from the grant.
 *
 * An EMPTY grant returns nothing missing, on purpose. Older connections predate this
 * recording, and a token that has been publishing happily for weeks must not be declared
 * broken because we have no record of its scopes. Unknown is not the same as missing.
 */
export function missingScopes(granted: string[]): string[] {
  if (!granted.length) return [];
  return REQUIRED_SCOPES.filter((s) => !granted.includes(s));
}

/** Can this grant publish? Unknown grants are given the benefit of the doubt (see above). */
export function canPublish(granted: string[]): boolean {
  return !granted.length || granted.includes(PUBLISH_SCOPE);
}

/**
 * What the owner has to DO about it, in their own language. The instruction is specific
 * because the generic version ("check your scopes") is what cost a day: the fix is not in
 * our settings screen at all, it is in the Pinterest app configuration, and it does not
 * take effect until the connection is granted again.
 */
export function describeMissingScopes(missing: string[]): string {
  if (!missing.length) return '';
  const publishing = missing.includes(PUBLISH_SCOPE);
  return (
    `פינטרסט לא העניקה את ההרשאות: ${missing.join(', ')}. `
    + (publishing
      ? 'בלי pins:write אי אפשר לפרסם פינים — הקריאה עובדת, הכתיבה נדחית. '
      : '')
    + 'התיקון הוא בצד של פינטרסט: היכנס ל-developers.pinterest.com ← האפליקציה שלך, '
    + 'ודא שההרשאות המבוקשות כוללות את כולן, ואז חזור לכאן ולחץ "התחבר לפינטרסט" שוב — '
    + 'הרשאה חדשה נכנסת לתוקף רק בחיבור מחדש.'
  );
}
