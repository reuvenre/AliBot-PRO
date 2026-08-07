import { parseJudgeVerdict } from './copy-judge';

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
