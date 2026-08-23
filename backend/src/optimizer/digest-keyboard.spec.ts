import {
  CALLBACK_MAX_BYTES, CB_DETAIL, CB_UNDO, callback, digestKeyboard, trimButton, undoKeyboard,
} from './digest-keyboard';

const size = (s: string) => Buffer.byteLength(s, 'utf8');

describe('digest keyboard', () => {
  const UUID = '3f1c9b7e-2d44-4a10-9f0e-8c7a1b2d3e4f';

  it('carries the run id so the detail button opens THIS report', () => {
    const [row] = digestKeyboard(UUID, 'https://app.example.com');
    expect(row[0].callback_data).toBe(`${CB_DETAIL}:${UUID}`);
    expect(row[1].callback_data).toBe('ol');
  });

  it('keeps every payload inside Telegram\'s 64-byte limit', () => {
    // Over the limit Telegram rejects the WHOLE message — the report would vanish, not
    // just the button.
    for (const row of digestKeyboard(UUID, 'https://app.example.com')) {
      for (const b of row) if (b.callback_data) expect(size(b.callback_data)).toBeLessThanOrEqual(CALLBACK_MAX_BYTES);
    }
    const long = 'x'.repeat(200);
    expect(size(callback(CB_UNDO, long))).toBeLessThanOrEqual(CALLBACK_MAX_BYTES);
    // ...and it degrades to the bare prefix rather than a truncated id that would address
    // somebody else's row.
    expect(callback(CB_UNDO, long)).toBe(CB_UNDO);
  });

  it('still offers the detail button when the run row failed to save', () => {
    const [row] = digestKeyboard(null, 'https://app.example.com');
    expect(row[0].callback_data).toBe(CB_DETAIL);
  });

  it('links to the dashboard only when the app URL is real', () => {
    expect(digestKeyboard(UUID, 'https://app.example.com/')).toHaveLength(2);
    expect(digestKeyboard(UUID, 'https://app.example.com/')[1][0].url)
      .toBe('https://app.example.com/optimizer');
    // A button pointing at "undefined/optimizer" is worse than no button.
    expect(digestKeyboard(UUID, '')).toHaveLength(1);
    expect(digestKeyboard(UUID, 'not-a-url')).toHaveLength(1);
  });

  it('gives one undo row per change and always a way out', () => {
    const rows = undoKeyboard([
      { id: 'a1', text: '[טקטי] הוספתי "מטחנת קפה"' },
      { id: 'a2', text: '[מאמא] הכפלתי "מגבות"' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0][0].callback_data).toBe('ou:a1');
    expect(rows[2][0].callback_data).toBe('x');
  });

  it('caps the list rather than sending a keyboard of forty buttons', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `a${i}`, text: `שינוי ${i}` }));
    expect(undoKeyboard(many)).toHaveLength(9); // 8 changes + close
  });

  it('trims a long caption itself instead of letting Telegram cut mid-keyword', () => {
    const long = '[מאמא מותגים] הוספתי "מטחנת קפה חשמלית", הוצאתי "שעון חכם לילדים"';
    const out = trimButton(long);
    expect(out.length).toBeLessThanOrEqual(42);
    expect(out.endsWith('…')).toBe(true);
    expect(trimButton('קצר')).toBe('קצר');
  });
});
