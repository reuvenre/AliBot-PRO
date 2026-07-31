import { isTelegramConnectionError } from './telegram-retry';

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
});
