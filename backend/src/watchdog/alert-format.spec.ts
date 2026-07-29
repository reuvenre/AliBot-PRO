import { formatTelegramAlert, MAX_TELEGRAM_DETAILS } from './alert-format';

const base = { key: 'k', title: 'כותרת', body: 'גוף ל-GitHub' };

describe('formatTelegramAlert', () => {
  it('names the affected campaigns instead of only the headline', () => {
    // The whole point: "1 קמפיינים מפרסמים לאט" alone doesn't say WHICH one.
    const msg = formatTelegramAlert({
      ...base,
      title: '1 קמפיינים מפרסמים לאט מהמוגדר',
      details: ['"טקטי בקליק" · מוגדר ~60 דק\' בין פוסטים, בפועל ~120 דק\''],
    });
    expect(msg).toContain('• "טקטי בקליק"');
    expect(msg).toContain('בפועל ~120');
  });

  it('never leaks the GitHub body into the DM', () => {
    // The body carries markdown and investigation hints; the DM has no parse_mode, so
    // markdown would render literally and the hints mean nothing to the owner.
    const msg = formatTelegramAlert({ ...base, details: ['"קמפיין א" · תקוע'] });
    expect(msg).not.toContain('גוף ל-GitHub');
    expect(msg).not.toContain('**');
  });

  it('caps a wide outage so Telegram cannot reject the message', () => {
    const details = Array.from({ length: 40 }, (_, i) => `"קמפיין ${i}" · שקט`);
    const msg = formatTelegramAlert({ ...base, details });
    expect(msg).toContain('"קמפיין 0"');
    expect(msg).not.toContain('"קמפיין 9"');
    expect(msg).toContain(`• ועוד ${40 - MAX_TELEGRAM_DETAILS}…`);
  });

  it('tells the owner to act when no code fix is possible', () => {
    const msg = formatTelegramAlert({
      ...base,
      details: ['"קמפיין א" · מוגדר ל-60 דק\', הקבוצה מגבילה ל-120'],
      action: 'הגדרות ← קבוצות ← שנה "מרווח בין פוסטים".',
    });
    expect(msg).toContain('🔧 נדרשת פעולה שלך:');
    expect(msg).toContain('הגדרות ← קבוצות');
    // Promising a Claude fix for a config problem would be a lie the owner waits on.
    expect(msg).not.toContain('Claude יטפל');
  });

  it('still sends a usable message when a check reports no per-item detail', () => {
    // Security alerts come from another service and carry no details array.
    const msg = formatTelegramAlert({ ...base, title: 'ניסיונות התחברות חריגים' });
    expect(msg).toContain('ניסיונות התחברות חריגים');
    expect(msg).toContain('Claude יטפל');
    expect(msg).not.toContain('•');
  });
});
