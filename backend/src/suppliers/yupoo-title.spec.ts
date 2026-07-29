import { YupooService } from './yupoo.service';

/**
 * Album-title parsing decides a product's SKU, and the SKU decides which record a FLYLINK
 * link attaches to. Getting it wrong doesn't fail loudly — it publishes one product's photos
 * under another product's link, which is why these cases are pinned down here.
 */
describe('YupooService.parseTitle', () => {
  const svc = new YupooService() as any;
  const parse = (t: string) => svc.parseTitle(t);

  describe('stores that put the code first', () => {
    it('reads "CODE $PRICE BRAND"', () => {
      expect(parse('LUN1526 $56.99 COACH')).toMatchObject({ code: 'LUN1526', price: 56.99 });
    });

    it('reads a code with internal hyphens and the price glued on', () => {
      expect(parse('MM-68SM2606-$45')).toMatchObject({ code: 'MM-68SM2606', price: 45 });
    });

    it('keeps internal hyphens when a brand follows', () => {
      expect(parse('MM-148A0B-$99.86 ADA')).toMatchObject({ code: 'MM-148A0B', price: 99.86 });
    });
  });

  // The regression: this store writes the price first and the BRAND before the code, so
  // "first token = code" stored the brand. Every album of a brand then shared one SKU.
  describe('stores that put the brand before the code', () => {
    it('skips a brand with no digits', () => {
      expect(parse('$110 AP ZT12681')).toMatchObject({ code: 'ZT12681', price: 110 });
    });

    it('skips a lowercase brand', () => {
      expect(parse('$65  adidas   ZT13309')).toMatchObject({ code: 'ZT13309', price: 65 });
    });

    it('skips a model word carrying a single digit', () => {
      expect(parse('AirPods Pro3 HE7160 $30.86')).toMatchObject({ code: 'HE7160', price: 30.86 });
    });

    it('skips several noise tokens before the code', () => {
      expect(parse('$36 SAMSUNG Buds4 pro ZT12645')).toMatchObject({ code: 'ZT12645', price: 36 });
    });

    it('handles an apostrophe in the brand', () => {
      expect(parse("$27.59 Victoria's Secret ZT9359")).toMatchObject({ code: 'ZT9359', price: 27.59 });
    });
  });

  describe('fallbacks', () => {
    it('falls back to the first token when nothing is code-shaped', () => {
      expect(parse('$20 SOMEBRAND')).toMatchObject({ code: 'SOMEBRAND', price: 20 });
    });

    it('still parses a title with no price', () => {
      expect(parse('ZT12681 black leather')).toMatchObject({ code: 'ZT12681', price: 0 });
    });

    it('never returns an empty code for a non-empty title', () => {
      expect(parse('???').code).toBeTruthy();
    });
  });

  it('gives colliding brands distinct codes', () => {
    const a = parse('$110 AP ZT12681').code;
    const b = parse('$120 AP ZT13500').code;
    expect(a).not.toEqual(b);
  });
});
