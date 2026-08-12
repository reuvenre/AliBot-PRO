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

/**
 * The refusal that is NOT about scopes: pins:write granted, Pinterest still says no.
 * That is the access tier talking — Trial refuses production pin writes — and it is
 * matched by substring wherever the failure needs recognizing (auto-pause, watchdog),
 * so the wording and the detection can never drift apart.
 */
export const TIER_BLOCK_MESSAGE =
  'פינטרסט דחתה את הפרסום למרות שהרשאת pins:write קיימת — זו רמת הגישה של האפליקציה: '
  + 'Trial מיועד לקריאה ולבדיקות, ופרסום פינים אמיתיים דורש אישור Standard access מפינטרסט.';

/**
 * The stable marker inside TIER_BLOCK_MESSAGE — survives prefixes like "Pinterest: ".
 * Deliberately the "despite pins:write granted" clause and not the tier phrase: the
 * missing-scope message MENTIONS the tier as a maybe ("if reconnecting doesn't help…"),
 * and matching on that would let an advisory hint trigger the definite-block handling.
 */
export function isTierBlockError(message: string | null | undefined): boolean {
  return String(message || '').includes('למרות שהרשאת pins:write קיימת');
}

/**
 * The scope whose absence is CERTAIN to stop publishing — the hard gate.
 *
 * Creating a pin also needs boards:write (a pin is written to a board), but that is
 * established from Pinterest's own error reports rather than from a documented list, so it
 * is requested and reported on without being made a blocking condition. An inference of
 * mine must not be what refuses to publish somebody's pin.
 */
export const PUBLISH_SCOPE = 'pins:write';

/** Everything the app needs to be fully functional: publish, pick a board, read analytics. */
export const REQUIRED_SCOPES = ['boards:read', 'boards:write', 'pins:read', PUBLISH_SCOPE];

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
 * What the owner has to DO about it, in their own language.
 *
 * Carries what WAS granted when known, because that is the diagnostic that separates the
 * two causes. A re-connect that comes back with the read scopes and without the write ones
 * is not a consent that went wrong — it is Pinterest's access tier refusing writes to a
 * Trial app, and authorizing again will keep producing the same grant. Without naming the
 * granted list, the message loops the owner through reconnect forever.
 */
export function describeMissingScopes(missing: string[], granted: string[] = []): string {
  if (!missing.length) return '';
  const refusedWrites = granted.length > 0 && !granted.includes(PUBLISH_SCOPE);
  return (
    `החיבור לפינטרסט לא כולל את ההרשאות: ${missing.join(', ')} — ובלעדיהן פינים נדחים.`
    + (granted.length ? ` הרשאות שהוענקו בפועל: ${granted.join(', ')}.` : '')
    + ' נסה: הגדרות ← אינטגרציות ← "התחבר מחדש" (ההרשאות נקבעות ברגע ההתחברות, ולכן חיבור קיים לא מקבל אותן בדיעבד).'
    + (refusedWrites
      ? ' אם גם חיבור מחדש חוזר בלי הרשאת כתיבה — זו רמת הגישה של האפליקציה:'
      + ' פינטרסט מעניקה ל-Trial קריאה בלבד, ופרסום פינים דורש אישור Standard access.'
      : '')
  );
}
