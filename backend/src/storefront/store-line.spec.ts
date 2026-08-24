import { STORE_LINE_MARK, hasStoreLine, storeLine } from './store-line';

const URL = 'https://nexlify.win-solutions.co.il/s/hidden-brand';

describe('storeLine', () => {
  it('invites the reader to the rest of the catalog, naming the store', () => {
    expect(storeLine({ url: URL, name: 'Hidden Brand' }))
      .toBe(`${STORE_LINE_MARK} כל המוצרים שלנו במקום אחד — Hidden Brand:\n${URL}`);
  });

  it('drops the name rather than printing a dangling dash', () => {
    expect(storeLine({ url: URL })).toBe(`${STORE_LINE_MARK} כל המוצרים שלנו במקום אחד:\n${URL}`);
    expect(storeLine({ url: URL, name: '   ' })).not.toContain('—');
  });

  it('writes English for an English body', () => {
    expect(storeLine({ url: URL, name: 'Hidden Brand', hebrew: false }))
      .toContain('All our products in one place — Hidden Brand:');
  });

  it('produces nothing at all without an address — never a bare heading', () => {
    expect(storeLine({ url: '' })).toBe('');
    expect(storeLine({ url: '   ', name: 'Hidden Brand' })).toBe('');
  });

  it('puts the address on its own line so clients linkify it', () => {
    const [, second] = storeLine({ url: URL, name: 'X' }).split('\n');
    expect(second).toBe(URL);
  });
});

describe('hasStoreLine', () => {
  it('sees a line this module wrote', () => {
    expect(hasStoreLine(`טקסט\n\n${storeLine({ url: URL, name: 'X' })}`, URL)).toBe(true);
  });

  it('sees an address pasted by hand into a template, with no emoji', () => {
    // Otherwise an owner whose footer template already links the store gets it twice.
    expect(hasStoreLine(`בואו לבקר: ${URL}`, URL)).toBe(true);
  });

  it('sees an old line whose store has since been renamed', () => {
    // The address changed; the emoji is what stops the second copy.
    expect(hasStoreLine(`${STORE_LINE_MARK} כל המוצרים שלנו:\nhttps://old/s/x`, URL)).toBe(true);
  });

  it('says no on an ordinary post body', () => {
    expect(hasStoreLine('מוצר נהדר ב-₪99\n🔗 https://s.click.aliexpress.com/e/_abc', URL)).toBe(false);
    expect(hasStoreLine('', URL)).toBe(false);
  });
});
