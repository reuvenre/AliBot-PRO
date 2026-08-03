import { isTelegramConnectionError, telegramErrorText } from './telegram-retry';

/** Node's Happy Eyeballs failure shape: empty message, no own code, codes in errors[]. */
function aggregateConnectError(codes: string[]): AggregateError {
  return new AggregateError(codes.map((code) => Object.assign(new Error(`connect ${code}`), { code })), '');
}

describe('isTelegramConnectionError', () => {
  it('retries the connection reset that lost a real post', () => {
    // The exact failure that dropped a campaign post: Render→Telegram reset the socket, the
    // scheduler had already spent the group's slot, and the product was never published.
    expect(isTelegramConnectionError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBe(true);
  });

  it('retries a DNS failure — the request never left the box', () => {
    expect(isTelegramConnectionError(Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }))).toBe(true);
  });

  it('does NOT retry a timeout, which may already have published', () => {
    // Telegram can publish and lose only the reply. Resending posts the product to the
    // group twice — worse than the miss it would be papering over.
    expect(isTelegramConnectionError(Object.assign(new Error('timeout of 30000ms exceeded'), { code: 'ECONNABORTED' }))).toBe(false);
    expect(isTelegramConnectionError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toBe(false);
  });

  it('does NOT retry anything Telegram answered', () => {
    // An API verdict is the caller's to handle (plain-text fallback on a parse error,
    // hard failure otherwise) — a blind resend would skip that entirely.
    const rejected = { code: 'ECONNRESET', response: { status: 400, data: { description: "can't parse entities" } } };
    expect(isTelegramConnectionError(rejected)).toBe(false);
    expect(isTelegramConnectionError({ response: { status: 429 } })).toBe(false);
  });

  it('does NOT retry an unconfirmed delivery', () => {
    // assertTelegramDelivered throws a plain Error with no code; something may have gone
    // out, so resending it could duplicate.
    expect(isTelegramConnectionError(new Error('טלגרם לא אישרה את השליחה (photo): no message_id'))).toBe(false);
  });

  it('survives a malformed error object', () => {
    expect(isTelegramConnectionError(undefined)).toBe(false);
    expect(isTelegramConnectionError({})).toBe(false);
  });

  it('retries an AggregateError whose every inner failure is connection-level', () => {
    // Node v18+ tries IPv4 + IPv6; when both connects die it throws an AggregateError with
    // an EMPTY message and NO top-level code — the failure that produced a blank
    // "Telegram: " error_message and, because this check missed it, never got its retry.
    expect(isTelegramConnectionError(aggregateConnectError(['ECONNREFUSED', 'ENETUNREACH']))).toBe(true);
  });

  it('does NOT retry an AggregateError containing any non-connection failure', () => {
    const mixed = new AggregateError([
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
    ], '');
    expect(isTelegramConnectionError(mixed)).toBe(false);
    expect(isTelegramConnectionError(new AggregateError([], ''))).toBe(false);
  });
});

describe('telegramErrorText', () => {
  it('prefers the API description Telegram answered with', () => {
    expect(telegramErrorText({ message: 'Request failed', response: { data: { description: 'chat not found' } } }))
      .toBe('chat not found');
  });

  it('falls back to the error message', () => {
    expect(telegramErrorText(new Error('read ECONNRESET'))).toBe('read ECONNRESET');
  });

  it('never returns empty for an AggregateError — names the inner codes', () => {
    // The blank "Telegram: " bug: empty message hid what happened from the owner AND the
    // watchdog. The inner connect codes are the diagnosis, so surface them.
    const text = telegramErrorText(aggregateConnectError(['ECONNREFUSED', 'ENETUNREACH']));
    expect(text).toContain('ECONNREFUSED');
    expect(text).toContain('ENETUNREACH');
    expect(text.length).toBeGreaterThan(0);
  });

  it('says "connection failure" when there is truly nothing else to report', () => {
    expect(telegramErrorText({})).toContain('שגיאת חיבור לטלגרם');
  });
});
