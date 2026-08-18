import { buildCouponSequence, ladderLines, sanitizeHook } from './coupon-sequence';

/**
 * The real batch this feature was designed around: the owner's August ladder,
 * 17.08 16:21 → 27.08 08:00 Israel time.
 */
const TIERS = [
  { code: 'ILAFF02', discount_usd: 5, min_spend_usd: 35 },
  { code: 'ILAFF01', discount_usd: 3, min_spend_usd: 15 },
  { code: 'ILAFF03', discount_usd: 9, min_spend_usd: 59 },
];
const STARTS = new Date('2026-08-17T13:21:00.000Z'); // 16:21 Israel
const ENDS = new Date('2026-08-27T05:00:00.000Z');   // 08:00 Israel
const BEFORE = new Date('2026-08-15T10:00:00.000Z');

const build = (over: Partial<Parameters<typeof buildCouponSequence>[0]> = {}) =>
  buildCouponSequence({ tiers: TIERS, startsAt: STARTS, endsAt: ENDS, now: BEFORE, ...over });

describe('buildCouponSequence', () => {
  it('builds the full four-stage arc for a ten-day window', () => {
    expect(build().map((p) => p.stage)).toEqual(['teaser', 'launch', 'mid', 'urgency']);
  });

  it('places the teaser the EVENING BEFORE — the cart built tonight closes tomorrow', () => {
    const teaser = build().find((p) => p.stage === 'teaser')!;
    expect(teaser.sendAt.toISOString()).toBe('2026-08-16T15:00:00.000Z'); // 18:00 Israel
    expect(teaser.body).toContain('למלא את העגלה');
  });

  it('never announces the launch before the codes actually work', () => {
    // The window opens 16:21 — a 09:30 launch post would advertise codes that still fail
    // at checkout for seven hours.
    const launch = build().find((p) => p.stage === 'launch')!;
    expect(launch.sendAt.getTime()).toBe(STARTS.getTime());
  });

  it('fires the urgency post 12 hours before the codes die', () => {
    const urgency = build().find((p) => p.stage === 'urgency')!;
    expect(urgency.sendAt.toISOString()).toBe('2026-08-26T17:00:00.000Z');
    expect(urgency.body).toContain('פוקעים');
  });

  it('sorts the ladder cheapest-first whatever order the rows arrived in', () => {
    const ladder = ladderLines(TIERS);
    const order = [...ladder.matchAll(/ILAFF0(\d)/g)].map((m) => m[1]);
    expect(order).toEqual(['1', '2', '3']);
  });

  it('skips stages that are already behind us instead of scheduling into the past', () => {
    // Owner imports mid-window (the common real case: codes copied after launch day).
    const midImport = new Date('2026-08-20T10:00:00.000Z');
    const stages = build({ now: midImport }).map((p) => p.stage);
    expect(stages).toEqual(['mid', 'urgency']);
  });

  it('drops the mid stage for a short window — three posts in four days is spam', () => {
    const shortEnd = new Date(STARTS.getTime() + 3 * 24 * 3600_000);
    expect(build({ endsAt: shortEnd }).map((p) => p.stage)).toEqual(['teaser', 'launch', 'urgency']);
  });

  it('anchors the mid post in a concrete product when one was found', () => {
    const mid = build({
      anchor: {
        title: 'Kitchen Organizer Rack', priceUsd: 38.5, tierMin: 35, code: 'ILAFF02',
        saveUsd: 5, link: 'https://nexlify.app/r/Ab12',
      },
    }).find((p) => p.stage === 'mid')!;
    expect(mid.body).toContain('Kitchen Organizer Rack');
    expect(mid.body).toContain('$38.5');
    expect(mid.body).toContain('https://nexlify.app/r/Ab12');
  });

  it('returns nothing for an empty batch or a window that already closed', () => {
    expect(build({ tiers: [] })).toEqual([]);
    expect(build({ now: new Date('2026-08-28T00:00:00.000Z') })).toEqual([]);
  });
});

describe('sanitizeHook', () => {
  it('accepts a clean one-liner', () => {
    expect(sanitizeHook('🎉 הפתעה מתוקה לכל החוסכים שלנו')).toBe('🎉 הפתעה מתוקה לכל החוסכים שלנו');
  });

  it('rejects any digit — a model-invented number beside a code-built ladder is the one defect this design forbids', () => {
    expect(sanitizeHook('חסכו עד 25% היום!')).toBe('🎁 חדשות טובות לחוסכים:');
  });

  it('rejects rambles and empties', () => {
    expect(sanitizeHook('א'.repeat(200))).toBe('🎁 חדשות טובות לחוסכים:');
    expect(sanitizeHook('')).toBe('🎁 חדשות טובות לחוסכים:');
    expect(sanitizeHook(null)).toBe('🎁 חדשות טובות לחוסכים:');
  });

  it('keeps only the first line of a chatty answer', () => {
    expect(sanitizeHook('שורה ראשונה\nהסבר מיותר')).toBe('שורה ראשונה');
  });
});

describe('currency conversion', () => {
  const ILS = { rate: 3.4, symbol: '₪' };

  it('renders the ladder in shekels — the group reads every other price in shekels too', () => {
    const ladder = ladderLines(TIERS, ILS);
    // Same rounding contract as the product-post coupon line: minimum spend UP
    // (ceil(15·3.4)=51), discount DOWN (floor(3·3.4)=10) — never a rejected coupon.
    expect(ladder).toContain('קנייה מעל ₪51 → הנחה של ₪10');
    expect(ladder).not.toContain('$');
  });

  it('converts every stage body, codes untouched', () => {
    for (const post of build({ money: ILS })) {
      expect(post.body).not.toContain('$');
      expect(post.body).toContain('₪');
      expect(post.body).toContain('ILAFF01'); // the literal checkout code survives
    }
  });

  it('converts the mid-post anchor example, price rounding UP so it never dips below its tier', () => {
    const mid = build({
      money: ILS,
      anchor: {
        title: 'Kitchen Organizer Rack', priceUsd: 38.5, tierMin: 35, code: 'ILAFF02',
        saveUsd: 5, link: 'https://nexlify.app/r/Ab12',
      },
    }).find((p) => p.stage === 'mid')!;
    expect(mid.body).toContain('₪131'); // ceil(38.5·3.4)
    expect(mid.body).toContain('₪119'); // ceil(35·3.4)
    expect(mid.body).toContain('₪17');  // floor(5·3.4)
  });

  it('falls back to honest USD when no usable rate arrived', () => {
    // A shekel sign against an unconverted dollar amount would be worse than dollars.
    expect(ladderLines(TIERS, { rate: 0, symbol: '₪' })).toContain('$15');
    expect(ladderLines(TIERS, null)).toContain('$15');
  });
});

describe('deals-page link', () => {
  const URL = 'https://s.click.aliexpress.com/e/_c35ibUZZ';

  it('rides EVERY stage — the reader lands where all the offers live', () => {
    for (const post of build({ dealsUrl: URL })) {
      expect(post.body).toContain(URL);
    }
  });

  it('leaves no orphan label when no link was configured', () => {
    for (const post of build()) {
      expect(post.body).not.toContain('בעמוד אחד');
    }
  });
});
