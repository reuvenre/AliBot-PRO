import { REAL_DISCOUNT_MIN, bonusCopyHint } from './bonus-copy';

describe('bonusCopyHint', () => {
  it('leans hard on a REAL discount — it is true, so spend it', () => {
    const hint = bonusCopyHint(43);
    expect(hint).toContain('43%');
    expect(hint).toContain('הנחה אמיתית');
  });

  it('falls back to "the week\'s pick" when there is no real discount', () => {
    // The honesty line this module exists for: the bonus commission is the OWNER's
    // earnings, not the shopper's discount. Without a real discount the copy may claim
    // curation — never price.
    const hint = bonusCopyHint(0);
    expect(hint).toContain('הבחירה של השבוע');
    expect(hint).toContain('אסור');
  });

  it('treats shelf-noise discounts as no discount at all', () => {
    expect(bonusCopyHint(REAL_DISCOUNT_MIN - 1)).toContain('הבחירה של השבוע');
    expect(bonusCopyHint(REAL_DISCOUNT_MIN)).toContain('הנחה אמיתית');
  });

  it('forbids invented discounts in BOTH branches', () => {
    // Whatever the angle, the model must never state a discount beyond the given facts.
    expect(bonusCopyHint(50)).toMatch(/אסור/);
    expect(bonusCopyHint(null)).toMatch(/אסור/);
  });

  it('speaks English for an English campaign', () => {
    expect(bonusCopyHint(30, 'en')).toContain('REAL 30% discount');
    expect(bonusCopyHint(0, 'en')).toContain("week's hand-picked find");
  });
});
