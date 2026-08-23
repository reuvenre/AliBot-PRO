import { BriefInput, buildBrief } from './digest-brief';

const base: BriefInput = {
  dateLabel: '23.08',
  posts: 12, postsArrow: '↑20%',
  clicks: 143, clicksArrow: '↓8%',
  orders: 4, ordersArrow: '↑33%',
  revenueIls: 86,
  portalDayLabel: '22.08',
  bonusOrders: 2, bonusPaidUsd: 5.9,
  actions: [],
};

describe('buildBrief — the report as a glance', () => {
  it('says the whole day in four lines when nothing needed changing', () => {
    const out = buildBrief(base);
    const lines = out.split('\n').filter(Boolean);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain('23.08');
    expect(out).toContain('12 פוסטים↑20%');
    expect(out).toContain('143 קליקים↓8%');
    // The orders line carries the PORTAL's date, not the run's — they are different days.
    expect(out).toContain('4 הזמנות↑33% (22.08)');
    expect(out).toContain('🎁 2 מהבונוס ($5.9)');
    expect(out).toContain('לא נדרש שינוי');
  });

  it('names the changes it made instead of telling the owner what to do', () => {
    const out = buildBrief({
      ...base,
      actions: [
        { id: 'a1', text: '[טקטי בקליק] הוספתי "מטחנת קפה", הוצאתי "שעון חכם"' },
        { id: 'a2', text: '[מאמא מותגים] הכפלתי "מגבות"' },
      ],
    });
    expect(out).toContain('⚡ ביצעתי 2 שינויים:');
    expect(out).toContain('• [טקטי בקליק] הוספתי "מטחנת קפה", הוצאתי "שעון חכם"');
    expect(out).toContain('• [מאמא מותגים] הכפלתי "מגבות"');
    expect(out).not.toContain('ועוד');
  });

  it('collapses a long night into a count rather than a wall', () => {
    // The complaint this file exists to answer: a report that lists everything is a report
    // that gets skimmed. Four named changes, the rest behind the button.
    const actions = Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, text: `שינוי ${i}` }));
    const out = buildBrief({ ...base, actions });
    const bullets = out.split('\n').filter((l) => l.startsWith('•'));
    expect(bullets).toHaveLength(5);          // 4 named + 1 summary
    expect(bullets[4]).toContain('ועוד 5 שינויים');
    expect(out).toContain('⚡ ביצעתי 9 שינויים:');
  });

  it('counts one change in singular — a report that says "1 שינויים" reads as a machine', () => {
    const out = buildBrief({ ...base, actions: [{ id: 'a1', text: 'שינוי יחיד' }] });
    expect(out).toContain('ביצעתי שינוי אחד:');
    const five = buildBrief({
      ...base, maxActions: 1,
      actions: [{ id: '1', text: 'א' }, { id: '2', text: 'ב' }],
    });
    expect(five).toContain('ועוד שינוי אחד');
  });

  it('drops the bonus clause entirely when no bonus order came in', () => {
    // A "🎁 0 מהבונוס" line is noise on every ordinary day.
    const out = buildBrief({ ...base, bonusOrders: 0, bonusPaidUsd: 0 });
    expect(out).not.toContain('🎁');
    expect(out).toContain('4 הזמנות');
  });

  it('omits the portal date when the day could not be determined', () => {
    const out = buildBrief({ ...base, portalDayLabel: null });
    expect(out).toContain('4 הזמנות↑33% · ₪86');
    expect(out).not.toContain('()');
  });

  it('prints a flat figure without an arrow rather than a fake trend', () => {
    const out = buildBrief({ ...base, postsArrow: '', clicksArrow: '', ordersArrow: '' });
    expect(out).toContain('12 פוסטים · 143 קליקים');
  });
});
