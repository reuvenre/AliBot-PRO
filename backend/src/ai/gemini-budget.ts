/**
 * Effective maxOutputTokens for a Gemini text call.
 *
 * The caller's maxTokens is a TEXT budget, but Gemini "thinking" models spend their
 * reasoning tokens from the same maxOutputTokens pool. The old formula — a flat floor,
 * Math.max(maxTokens, 2048) — kept short posts from being cut, but it also SWALLOWED the
 * caller's truncation-retry escalation: a cut draft is retried with a doubled budget
 * (700 → 1400 → 1600, capped), and every one of those resolved to the same 2048, so each
 * "retry with a bigger budget" re-ran a byte-identical request that truncated the exact
 * same way, four times in a row, and the campaign published nothing (issue #62).
 *
 * So: grant the thinking allowance ON TOP of the text budget instead of flooring it away.
 * - gemini-2.5-flash / flash-lite: thinking is disabled (budget 0) → no allowance; keep a
 *   1024 text floor so ordinary posts aren't cut on the first call.
 * - gemini-2.5-pro: thinkingBudget is pinned at its 128 minimum → a small allowance.
 * - newer families (3.x+): thinking is dynamic and cannot be disabled → a full 2048
 *   allowance, and the caller's escalation still raises the TOTAL on every retry.
 */
export function geminiOutputBudget(model: string, maxTokens: number): number {
  const isPro = /pro/i.test(model);
  const legacy25 = /2\.5/.test(model);
  const textBudget = Math.max(maxTokens, 1024);
  const thinkingAllowance = legacy25 ? (isPro ? 256 : 0) : 2048;
  return textBudget + thinkingAllowance;
}
