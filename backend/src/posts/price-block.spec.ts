import {
  formatOrders, mentionsPrice, priceLine, priceProofBlock, proofLine,
} from './price-block';

const base = {
  symbol: '₪', priceLocal: '39', originalLocal: '78', discount: 50,
  rating: 4.8, ordersCount: 3214, language: 'he',
};

describe('priceLine', () => {
  it('anchors the price against the original when the saving is real', () => {
    expect(priceLine(base)).toBe('💰 <b>₪39</b> במקום <s>₪78</s> · חוסך 50%');
  });

  it('drops the anchor when the "discount" is not worth naming', () => {
    // A 5% markdown dressed up as a deal reads as spin; show the price alone.
    expect(priceLine({ ...base, originalLocal: '41', discount: 5 })).toBe('💰 <b>₪39</b>');
  });

  it('drops the anchor when the original is not actually higher', () => {
    // Seen in the feed: original_price equal to (or below) sale_price.
    expect(priceLine({ ...base, originalLocal: '39', discount: 40 })).toBe('💰 <b>₪39</b>');
  });

  it('follows the currency the caller priced in', () => {
    expect(priceLine({ ...base, symbol: '$', priceLocal: '12', originalLocal: '24', language: 'en' }))
      .toBe('💰 <b>$12</b> was <s>$24</s> · save 50%');
  });
});

describe('proofLine', () => {
  it('shows rating and orders together', () => {
    expect(proofLine(base)).toBe('⭐ 4.8 · 🛒 3.2K קנו');
  });

  it('hides an order count too small to vouch for anything', () => {
    expect(proofLine({ ...base, ordersCount: 7 })).toBe('⭐ 4.8');
  });

  it('hides a rating that argues against the product', () => {
    expect(proofLine({ ...base, rating: 3.1 })).toBe('🛒 3.2K קנו');
  });

  it('returns nothing when neither figure helps', () => {
    expect(proofLine({ ...base, rating: 0, ordersCount: 0 })).toBe('');
  });
});

describe('formatOrders', () => {
  it('rounds to K only once the count is big', () => {
    expect(formatOrders(3214)).toBe('3.2K');
    expect(formatOrders(1000)).toBe('1.0K');
    expect(formatOrders(940)).toBe('940');
  });
});

describe('priceProofBlock', () => {
  it('stacks the price over the proof', () => {
    expect(priceProofBlock(base)).toBe('💰 <b>₪39</b> במקום <s>₪78</s> · חוסך 50%\n⭐ 4.8 · 🛒 3.2K קנו');
  });

  it('is just the price line when there is no usable proof', () => {
    expect(priceProofBlock({ ...base, rating: 0, ordersCount: 0 }))
      .toBe('💰 <b>₪39</b> במקום <s>₪78</s> · חוסך 50%');
  });
});

describe('mentionsPrice', () => {
  // The migration guard: existing templates print their own price line, and the block must
  // not double it. A template migrates by deleting that line — no flag, no code change.
  it('detects the current template\'s own price line', () => {
    expect(mentionsPrice('💥 מחיר מבצע: 39₪ בלבד!', '₪', '39')).toBe(true);
  });

  it('detects the symbol-first form', () => {
    expect(mentionsPrice('רק ₪39 היום', '₪', '39')).toBe(true);
  });

  it('detects a price the template rounded differently', () => {
    expect(mentionsPrice('💥 מחיר מבצע: 40₪ בלבד!', '₪', '39')).toBe(true);
  });

  it('is false for copy that names no price', () => {
    const copy = `תיק טקטי מתקפל שנכנס לכל כיס

✔️ נירוסטה עמידה בשטח
✔️ נפתח ביד אחת`;
    expect(mentionsPrice(copy, '₪', '39')).toBe(false);
  });

  it('is false for empty copy', () => {
    expect(mentionsPrice('', '₪', '39')).toBe(false);
  });
});
