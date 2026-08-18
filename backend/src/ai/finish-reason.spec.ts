import { finishReasonTruncated } from './finish-reason';

describe('finishReasonTruncated', () => {
  it('recognises each provider vocabulary for a budget cut', () => {
    expect(finishReasonTruncated('max_tokens')).toBe(true);  // Anthropic
    expect(finishReasonTruncated('length')).toBe(true);      // OpenAI
    expect(finishReasonTruncated('MAX_TOKENS')).toBe(true);  // Gemini
  });

  it('treats a normal finish as not truncated', () => {
    expect(finishReasonTruncated('end_turn')).toBe(false);
    expect(finishReasonTruncated('stop')).toBe(false);
    expect(finishReasonTruncated('STOP')).toBe(false);
  });

  it('never flags a missing reason — absence of evidence is not a defect', () => {
    expect(finishReasonTruncated(undefined)).toBe(false);
    expect(finishReasonTruncated(null)).toBe(false);
    expect(finishReasonTruncated('')).toBe(false);
  });
});
