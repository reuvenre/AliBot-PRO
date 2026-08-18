/**
 * What to do after an Instagram publish call times out.
 *
 * A timeout on `media_publish` is the one genuinely ambiguous failure in the whole send
 * path: the request may have reached Instagram and only the reply was lost, so retrying
 * risks a duplicate post — which is why it was never retried, and why it kept surfacing as
 * a "published partially" alert that no automation could clear.
 *
 * But the ambiguity is only ours. Instagram knows: the media CONTAINER carries a
 * status_code, and it turns PUBLISHED the moment the media goes live. So instead of
 * guessing, ask the container — and the answer is authoritative in both directions.
 */

export type PublishVerdict = 'published' | 'retry' | 'unknown';

/**
 * @param statusCode the container's `status_code`, or undefined when the check itself failed
 */
export function publishTimeoutVerdict(statusCode: string | null | undefined): PublishVerdict {
  const code = String(statusCode || '').trim().toUpperCase();
  // It went live. The timed-out call DID land — treat the send as the success it was.
  if (code === 'PUBLISHED') return 'published';
  // Processed and waiting: nothing was published, so publishing again cannot duplicate.
  if (code === 'FINISHED' || code === 'IN_PROGRESS') return 'retry';
  // ERROR, EXPIRED, or no answer at all — say nothing and let the caller fail loudly
  // rather than invent an outcome.
  return 'unknown';
}
