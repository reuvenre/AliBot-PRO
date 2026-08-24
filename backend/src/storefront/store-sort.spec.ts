import { DEFAULT_SORT, normalizeSort, priceBounds, sorter } from './store-sort';

const p = (over: Partial<{ price: number; at: string | null; title: string }>) => ({
  id: 'x', title: 't', brand: null, image: null, gallery: [], currency: 'USD',
  source: 'supplier' as const, group: null, price: 10, at: '2026-08-01T00:00:00.000Z',
  ...over,
}) as any;

describe('normalizeSort', () => {
  it('accepts the orderings the panel offers', () => {
    expect(normalizeSort('price_asc')).toBe('price_asc');
    expect(normalizeSort('oldest')).toBe('oldest');
  });

  it('falls back rather than trusting a query string', () => {
    expect(normalizeSort('; DROP TABLE')).toBe(DEFAULT_SORT);
    expect(normalizeSort(undefined)).toBe(DEFAULT_SORT);
  });
});

describe('sorter', () => {
  const items = [
    p({ price: 30, at: '2026-08-03T00:00:00.000Z', title: 'c' }),
    p({ price: 10, at: '2026-08-01T00:00:00.000Z', title: 'a' }),
    p({ price: 20, at: '2026-08-02T00:00:00.000Z', title: 'b' }),
  ];

  it('puts the cheapest first for "price: low to high"', () => {
    expect([...items].sort(sorter('price_asc')).map((i) => i.price)).toEqual([10, 20, 30]);
  });

  it('puts the dearest first for "price: high to low"', () => {
    expect([...items].sort(sorter('price_desc')).map((i) => i.price)).toEqual([30, 20, 10]);
  });

  it('defaults to newest first', () => {
    expect([...items].sort(sorter()).map((i) => i.title)).toEqual(['c', 'b', 'a']);
  });

  it('sorts oldest first when asked', () => {
    expect([...items].sort(sorter('oldest')).map((i) => i.title)).toEqual(['a', 'b', 'c']);
  });

  it('sends an undated product to the END of both date orderings', () => {
    // A supplier row that has never been posted has no date. Treating that as "ancient"
    // would park the whole unpublished half of a catalog at the front of oldest-first.
    const withNull = [...items, p({ at: null, title: 'unknown' })];
    expect([...withNull].sort(sorter('oldest')).map((i) => i.title)).toEqual(['a', 'b', 'c', 'unknown']);
    expect([...withNull].sort(sorter('newest')).map((i) => i.title)).toEqual(['c', 'b', 'a', 'unknown']);
  });
});

describe('priceBounds', () => {
  it('rounds outward so the cheapest product stays inside its own slider', () => {
    // Rounding inward means the shopper drags to the floor and the item that defined
    // the floor vanishes.
    expect(priceBounds([{ price: 10.4 }, { price: 99.2 }])).toEqual({ min: 10, max: 100 });
  });

  it('ignores products with no price rather than pinning the floor at zero', () => {
    expect(priceBounds([{ price: 0 }, { price: 55 }, { price: 70 }])).toEqual({ min: 55, max: 70 });
  });

  it('answers zeroes for an empty shelf instead of Infinity', () => {
    expect(priceBounds([])).toEqual({ min: 0, max: 0 });
    expect(priceBounds([{ price: 0 }])).toEqual({ min: 0, max: 0 });
  });
});
