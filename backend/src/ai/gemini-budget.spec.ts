import { geminiOutputBudget } from './gemini-budget';

describe('geminiOutputBudget', () => {
  it('ESCALATES for thinking models when the caller doubles the budget — the #62 no-op', () => {
    // The old flat floor mapped 700, 1400 and 1600 all to 2048: four byte-identical
    // requests, four identical truncations, a silent campaign.
    const steps = [700, 1400, 1600].map((t) => geminiOutputBudget('gemini-3-flash', t));
    expect(steps[1]).toBeGreaterThan(steps[0]);
    expect(steps[2]).toBeGreaterThan(steps[1]);
  });

  it('grants dynamic-thinking families the full allowance on top of the text budget', () => {
    expect(geminiOutputBudget('gemini-3-flash', 700)).toBe(1024 + 2048);
  });

  it('gives 2.5-flash (thinking disabled) no allowance but keeps the 1024 text floor', () => {
    expect(geminiOutputBudget('gemini-2.5-flash', 400)).toBe(1024);
    expect(geminiOutputBudget('gemini-2.5-flash', 1600)).toBe(1600);
  });

  it('gives 2.5-pro a small allowance for its pinned 128 thinking budget, and still escalates', () => {
    expect(geminiOutputBudget('gemini-2.5-pro', 700)).toBe(1024 + 256);
    expect(geminiOutputBudget('gemini-2.5-pro', 1600)).toBe(1600 + 256);
  });
});
