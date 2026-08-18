import { parseJudgeVerdict, parseJudgeAnswer, trimForJudge } from './copy-judge';

describe('parseJudgeVerdict', () => {
  it('reads a clean verdict either way', () => {
    expect(parseJudgeVerdict('OK')).toBe('ok');
    expect(parseJudgeVerdict('BAD')).toBe('bad');
    expect(parseJudgeVerdict('  ok  ')).toBe('ok');
  });

  it('accepts a verdict with trailing chatter (models add reasons)', () => {
    expect(parseJudgeVerdict('BAD — contains a self-review checklist')).toBe('bad');
    expect(parseJudgeVerdict('OK. Clean marketing copy.')).toBe('ok');
  });

  it('anything unclear is unknown — the caller fails OPEN and publishes', () => {
    expect(parseJudgeVerdict('')).toBe('unknown');
    expect(parseJudgeVerdict(null)).toBe('unknown');
    expect(parseJudgeVerdict(undefined)).toBe('unknown');
    expect(parseJudgeVerdict('I think this post is fine')).toBe('unknown');
  });
});

describe('parseJudgeAnswer', () => {
  it('names the criterion that fired, in the owner\'s language', () => {
    // "not clean marketing copy" named the GATE, not the defect — when a campaign produced
    // 0 posts for hours, there was nothing in the message to act on.
    expect(parseJudgeAnswer('BAD truncated')).toEqual({
      verdict: 'bad', reason: 'הטקסט נקטע באמצע',
    });
    expect(parseJudgeAnswer('BAD: placeholder').reason).toContain('מצייני מקום');
  });

  it('falls back to a generic reason when the judge names none', () => {
    // Older prompts (and a terse model) answer a bare BAD — still a rejection.
    expect(parseJudgeAnswer('BAD')).toEqual({ verdict: 'bad', reason: 'פסילה כללית של השופט' });
    expect(parseJudgeAnswer('BAD wobble').reason).toBe('פסילה כללית של השופט');
  });

  it('carries no reason when the draft passed', () => {
    expect(parseJudgeAnswer('OK')).toEqual({ verdict: 'ok', reason: '' });
    expect(parseJudgeAnswer('')).toEqual({ verdict: 'unknown', reason: '' });
  });
});

describe('trimForJudge', () => {
  it('hands a normal draft through untouched', () => {
    const pin = 'Kitchen Sponge Holder\n\nKeeps the sink tidy. Only $5.61.\n\n#kitchen #home';
    expect(trimForJudge(pin)).toBe(pin);
  });

  it('cuts at a line boundary, never mid-word', () => {
    // The bug: a raw slice made the judge see a text that genuinely stops mid-sentence,
    // and it answered "truncated" — our own trim read back as the draft's defect (#56).
    const text = `${'a'.repeat(40)}\n${'b'.repeat(40)}\n${'c'.repeat(40)}`;
    const out = trimForJudge(text, 90);
    expect(out.endsWith('…')).toBe(true);
    expect(out.split('\n').filter((l) => l.startsWith('b'))[0]).toHaveLength(40);
  });

  it('marks the cut with the character the judge is told to ignore', () => {
    expect(trimForJudge('x'.repeat(200), 100)).toMatch(/…$/);
  });

  it('keeps most of the draft when no boundary is near the cap', () => {
    const out = trimForJudge(`start.\n${'x'.repeat(300)}`, 100);
    expect(out.length).toBeGreaterThan(90);
  });

  it('survives an empty draft', () => {
    expect(trimForJudge('')).toBe('');
  });
});
