import { frictionProducts, pickTopAction, trendArrow, type ActionInputs } from './digest-insights';

const base: ActionInputs = {
  groups: [], friction: [], silentCampaigns: [],
  orders: 0, bonusOrders: 0, hasBonusPools: false, enoughSignal: true,
};

describe('trendArrow', () => {
  it('marks a real rise and a real fall', () => {
    expect(trendArrow(4, 2)).toBe(' ↑100%');
    expect(trendArrow(1, 2)).toBe(' ↓50%');
  });

  it('calls small movement steady — a report that cries wolf stops being read', () => {
    expect(trendArrow(21, 20)).toBe(' ⟷');
  });

  it('claims nothing without a baseline instead of printing a triumphant first day', () => {
    expect(trendArrow(5, 0)).toBe('');
  });
});

describe('pickTopAction', () => {
  it('puts a silent campaign above every optimisation', () => {
    // Nothing else in the report matters while a group is getting nothing.
    const action = pickTopAction({
      ...base,
      silentCampaigns: ['קמפיין Pinterest'],
      friction: [{ title: 'X', clicks: 40 }],
      groups: [{ name: 'A', posts: 1, clicks: 90 }, { name: 'B', posts: 50, clicks: 5 }],
    });
    expect(action).toContain('קמפיין Pinterest');
  });

  it('names the group whose attention outruns its posting share', () => {
    const action = pickTopAction({
      ...base,
      groups: [
        { name: 'טקטי בקליק', posts: 5, clicks: 80 },
        { name: 'מאמא מותגים', posts: 45, clicks: 20 },
      ],
    });
    expect(action).toContain('טקטי בקליק');
    expect(action).toContain('תדירות');
  });

  it('stays silent on a balanced account rather than inventing an action', () => {
    // The line only keeps its force if it is absent on days with nothing to say.
    expect(pickTopAction({
      ...base,
      groups: [{ name: 'A', posts: 20, clicks: 30 }, { name: 'B', posts: 20, clicks: 28 }],
    })).toBeNull();
  });

  it('ignores group balance on thin volume — 2 posts and 3 clicks prove nothing', () => {
    expect(pickTopAction({
      ...base,
      groups: [{ name: 'A', posts: 1, clicks: 3 }, { name: 'B', posts: 2, clicks: 0 }],
    })).toBeNull();
  });

  it('names a product that drew clicks and sold nothing', () => {
    const action = pickTopAction({ ...base, friction: [{ title: 'שעון טקטי', clicks: 12 }] });
    expect(action).toContain('שעון טקטי');
    expect(action).toContain('12');
  });

  it('flags bonus pools producing nothing — only when pools actually exist', () => {
    expect(pickTopAction({ ...base, hasBonusPools: true, orders: 4, bonusOrders: 0 }))
      .toContain('מסלולי הבונוס');
    expect(pickTopAction({ ...base, hasBonusPools: false, orders: 4, bonusOrders: 0 }))
      .toBeNull();
  });

  it('turns "not enough data" into an action, and only as the last resort', () => {
    expect(pickTopAction({ ...base, enoughSignal: false })).toContain('מספיק קליקים');
    // A concrete finding still outranks it.
    expect(pickTopAction({ ...base, enoughSignal: false, friction: [{ title: 'P', clicks: 9 }] }))
      .toContain('P');
  });
});

describe('frictionProducts', () => {
  it('keeps only products with real clicks and no order, worst first', () => {
    expect(frictionProducts([
      { title: 'A', clicks: 12, orders: 0 },
      { title: 'B', clicks: 30, orders: 2 },  // sold — not friction
      { title: 'C', clicks: 2, orders: 0 },   // too few clicks to mean anything
      { title: 'D', clicks: 20, orders: 0 },
    ])).toEqual([{ title: 'D', clicks: 20 }, { title: 'A', clicks: 12 }]);
  });

  it('caps the list — three named products is advice, twenty is a spreadsheet', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ title: `P${i}`, clicks: 10 + i, orders: 0 }));
    expect(frictionProducts(rows)).toHaveLength(3);
  });
});
