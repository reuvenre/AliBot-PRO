/**
 * Did the provider stop because it ran OUT OF TOKEN BUDGET (as opposed to finishing)?
 *
 * A budget-cut draft genuinely ends mid-sentence — the copy judge then rejects it as
 * truncated, and it is right. Before this flag existed those drafts were judged anyway,
 * burning a generation attempt on an outcome that was decided before the judge ever saw
 * it (issue #59: a pin draft hit the cap, the judge said "נקטע באמצע", and the campaign's
 * only retry was spent re-rolling instead of re-rolling WITH MORE ROOM).
 *
 * Provider vocabularies: Anthropic `stop_reason: "max_tokens"`, OpenAI
 * `finish_reason: "length"`, Gemini `finishReason: "MAX_TOKENS"`.
 */
export function finishReasonTruncated(reason: string | null | undefined): boolean {
  return /^(max_tokens|length)$/i.test(String(reason || '').trim());
}
