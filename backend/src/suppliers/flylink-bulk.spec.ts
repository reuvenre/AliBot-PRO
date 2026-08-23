import { codeFromResolvedUrl, codesFromTitle, parseBulkLinks, titleFromHtml } from './flylink-bulk';

describe('codesFromTitle — the code the seller wrote into the page title', () => {
  // The real title behind s.flylinking.com/g-XKBRBNHMUD. ₪129.28 on the page against
  // 42.66 here is the day's USD rate — the middle number is the price, not the code.
  const REAL = '6380-42.66-LHYF-High quality pure cotton solid color long-sleeved shirt';

  it('takes the leading segment as the code and never the price', () => {
    const codes = codesFromTitle(REAL);
    expect(codes[0]).toBe('6380');
    expect(codes).not.toContain('42.66');
    expect(codes).not.toContain('42');
  });

  it('also offers the brand-prefixed form, since stores file the same product both ways', () => {
    const codes = codesFromTitle(REAL);
    expect(codes).toContain('LHYF6380');
    expect(codes).toContain('LHYF-6380');
  });

  it('reads a plain letters-then-digits code out of an ordinary title', () => {
    expect(codesFromTitle('LN1526 COACH shoulder bag')).toEqual(['LN1526']);
    expect(codesFromTitle('$56.99 MM-2642001DP COACH')).toContain('MM-2642001DP');
  });

  it('offers nothing rather than a guess when the title has no code', () => {
    expect(codesFromTitle('Welcome to jack-shop')).toEqual([]);
    expect(codesFromTitle('')).toEqual([]);
  });

  it('never repeats a candidate', () => {
    const codes = codesFromTitle('LN1526-10.00-LN1526 bag');
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('titleFromHtml', () => {
  it('reads and unescapes the page title', () => {
    expect(titleFromHtml('<html><head><title>6380-42.66-LHYF-Shirt &amp; more</title></head>'))
      .toBe('6380-42.66-LHYF-Shirt & more');
  });

  it('survives a page with no title instead of throwing', () => {
    expect(titleFromHtml('<html><body>hi</body></html>')).toBe('');
    expect(titleFromHtml('')).toBe('');
  });

  it('collapses a title broken across lines', () => {
    expect(titleFromHtml('<title>\n  6380-42.66-LHYF\n  Shirt\n</title>')).toBe('6380-42.66-LHYF Shirt');
  });
});

describe('parseBulkLinks — however the paste arrives', () => {
  it('reads a plain column of links', () => {
    const { entries, skipped } = parseBulkLinks(
      'https://s.flylinking.com/g-XKBRBNHMUD\nhttps://s.flylinking.com/g-YDER0F6RLK',
    );
    expect(entries.map((e) => e.url)).toEqual([
      'https://s.flylinking.com/g-XKBRBNHMUD',
      'https://s.flylinking.com/g-YDER0F6RLK',
    ]);
    expect(entries.every((e) => e.code === '')).toBe(true);
    expect(skipped).toEqual([]);
  });

  it('takes the code either side of the link, and through any separator', () => {
    const { entries } = parseBulkLinks([
      'MM-2642001DP\thttps://s.flylinking.com/g-AAAAAAAAAA',
      'https://s.flylinking.com/g-BBBBBBBBBB , AP12681',
      'ZT9004; https://s.flylinking.com/g-CCCCCCCCCC',
    ].join('\n'));
    expect(entries.map((e) => e.code)).toEqual(['MM-2642001DP', 'AP12681', 'ZT9004']);
  });

  it('never reads the shortener\'s own token as a product code', () => {
    // "g-XKBRBNHMUD" has the shape of a code. Reading it would link the product to an
    // album that does not exist — silently, and for every line.
    const { entries } = parseBulkLinks('https://s.flylinking.com/g-XKBRBNHMUD');
    expect(entries[0].code).toBe('');
  });

  it('ignores a brand word standing next to the link', () => {
    // "COACH" is what Yupoo titles carry beside the code; it is not an identifier.
    const { entries } = parseBulkLinks('COACH https://s.flylinking.com/g-DDDDDDDDDD');
    expect(entries[0].code).toBe('');
  });

  it('keeps a duplicated link once and says so, so the counts add up', () => {
    const { entries, duplicates } = parseBulkLinks([
      'https://s.flylinking.com/g-AAAAAAAAAA',
      'https://s.flylinking.com/g-AAAAAAAAAA',
      'https://S.FLYLINKING.COM/g-aaaaaaaaaa'.toLowerCase(),
    ].join('\n'));
    expect(entries).toHaveLength(1);
    expect(duplicates).toBe(2);
  });

  it('names the lines it could not use instead of failing the batch', () => {
    // Rejecting a hundred good links over one stray header line would defeat the point.
    const { entries, skipped } = parseBulkLinks([
      'קישורים לייבוא:',
      'https://s.flylinking.com/g-AAAAAAAAAA',
      '',
      'עוד משהו',
    ].join('\n'));
    expect(entries).toHaveLength(1);
    expect(skipped).toEqual([1, 4]);   // the blank line is formatting, not a failure
  });

  it('reports the line number the owner can actually see', () => {
    const { entries } = parseBulkLinks('\n\nhttps://s.flylinking.com/g-AAAAAAAAAA');
    expect(entries[0].line).toBe(3);
  });

  it('strips punctuation a paste dragged along', () => {
    const { entries } = parseBulkLinks('(https://s.flylinking.com/g-AAAAAAAAAA),');
    expect(entries[0].url).toBe('https://s.flylinking.com/g-AAAAAAAAAA');
  });
});

describe('codeFromResolvedUrl — the code behind the short link', () => {
  it('reads a code out of the destination path', () => {
    expect(codeFromResolvedUrl('https://da.flylinking.com/product/MM-2642001DP'))
      .toBe('MM-2642001DP');
  });

  it('prefers the path over the query string', () => {
    // A campaign id shaped like a code would otherwise win and mis-link the product.
    expect(codeFromResolvedUrl('https://da.flylinking.com/p/AP12681?cid=XX99999&store=CW'))
      .toBe('AP12681');
  });

  it('falls back to an explicit product parameter', () => {
    expect(codeFromResolvedUrl('https://da.flylinking.com/detail?code=ZT12681&ref=abc'))
      .toBe('ZT12681');
    expect(codeFromResolvedUrl('https://da.flylinking.com/detail?sku=MM-2642001'))
      .toBe('MM-2642001');
  });

  it('never mistakes the short token for the product', () => {
    expect(codeFromResolvedUrl('https://s.flylinking.com/g-XKBRBNHMUD')).toBe('');
  });

  it('returns nothing rather than a guess when the destination carries no code', () => {
    expect(codeFromResolvedUrl('https://da.flylinking.com/store/CWYXGIX2MO')).toBe('');
    expect(codeFromResolvedUrl('not a url')).toBe('');
    expect(codeFromResolvedUrl('')).toBe('');
  });
});
