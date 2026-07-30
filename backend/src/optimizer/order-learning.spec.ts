import { SoldProduct, newKeywordsFor, scoreCategories } from './order-learning';

const p = (
  productId: string, orders: number, commissionIls: number,
  category?: string | null, subcategory?: string | null,
): SoldProduct => ({ productId, orders, commissionIls, category, subcategory });

describe('scoreCategories', () => {
  it('aggregates orders and commission per category', () => {
    const scored = scoreCategories([
      p('1', 4, 37.58, 'Tools', 'Multitools'),
      p('2', 2, 24.40, 'Tools', 'Multitools'),
      p('3', 1, 8.50, 'Home', 'Kitchen Gadgets'),
      p('4', 1, 2.00, 'Home', 'Kitchen Gadgets'),
    ]);
    expect(scored[0]).toEqual({
      keyword: 'Multitools', orders: 6, commissionIls: 61.98, products: 2,
    });
  });

  it('ranks by commission, not by order count', () => {
    // The point of the loop is earnings: 2 orders worth ₪60 beat 9 orders worth ₪4.
    const scored = scoreCategories([
      p('1', 1, 30, 'A', 'Expensive'), p('2', 1, 30, 'A', 'Expensive'),
      p('3', 5, 2, 'B', 'Cheap'), p('4', 4, 2, 'B', 'Cheap'),
    ]);
    expect(scored.map((s) => s.keyword)).toEqual(['Expensive', 'Cheap']);
  });

  it('prefers the subcategory, which is actually searchable', () => {
    // "Tools" returns anything; "Multitools" returns the thing that sold.
    const [top] = scoreCategories([
      p('1', 2, 10, 'Tools', 'Multitools'), p('2', 2, 10, 'Tools', 'Multitools'),
    ]);
    expect(top.keyword).toBe('Multitools');
  });

  it('falls back to the top-level category when the feed gave no subcategory', () => {
    const [top] = scoreCategories([
      p('1', 2, 10, 'Sports', null), p('2', 2, 10, 'Sports', undefined),
    ]);
    expect(top.keyword).toBe('Sports');
  });

  it('ignores a category backed by one product and few orders', () => {
    // A single lucky sale is not a category worth publishing into a real channel.
    expect(scoreCategories([p('1', 1, 99, 'Home', 'Curtains')])).toEqual([]);
  });

  it('accepts a single product that sold repeatedly', () => {
    const scored = scoreCategories([p('1', 4, 37.58, 'Tools', 'Multitools')]);
    expect(scored).toHaveLength(1);
    expect(scored[0].orders).toBe(4);
  });

  it('skips products the feed could not classify at all', () => {
    expect(scoreCategories([p('1', 5, 20, null, null), p('2', 5, 20, '', '  ')])).toEqual([]);
  });

  it('handles an empty or missing list', () => {
    expect(scoreCategories([])).toEqual([]);
    expect(scoreCategories(undefined as any)).toEqual([]);
  });
});

describe('newKeywordsFor', () => {
  const scored = scoreCategories([
    p('1', 4, 40, 'Tools', 'Multitools'), p('2', 2, 30, 'Tools', 'Multitools'),
    p('3', 3, 20, 'Outdoor', 'Tactical Backpack'), p('4', 1, 5, 'Outdoor', 'Tactical Backpack'),
    p('5', 2, 9, 'Home', 'Wine Accessories'), p('6', 2, 8, 'Home', 'Wine Accessories'),
  ]);

  it('returns the best categories the campaign does not already search', () => {
    expect(newKeywordsFor(scored, ['tactical backpack'], [], 5).map((c) => c.keyword))
      .toEqual(['Multitools', 'Wine Accessories']);
  });

  it('matches existing keywords case-insensitively', () => {
    expect(newKeywordsFor(scored, ['MULTITOOLS'], [], 1).map((c) => c.keyword))
      .toEqual(['Tactical Backpack']);
  });

  it('never re-adds a keyword the optimizer retired', () => {
    // Retirement is the owner's own history — re-suggesting it would fight the engine.
    expect(newKeywordsFor(scored, [], ['Multitools'], 5).map((c) => c.keyword))
      .toEqual(['Tactical Backpack', 'Wine Accessories']);
  });

  it('caps how many arrive per run', () => {
    // Each new keyword changes what reaches a real channel; a drip stays reviewable.
    expect(newKeywordsFor(scored, [], [], 2)).toHaveLength(2);
    expect(newKeywordsFor(scored, [], [], 0)).toHaveLength(0);
  });

  it('returns nothing when the campaign already covers every winner', () => {
    expect(newKeywordsFor(scored, ['Multitools', 'Tactical Backpack', 'Wine Accessories'], [], 5))
      .toEqual([]);
  });
});
