import { stripInlineLink } from './strip-inline-link';

const URL = 'https://flylink.example/p/abc123';

describe('stripInlineLink', () => {
  it('removes the URL and its orphaned 🔗 line (the FLYLINK spacing bug)', () => {
    const text = `נעלי ריצה מעולות\n\n💰 ₪172\n\n🔗 ${URL}`;
    expect(stripInlineLink(text, URL)).toBe('נעלי ריצה מעולות\n\n💰 ₪172');
  });

  it('drops a 🔗 line that carries an invisible RLM from a previous rtl pass', () => {
    const text = `כותרת\n\n‏🔗 ${URL}`;
    expect(stripInlineLink(text, URL)).toBe('כותרת');
  });

  it('keeps surrounding text when the URL sits mid-sentence', () => {
    const text = `לחצו כאן: ${URL} עכשיו`;
    expect(stripInlineLink(text, URL)).toBe('לחצו כאן:  עכשיו');
  });

  it('collapses the blank-line run the removal leaves behind', () => {
    const text = `שורה\n\n🔗 ${URL}\n\nעוד שורה`;
    expect(stripInlineLink(text, URL)).toBe('שורה\n\nעוד שורה');
  });

  it('returns the text untouched when the URL is absent or empty', () => {
    expect(stripInlineLink('טקסט רגיל', URL)).toBe('טקסט רגיל');
    expect(stripInlineLink('טקסט רגיל', '')).toBe('טקסט רגיל');
  });

  it('leaves a 🔗 line pointing at a DIFFERENT link alone', () => {
    const text = `🔗 https://other.example/x\n${URL}`;
    expect(stripInlineLink(text, URL)).toBe('🔗 https://other.example/x');
  });
});
