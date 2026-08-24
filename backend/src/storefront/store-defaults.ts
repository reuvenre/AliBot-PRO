/**
 * What a product page says about shipping and about the product itself, before the owner
 * writes anything.
 *
 * These two blocks answer the questions every single buyer asks — where is my package,
 * and what am I actually getting — so a store that shipped with them EMPTY would ship
 * with its two most-read sections missing, on every product, until someone remembered to
 * fill them in. Defaults, not placeholders: the owner overrides them in settings, and an
 * empty field means "use the default" rather than "show nothing".
 */

export const DEFAULT_SHIPPING_TEXT = [
  'משלוח מהיר עד הדואר הקרוב אליכם. משלוחים מותאמים אישית בהתאם לפלטפורמה הנבחרת. מעקב הזמנה זמין.',
  '',
  'שאלה: איך ניתן לבדוק את סטטוס המשלוח שלי?',
  'תשובה: לאחר ביצוע הרכישה תקבלו אישור הזמנה עם מספר הזמנה. בהמשך יישלח אליכם מספר מעקב למייל שהוזן בעת הקנייה.',
  '',
  'אם לאחר כמה ימים לא קיבלתם מייל עם פרטי המעקב, כדאי לבדוק בתיקיית הספאם, או להיכנס לאזור האישי באתר https://my.flylinking.com/ ולבדוק אם מספר המעקב כבר מופיע שם.',
  '',
  'ניתן לעקוב אחר מצב החבילה באמצעות הזנת מספר המעקב באתר https://www.17track.net/en',
].join('\n');

export const DEFAULT_DETAILS_TEXT = [
  'איכות זהה למקור. שימו לב שאתם בוחרים את הדגם והמידה הנכונה — לא יינתנו החזרים עקב טעות בבחירה.',
].join('\n');

/**
 * The texts a store actually shows: the owner's where they wrote one, the default where
 * they didn't. A field of whitespace counts as not written — an owner who clears the box
 * meant "reset", not "publish an empty section".
 */
export function storeTexts(store: { shipping_text?: string | null; details_text?: string | null }): {
  shipping_text: string; details_text: string;
} {
  return {
    shipping_text: (store?.shipping_text || '').trim() || DEFAULT_SHIPPING_TEXT,
    details_text: (store?.details_text || '').trim() || DEFAULT_DETAILS_TEXT,
  };
}
