/**
 * How the copy leans on a product that came in through a BONUS-POOL keyword.
 *
 * The temptation is to whisper "special price" — but the incentive commission is the
 * OWNER's earnings, not the shopper's discount: a bonus-pool product costs the buyer
 * exactly what it costs. A group learns fast when "מבצע" stops meaning anything, and
 * once the word is worn out the REAL promotions stop converting too. So the hint the
 * copywriter gets is explicit in both directions:
 *
 *   real discount on the product → lean on it HARD. It is true, so spend it.
 *   no real discount             → "the week's pick" framing: also true (the owner did
 *                                  pick this pool), and it claims nothing about price.
 *
 * Either way the model is forbidden from inventing a discount — the same contract the
 * price/proof block enforces from the other side.
 */

/** A discount below this is shelf noise on AliExpress, not something to build copy on. */
export const REAL_DISCOUNT_MIN = 20;

export function bonusCopyHint(discountPct: number | null | undefined, language?: string): string {
  const en = String(language || '').toLowerCase().startsWith('en');
  const pct = Math.round(discountPct || 0);
  if (pct >= REAL_DISCOUNT_MIN) {
    return en
      ? `Angle: this product carries a REAL ${pct}% discount — build the post around it (why now, what it was vs. what it is). Never state any discount or price beyond the given facts.`
      : `זווית הפוסט: למוצר הזה יש הנחה אמיתית של ${pct}% — בנה את הפוסט סביבה (למה דווקא עכשיו, מה היה מול מה שיש). אסור לציין הנחה או מחיר מעבר לנתונים שסופקו.`;
  }
  return en
    ? "Angle: present this as this week's hand-picked find — chosen on purpose, worth a look. Do NOT hint at a special price, deal, or discount: none exists beyond the given facts."
    : 'זווית הפוסט: הצג את המוצר כ"הבחירה של השבוע" — נבחר בקפידה ושווה הצצה. אסור לרמוז למחיר מיוחד, למבצע או להנחה: אין כאלה מעבר לנתונים שסופקו.';
}
