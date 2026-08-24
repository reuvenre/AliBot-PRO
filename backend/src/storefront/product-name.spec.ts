import { brandDisplayName, brandKey, isCodeToken, productDisplayName, storeCardName } from './product-name';

describe('productDisplayName — a title turned into a name', () => {
  it('drops the stock code and the wholesale price a Yupoo title opens with', () => {
    // The real title behind s.flylinking.com/g-XKBRBNHMUD. 6380 is the code, 42.66 the
    // USD price (₪129.28 on the page at the day's rate) — neither is the product's name.
    expect(productDisplayName('6380-42.66-LHYF-High quality pure cotton solid color long-sleeved shirt', 'LHYF'))
      .toBe('pure cotton solid color long-sleeved shirt');
  });

  it('cuts an AliExpress keyword pile down to the part a person reads', () => {
    const raw = 'Free Shipping 2 Pcs, Wireless Bluetooth Earphones TWS Sport Waterproof Earbuds, for iPhone Xiaomi';
    const out = productDisplayName(raw);
    expect(out).toContain('Wireless Bluetooth Earphones');
    expect(out).not.toMatch(/free shipping/i);
    expect(out.length).toBeLessThanOrEqual(53);   // 52 + the ellipsis
  });

  it('never prints the brand twice — the card already has its own line for it', () => {
    expect(productDisplayName('COACH shoulder bag COACH', 'COACH')).toBe('shoulder bag');
  });

  it('keeps a model number a shopper actually says out loud', () => {
    // "9060" is the product to a New Balance buyer; "MM-2642001DP" is a warehouse label.
    expect(productDisplayName('New Balance 9060 running shoes', 'New Balance')).toBe('9060 running shoes');
    expect(productDisplayName('MM-2642001DP shoulder bag')).toBe('shoulder bag');
  });

  it('drops a size range — that is a variant, not a name', () => {
    expect(productDisplayName('size:36-45 canvas sneakers')).toBe('canvas sneakers');
    expect(productDisplayName('Canvas Sneakers Size 36-45')).toBe('Canvas Sneakers');
  });

  it('cuts on a word boundary and says it was cut', () => {
    const out = productDisplayName('a'.repeat(20) + ' ' + 'b'.repeat(60));
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(53);
  });

  it('leaves an already-clean name exactly as it is', () => {
    expect(productDisplayName('נעלי ניו באלנס 9060')).toBe('נעלי ניו באלנס 9060');
    expect(productDisplayName('Canvas Sneakers')).toBe('Canvas Sneakers');
  });

  it('strips a price whose symbol trails the number', () => {
    // Straight off a store card: "Rolex--6128-79.9$". The leading-symbol pattern alone
    // left the whole thing on screen.
    expect(productDisplayName('Rolex--6128-79.9$')).toBe('Rolex 6128');
    expect(productDisplayName('Canvas Sneakers 41.99$')).toBe('Canvas Sneakers');
    expect(productDisplayName('MM-26052602S-$60', 'PRADA')).toBe('');
  });

  it('treats a RUN of dashes as a separator and a single one as part of a word', () => {
    expect(productDisplayName('Rolex--6128')).toBe('Rolex 6128');
    expect(productDisplayName('long-sleeved shirt')).toBe('long-sleeved shirt');
  });

  it('returns nothing when the title was only ever a code', () => {
    expect(productDisplayName('MM-2642001DP')).toBe('');
    expect(productDisplayName('   ')).toBe('');
  });
});

describe('storeCardName — the card is never blank', () => {
  it('falls back to the brand when the title is only a code', () => {
    // The common case in a hidden-brand catalog: the album is filed under its SKU.
    expect(storeCardName('MM-2642001DP', 'COACH')).toBe('COACH');
  });

  it('falls back to the raw title rather than showing nothing', () => {
    expect(storeCardName('MM-2642001DP')).toBe('MM-2642001DP');
  });

  it('never returns an empty string', () => {
    expect(storeCardName('')).toBe('מוצר');
    expect(storeCardName('   ', '  ')).toBe('מוצר');
  });

  it('prefers a real name over both fallbacks', () => {
    expect(storeCardName('6380-42.66-LHYF-Canvas Sneakers', 'LHYF')).toBe('Canvas Sneakers');
  });
});

describe('brandDisplayName — a filter list, not a pile of near-duplicates', () => {
  it('cleans the wreckage the album title left behind', () => {
    // Every one of these was its own entry in the brands menu.
    expect(brandDisplayName('POLO- -5349')).toBe('POLO');
    expect(brandDisplayName('CHANEL $')).toBe('CHANEL');
    expect(brandDisplayName('Rolex-- -6128')).toBe('Rolex');
    expect(brandDisplayName('Ray Ban- -6293')).toBe('Ray Ban');
    expect(brandDisplayName('Adidas- -6433')).toBe('Adidas');
    expect(brandDisplayName('**LUN1478 HMS** מוט אולימפי א')).toBe('');
  });

  it('stops at the first number — what follows is a model, not the brand', () => {
    expect(brandDisplayName('New Balance 9060')).toBe('New Balance');
    expect(brandDisplayName('alo-Top-tier ALO Set-')).toBe('alo Top tier');
  });

  it('keeps a three-word brand whole', () => {
    expect(brandDisplayName('Polo Ralph Lauren')).toBe('Polo Ralph Lauren');
  });

  it('refuses a one-character remnant', () => {
    // What a truncated Hebrew title leaves behind — not a brand.
    expect(brandDisplayName('א')).toBe('');
    expect(brandDisplayName('-')).toBe('');
    expect(brandDisplayName(null)).toBe('');
  });

  it('folds case so one brand is one filter', () => {
    expect(brandKey('CHANEL $')).toBe(brandKey('Chanel'));
    expect(brandKey('Rolex-- -6128')).toBe('rolex');
  });
});

describe('isCodeToken', () => {
  it('knows a warehouse label from a word', () => {
    expect(isCodeToken('MM-2642001DP')).toBe(true);
    expect(isCodeToken('ZT12681')).toBe(true);
    expect(isCodeToken('6380')).toBe(false);     // short enough to be a model
    expect(isCodeToken('sneakers')).toBe(false);
    expect(isCodeToken('נעליים')).toBe(false);
  });
});
