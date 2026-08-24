import { DEFAULT_DETAILS_TEXT, DEFAULT_SHIPPING_TEXT, storeTexts } from './store-defaults';

describe('storeTexts', () => {
  it('ships the defaults to a store whose owner has written nothing', () => {
    // The two most-read sections on a product page. Empty by default would mean every
    // product ships missing them until somebody remembers.
    expect(storeTexts({})).toEqual({
      shipping_text: DEFAULT_SHIPPING_TEXT,
      details_text: DEFAULT_DETAILS_TEXT,
    });
    expect(storeTexts({ shipping_text: null, details_text: null }).shipping_text)
      .toBe(DEFAULT_SHIPPING_TEXT);
  });

  it('prefers the owner\'s own words', () => {
    const mine = storeTexts({ shipping_text: 'אצלנו שולחים ביד', details_text: 'הכל מקורי' });
    expect(mine.shipping_text).toBe('אצלנו שולחים ביד');
    expect(mine.details_text).toBe('הכל מקורי');
  });

  it('treats a cleared field as "reset", not as "publish an empty section"', () => {
    expect(storeTexts({ shipping_text: '   \n  ' }).shipping_text).toBe(DEFAULT_SHIPPING_TEXT);
  });

  it('answers the two questions every buyer asks', () => {
    // Where is my package, and what am I actually getting.
    expect(DEFAULT_SHIPPING_TEXT).toContain('17track.net');
    expect(DEFAULT_SHIPPING_TEXT).toContain('my.flylinking.com');
    expect(DEFAULT_DETAILS_TEXT).toContain('החזרים');
  });
});
