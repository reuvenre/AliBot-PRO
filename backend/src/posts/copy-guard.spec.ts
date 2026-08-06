import { copyDefect } from './copy-guard';

/** The exact text that reached the "טקטי בקליק" Telegram group on 30/07 at 07:02. */
const PUBLISHED_GARBAGE = `תיק טקטי מתקפל ועמיד לפעילויות חוץ וטיולים".
            Wait, what if the instruction literally means: fill \`[מחיר]\`, but keep the structure and emojis exactly?
            Let's re-read:
            "• שכפל/י את נוסח התבנית שלמעלה מילה במילה — כולל השור`;

/** Real copy from the same run that was correct — the false-positive guard. */
const GOOD_HE = `🔥 הכלי האולטימטיבי שחובה לקחת לכל טיול וקמפינג הקיץ!

✔️ מולטי-טול מתקפל ועמיד העשוי מנירוסטה איכותית
✔️ משלב פלייר, סכין ומגוון כלים חיוניים במוצר אחד
✔️ עיצוב נייד וקומפקטי שנכנס בקלות לכל תיק או כיס
💥 מחיר מבצע: 13₪ בלבד!
מהרו לפני שנגמר →`;

describe('copyDefect', () => {
  it('rejects the scratchpad that actually got published', () => {
    expect(copyDefect(PUBLISHED_GARBAGE)).not.toBeNull();
  });

  it('accepts the real copy from the same campaign run', () => {
    expect(copyDefect(GOOD_HE)).toBeNull();
  });

  it('catches our own system prompt echoed back', () => {
    expect(copyDefect('שכפל/י את נוסח התבנית שלמעלה מילה במילה — כולל השורות הקבועות'))
      .toMatch(/prompt leaked/);
  });

  it('catches the model thinking out loud', () => {
    expect(copyDefect("Let's re-read the template and try again, it says three bullets"))
      .toMatch(/model reasoning/);
    expect(copyDefect('Wait, but the price placeholder should stay bracketed here'))
      .toMatch(/model reasoning/);
  });

  it('catches a placeholder the model never filled', () => {
    const skeleton = `🔥 כותרת מושכת

✔️ יתרון ראשון של המוצר
✔️ יתרון שני של המוצר
💥 מחיר מבצע: [מחיר]₪ בלבד!
מהרו לפני שנגמר →`;
    expect(copyDefect(skeleton)).toBe('unfilled placeholder');
  });

  it('rejects empty and stub responses', () => {
    expect(copyDefect('')).toBe('empty');
    expect(copyDefect('   ')).toBe('empty');
    expect(copyDefect('מוצר מעולה')).toBe('too short');
  });

  it('does not trip on legitimate English marketing copy', () => {
    // Pinterest/US campaigns generate English on purpose — it must survive the guard.
    const pin = `Upgrade your camping kit with this stainless steel folding multi-tool.
Pliers, knife and screwdrivers in one pocket-sized body. Only $4.20 — grab it now!`;
    expect(copyDefect(pin)).toBeNull();
  });

  it('does not trip on copy that merely contains the word wait', () => {
    // "wait" alone is ordinary marketing urgency; only deliberation phrases are defects.
    expect(copyDefect("Don't wait — this deal ends tonight and stock is limited! 🔥"))
      .toBeNull();
    expect(copyDefect('אל תחכו — המבצע נגמר הלילה ויש מלאי מוגבל! 🔥')).toBeNull();
  });
});

describe('word-index numbering (the 06/08 מאמא post)', () => {
  it('rejects copy with an ascending counter interleaved between the words', () => {
    // Reconstruction of the text that reached the channel verbatim.
    const numbered = '💰 ₪7 (76) בלבד (77) במקום (78) ₪17 (79) (56% (80) הנחה)! (81) '
      + 'אזהרת (82) מלאי: (83) במחיר (84) כזה (85) היחידות (86) נחטפות';
    expect(copyDefect(numbered)).toBe('word-index numbering');
  });

  it('does not flag legitimate parenthesised numbers in real copy', () => {
    expect(copyDefect('💰 ₪7 בלבד במקום ₪17 (56% הנחה)! סט (2) חלקים לבחירה — מלאי מוגבל!')).toBeNull();
  });

  it('does not flag a short non-consecutive scatter of numbers', () => {
    expect(copyDefect('דירוג (5) כוכבים, (120) הזמנות, חיסכון של (30) אחוז — שווה בדיקה עכשיו!')).toBeNull();
  });
});
