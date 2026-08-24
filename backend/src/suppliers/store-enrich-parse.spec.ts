import { EMPTY_ENRICHMENT, hasAnything, parseEnrichment } from './store-enrich-parse';

describe('parseEnrichment', () => {
  it('reads the answer the agent was asked for', () => {
    expect(parseEnrichment('{"name":"נעלי ניו באלנס 9060","category":"נעליים","brand":"New Balance"}'))
      .toEqual({ name: 'נעלי ניו באלנס 9060', category: 'נעליים', brand: 'New Balance' });
  });

  it('digs the answer out of a fenced block with a sentence in front', () => {
    // "Usually JSON" is not a contract.
    const raw = 'בטח! הנה הפרטים:\n```json\n{"name":"תיק קואץ\'","category":"תיקים","brand":"COACH"}\n```';
    expect(parseEnrichment(raw).category).toBe('תיקים');
    expect(parseEnrichment(raw).brand).toBe('COACH');
  });

  it('stops at the matching brace, not at a later one', () => {
    const raw = '{"name":"שעון רולקס","category":"שעונים","brand":"Rolex"} — מקווה שעזרתי {:';
    expect(parseEnrichment(raw).name).toBe('שעון רולקס');
  });

  it('accepts Hebrew keys, since that is the language it was asked in', () => {
    expect(parseEnrichment('{"שם":"חגורת גוצ\'י","קטגוריה":"חגורות","מותג":"Gucci"}'))
      .toEqual({ name: 'חגורת גוצי', category: 'חגורות', brand: 'Gucci' });
  });

  it('refuses a category outside the fixed list instead of inventing a menu entry', () => {
    // Free-form categories split one shelf across four filter entries.
    expect(parseEnrichment('{"name":"סניקרס","category":"הנעלה ספורטיבית","brand":"Nike"}').category).toBe('');
    expect(parseEnrichment('{"name":"סניקרס","category":"נעליים","brand":"Nike"}').category).toBe('נעליים');
  });

  it('drops an "unknown" rather than printing it on a card', () => {
    const out = parseEnrichment('{"name":"לא ידוע","category":"נעליים","brand":"N/A"}');
    expect(out.name).toBe('');
    expect(out.brand).toBe('');
    expect(out.category).toBe('נעליים');
  });

  it('caps a name that would not fit a card', () => {
    const long = 'א'.repeat(200);
    expect(parseEnrichment(`{"name":"${long}","category":"","brand":""}`).name.length).toBe(60);
  });

  it('shrugs at anything unparseable instead of throwing mid-batch', () => {
    expect(parseEnrichment('סליחה, אני לא בטוח')).toEqual(EMPTY_ENRICHMENT);
    expect(parseEnrichment('{"name": broken')).toEqual(EMPTY_ENRICHMENT);
    expect(parseEnrichment('')).toEqual(EMPTY_ENRICHMENT);
  });
});

describe('hasAnything', () => {
  it('is false only when the agent produced nothing at all', () => {
    expect(hasAnything(EMPTY_ENRICHMENT)).toBe(false);
    expect(hasAnything({ name: '', category: 'נעליים', brand: '' })).toBe(true);
  });
});
