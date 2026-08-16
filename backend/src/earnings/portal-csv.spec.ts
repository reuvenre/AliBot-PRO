import { parsePortalCsv, splitCsvLine } from './portal-csv';

const HEADER = '"CompletedPaymentsTime","CompletedOrderTime","CompletedSettlementTime","OrderID",'
  + '"SubOrderID","ProductId","ProductTitle","ProductURL","SellerId","OrderStatus",'
  + '"CommissionRate","SettledCurrency","CompletedPaymentsAmount","EstimatedPaymentsCommission"';

const row = (order: string, sub: string, title = 'Storage Box') =>
  `"2026-08-15 13:41:17",,,"${order}","${sub}","1005009484634077","${title}",`
  + '"https://x","6000007597","Completed Payments","7.0%","USD","5.51","0.38"';

describe('splitCsvLine', () => {
  it('keeps a comma that lives inside a quoted product title', () => {
    // Every AliExpress title has commas in it — a naive split() would shift every
    // column after the title and silently read the wrong id.
    expect(splitCsvLine('"a","Pack of 4, Sink Cover, Black","c"'))
      .toEqual(['a', 'Pack of 4, Sink Cover, Black', 'c']);
  });

  it('unescapes a doubled quote', () => {
    expect(splitCsvLine('"say ""hi""","b"')).toEqual(['say "hi"', 'b']);
  });
});

describe('parsePortalCsv', () => {
  it('reads the portal export at SUB-order grain — the same key the sync stores', () => {
    const rows = parsePortalCsv([HEADER, row('1122173844768681', '1122173844778681')].join('\n'));
    expect(rows).toHaveLength(1);
    expect(rows[0].sub_order_id).toBe('1122173844778681');
    expect(rows[0].order_id).toBe('1122173844768681');
    expect(rows[0].commission_usd).toBeCloseTo(0.38);
  });

  it('keeps sibling sub-orders of ONE parent order apart', () => {
    // The real export carries the same parent order three times with three sub-orders
    // (one basket, three items). Collapsing them would invent a discrepancy.
    const rows = parsePortalCsv([
      HEADER,
      row('1122173844768681', '1122173844778681'),
      row('1122173844768681', '1122173844788681'),
      row('1122173844768681', '1122173844798681'),
    ].join('\n'));
    expect(rows.map((r) => r.sub_order_id)).toEqual([
      '1122173844778681', '1122173844788681', '1122173844798681',
    ]);
  });

  it('counts a re-pasted row once', () => {
    const rows = parsePortalCsv([
      HEADER, row('1122173844768681', '1122173844778681'), row('1122173844768681', '1122173844778681'),
    ].join('\n'));
    expect(rows).toHaveLength(1);
  });

  it('accepts a bare list of ids copied out of the portal', () => {
    const rows = parsePortalCsv('1122173844778681\n1122173844788681\n');
    expect(rows.map((r) => r.sub_order_id)).toEqual(['1122173844778681', '1122173844788681']);
  });

  it('reads order,sub pairs in the portal\'s own column order when headerless', () => {
    const rows = parsePortalCsv('1122173844768681,1122173844778681');
    expect(rows[0]).toMatchObject({ order_id: '1122173844768681', sub_order_id: '1122173844778681' });
  });

  it('ignores prices and other short numbers', () => {
    expect(parsePortalCsv('5.51, 0.38, 7.0%')).toEqual([]);
  });

  it('returns nothing for junk instead of throwing', () => {
    expect(parsePortalCsv('')).toEqual([]);
    expect(parsePortalCsv('שלום')).toEqual([]);
  });
});
