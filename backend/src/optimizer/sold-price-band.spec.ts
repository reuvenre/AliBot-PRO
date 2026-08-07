import { MIN_ORDERS_FOR_BAND, inBand, preferInBand, soldPriceBand } from './sold-price-band';

describe('soldPriceBand', () => {
  it('refuses a verdict below the order floor — taste is not proof', () => {
    expect(soldPriceBand([10, 20, 30])).toBeNull();
    expect(soldPriceBand([])).toBeNull();
  });

  it('finds the band most purchases fall between', () => {
    // 20 orders from $5 to $100; the p20–p80 band cuts the extremes off.
    const amounts = [5, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 26, 28, 30, 35, 40, 60, 80, 100];
    const band = soldPriceBand(amounts)!;
    expect(band.low).toBeGreaterThanOrEqual(10);
    expect(band.high).toBeLessThanOrEqual(60);
    expect(band.median).toBeGreaterThan(band.low);
    expect(band.orders).toBe(20);
  });

  it('ignores junk amounts (nulls, zeros, strings that are not numbers)', () => {
    const amounts = [...Array(MIN_ORDERS_FOR_BAND).fill(20), null, 0, -5, 'abc'] as any[];
    const band = soldPriceBand(amounts)!;
    expect(band.orders).toBe(MIN_ORDERS_FOR_BAND);
    expect(band.low).toBe(20);
    expect(band.high).toBe(20);
  });
});

describe('inBand / preferInBand', () => {
  const band = { low: 10, high: 40, median: 20, orders: 50 };

  it('accepts prices inside (with a small edge tolerance) and rejects far-out ones', () => {
    expect(inBand(15, band)).toBe(true);
    expect(inBand(9.5, band)).toBe(true);   // within the 10% tolerance
    expect(inBand(43, band)).toBe(true);    // within the 10% tolerance
    expect(inBand(80, band)).toBe(false);
    expect(inBand(2, band)).toBe(false);
    expect(inBand(NaN, band)).toBe(false);
  });

  it('partitions stably — in-band first, upstream order preserved, nothing dropped', () => {
    const pool = [
      { id: 'a', price: 100 }, { id: 'b', price: 15 }, { id: 'c', price: 3 }, { id: 'd', price: 30 },
    ];
    const out = preferInBand(pool, (p) => p.price, band);
    expect(out.map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(out).toHaveLength(4);
  });

  it('no band → pool untouched (exploration must survive a thin account)', () => {
    const pool = [{ id: 'a', price: 100 }, { id: 'b', price: 15 }];
    expect(preferInBand(pool, (p) => p.price, null)).toBe(pool);
  });
});
