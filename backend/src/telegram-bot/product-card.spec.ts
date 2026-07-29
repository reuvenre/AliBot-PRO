import {
  BotProduct, CALLBACK_MAX_BYTES, encodeCallback, formatMoney, matchByPrefix,
  parseCallback, productCaption, truncate,
} from './product-card';

const product: BotProduct = {
  product_id: '1005006123456789',
  title: 'Wireless Bluetooth Headphones Noise Cancelling Over Ear',
  sale_price: 89.9,
  original_price: 149,
  discount_percent: 40,
  orders_count: 3214,
  rating: 4.8,
  currency: 'ILS',
};

describe('formatMoney', () => {
  it('uses the symbol and drops a trailing .00', () => {
    expect(formatMoney(149, 'ILS')).toBe('₪149');
    expect(formatMoney(89.9, 'ILS')).toBe('₪89.90');
    expect(formatMoney(12.5, 'USD')).toBe('$12.50');
  });

  it('falls back to the code for a currency with no symbol', () => {
    expect(formatMoney(10, 'PLN')).toBe('10 PLN');
  });
});

describe('productCaption', () => {
  it('shows the sale price, the original and the discount', () => {
    const caption = productCaption(product, 3);
    expect(caption).toContain('3. Wireless Bluetooth Headphones');
    expect(caption).toContain('💰 ₪89.90 (במקום ₪149, הנחה 40%)');
    expect(caption).toContain('⭐ 4.8');
    expect(caption).toContain('📦 3,214 מכירות');
  });

  it('omits the "was" price when there is no discount', () => {
    const caption = productCaption({ ...product, discount_percent: 0, original_price: 89.9 }, 1);
    expect(caption).toContain('💰 ₪89.90');
    expect(caption).not.toContain('במקום');
  });

  it('leaves out stats the feed did not supply', () => {
    const caption = productCaption({ ...product, rating: 0, orders_count: 0 }, 1);
    expect(caption).not.toContain('⭐');
    expect(caption).not.toContain('📦');
  });

  it('stays within the Telegram caption limit even for a long title', () => {
    const caption = productCaption({ ...product, title: 'x'.repeat(3000) }, 1);
    expect(caption.length).toBeLessThan(1024);
  });
});

describe('truncate', () => {
  it('keeps short text untouched and collapses whitespace', () => {
    expect(truncate('  a   b ', 20)).toBe('a b');
  });

  it('cuts on a word boundary', () => {
    expect(truncate('alpha beta gamma delta', 16)).toBe('alpha beta…');
  });
});

describe('callback payloads', () => {
  it('round-trips an action and its arguments', () => {
    const data = encodeCallback('g', product.product_id, 'a1b2c3d4-0000-4000-8000-000000000001');
    expect(parseCallback(data)).toEqual({
      action: 'g',
      args: [product.product_id, 'a1b2c3d4-0000-4000-8000-000000000001'],
    });
  });

  it('never exceeds Telegram\'s 64-byte limit — it trims the last part instead', () => {
    // Telegram rejects the whole message when callback_data is too long, which would
    // silently break the publish button rather than degrade it.
    const data = encodeCallback('g', '1'.repeat(40), 'a1b2c3d4-0000-4000-8000-000000000001');
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(CALLBACK_MAX_BYTES);
    expect(parseCallback(data).args[0]).toBe('1'.repeat(40));
  });
});

describe('matchByPrefix', () => {
  const groups = [
    { id: 'a1b2c3d4-0000-4000-8000-000000000001' },
    { id: 'f9e8d7c6-0000-4000-8000-000000000002' },
  ];

  it('resolves an id that was trimmed to fit the payload', () => {
    expect(matchByPrefix(groups, 'a1b2c3d4-0000')).toBe(groups[0]);
  });

  it('refuses to guess when the prefix is empty or ambiguous', () => {
    expect(matchByPrefix(groups, '')).toBeNull();
    expect(matchByPrefix([{ id: 'ab1' }, { id: 'ab2' }], 'ab')).toBeNull();
  });
});
