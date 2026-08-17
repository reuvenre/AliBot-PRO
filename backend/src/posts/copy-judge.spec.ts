import { parseJudgeVerdict, parseJudgeAnswer } from './copy-judge';

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
