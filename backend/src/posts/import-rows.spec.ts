import { composeImportText, extractAliProductId, extractAliProductIdFromHtml, validImportRow } from './import-rows';

describe('validImportRow', () => {
  it('needs a name and an http link', () => {
    expect(validImportRow({ title: 'אפוד טקטי', benefits: [], link: 'https://s.click.aliexpress.com/e/_x' })).toBe(true);
    expect(validImportRow({ title: '', benefits: [], link: 'https://x' })).toBe(false);
    expect(validImportRow({ title: 'משהו', benefits: [], link: 'not a link' })).toBe(false);
    expect(validImportRow(null)).toBe(false);
  });
});

describe('composeImportText', () => {
  const row = {
    title: 'אפוד טקטי מקצועי',
    benefits: ['איכות חומרים גבוהה', 'נוחות ללא פשרות', ''],
    link: 'https://s.click.aliexpress.com/e/_x',
  };

  it('composes the classic template from the file copy', () => {
    const text = composeImportText(row, 122);
    expect(text).toBe(
      '🔥 אפוד טקטי מקצועי\n\n✔️ איכות חומרים גבוהה\n✔️ נוחות ללא פשרות\n\n💥 מחיר מבצע: ₪122 בלבד!\nמהרו לפני שנגמר ←',
    );
  });

  it('omits the price line when no real price was resolved — never invent a number', () => {
    const text = composeImportText(row, null);
    expect(text).not.toContain('₪');
    expect(text).toContain('מהרו לפני שנגמר');
  });

  it('a row with no benefits still yields a valid short post', () => {
    const text = composeImportText({ title: 'מוצר', benefits: [], link: 'https://x' }, null);
    expect(text).toBe('🔥 מוצר\nמהרו לפני שנגמר ←');
  });

  it('strips a leading ✔️ the file already put in the benefit cell — no double checkmark', () => {
    const text = composeImportText(
      { title: 'אפוד', benefits: ['✔️ איכות הבד ותפרים ברמה גבוהה', '✔️נוחות ללא פשרות'], link: 'https://x' },
      null,
    );
    expect(text).toContain('✔️ איכות הבד ותפרים ברמה גבוהה');
    expect(text).toContain('✔️ נוחות ללא פשרות');
    expect(text).not.toContain('✔️ ✔️');
    expect(text).not.toContain('✔️✔️');
  });
});

describe('extractAliProductId', () => {
  it('reads the id from a resolved item URL', () => {
    expect(extractAliProductId('https://www.aliexpress.com/item/1005006789012345.html?src=x')).toBe('1005006789012345');
    expect(extractAliProductId('https://he.aliexpress.com/item/1005001234567890.html')).toBe('1005001234567890');
  });

  it('reads the id from redirect-style params', () => {
    expect(extractAliProductId('https://star.aliexpress.com/share?productId=1005009999&x=1')).toBe('1005009999');
  });

  it('reads the id out of a percent-encoded redirectUrl hop (the real short-link chain)', () => {
    expect(extractAliProductId(
      'https://star.aliexpress.com/share/share.htm?platform=AE&businessType=ProductDetail' +
      '&redirectUrl=https%3A%2F%2Fwww.aliexpress.com%2Fitem%2F1005006789012345.html%3FsrcSns%3Dsns_Copy',
    )).toBe('1005006789012345');
  });

  it('null when there is nothing to extract (the unresolved short link)', () => {
    expect(extractAliProductId('https://s.click.aliexpress.com/e/_olyx8oz')).toBeNull();
  });
});

describe('extractAliProductIdFromHtml', () => {
  it('finds the item URL inside a JS-redirect page', () => {
    const html = '<html><script>window.location.href="https://www.aliexpress.com/item/1005001112223334.html?x=1";</script></html>';
    expect(extractAliProductIdFromHtml(html)).toBe('1005001112223334');
  });

  it('finds a percent-encoded item URL in the markup', () => {
    const html = '<a href="/redirect?to=https%3A%2F%2Fhe.aliexpress.com%2Fitem%2F1005009998887776.html">…</a>';
    expect(extractAliProductIdFromHtml(html)).toBe('1005009998887776');
  });

  it('finds a productId property in inline data', () => {
    expect(extractAliProductIdFromHtml('<script>var d={"productId":"1005004445556667"};</script>')).toBe('1005004445556667');
  });

  it('null on a page with no product reference', () => {
    expect(extractAliProductIdFromHtml('<html><body>שגיאה</body></html>')).toBeNull();
  });
});
