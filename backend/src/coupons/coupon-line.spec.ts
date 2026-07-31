import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CouponsService, currencySymbol } from './coupons.service';
import { Coupon } from './coupon.entity';
import { AiService } from '../ai/ai.service';
import { CredentialsService } from '../credentials/credentials.service';

const coupon = (over: Partial<Coupon> = {}): Coupon =>
  ({ code: 'ILAFF3', discount_usd: 7, min_spend_usd: 55, ...over } as Coupon);

describe('couponLine', () => {
  let svc: CouponsService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: getRepositoryToken(Coupon), useValue: {} },
        { provide: AiService, useValue: {} },
        { provide: CredentialsService, useValue: {} },
      ],
    }).compile();
    svc = mod.get(CouponsService);
  });

  const ils = { rate: 3.7, symbol: '₪' };

  it('prices the tier in the post currency', () => {
    // $7 off $55 at 3.7 → ₪25 off ₪204. A shopper reading a shekel price above should not
    // have to convert a dollar tier to find out whether they qualify.
    const line = svc.couponLine(coupon(), true, ils);
    expect(line).toContain('₪25');
    expect(line).toContain('₪204');
    expect(line).not.toContain('$');
  });

  it('rounds the minimum spend UP and the discount DOWN', () => {
    // AliExpress enforces the tier in USD at its own rate — ours is a guide. Overstating
    // the saving or understating the threshold sends a shopper to a rejected coupon.
    const line = svc.couponLine(coupon({ discount_usd: 7.9, min_spend_usd: 55.1 }), true, ils);
    expect(line).toContain('₪29');   // floor(29.23)
    expect(line).toContain('₪204');  // ceil(203.87)
  });

  it('never rewrites the code itself', () => {
    // The code is typed at AliExpress checkout. A prettier code is a code that fails.
    expect(svc.couponLine(coupon(), true, ils)).toContain('ILAFF3');
  });

  it('separates the offer from the code, offer first', () => {
    // Packed onto one line the code sat mid-sentence and the eye had nothing to separate
    // what you get from the thing you have to copy.
    const [offer, code] = svc.couponLine(coupon(), true, ils).split('\n');
    expect(offer).toContain('₪25');
    expect(offer).toContain('₪204');
    expect(offer).not.toContain('ILAFF3');
    expect(code).toContain('ILAFF3');
    // The code line carries nothing but the code — nothing to misread as part of it.
    expect(code).not.toContain('₪');
  });

  it('puts the add-an-item nudge last, after the code', () => {
    const lines = svc.couponLine(coupon(), false, ils).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('הוסף עוד פריט');
  });

  it('keeps the add-an-item nudge when the order is below the tier', () => {
    const line = svc.couponLine(coupon(), false, ils);
    expect(line).toContain('הוסף עוד פריט');
    expect(svc.couponLine(coupon(), true, ils)).not.toContain('הוסף עוד פריט');
  });

  it('stays in dollars when no currency was given', () => {
    const line = svc.couponLine(coupon(), true);
    expect(line).toContain('$7');
    expect(line).toContain('$55');
  });

  it('falls back to dollars rather than mislabelling a dollar amount', () => {
    // A shekel sign on an unconverted number is worse than an honest dollar sign.
    for (const money of [{ rate: 0, symbol: '₪' }, { rate: NaN, symbol: '₪' },
      { rate: -3, symbol: '₪' }]) {
      const line = svc.couponLine(coupon(), true, money);
      expect(line).toContain('$7');
      expect(line).not.toContain('₪');
    }
  });

  it('leaves a USD-priced campaign in USD', () => {
    const line = svc.couponLine(coupon(), true, { rate: 1, symbol: '$' });
    expect(line).toContain('$7');
    expect(line).toContain('$55');
  });
});

describe('currencySymbol', () => {
  it('maps a rates pair to its sign', () => {
    expect(currencySymbol('USD_ILS')).toBe('₪');
    expect(currencySymbol('USD_EUR')).toBe('€');
    expect(currencySymbol('USD_GBP')).toBe('£');
    expect(currencySymbol('USD_USD')).toBe('$');
  });

  it('defaults to shekels when unset, matching the account default', () => {
    expect(currencySymbol(null)).toBe('₪');
    expect(currencySymbol(undefined)).toBe('₪');
  });
});
