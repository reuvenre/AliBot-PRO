import { normalizeTelegramChatId } from './crypto';

describe('normalizeTelegramChatId', () => {
  it('leaves @username unchanged', () => {
    expect(normalizeTelegramChatId('@mychannel')).toBe('@mychannel');
  });

  it('leaves already-negative IDs unchanged', () => {
    expect(normalizeTelegramChatId('-1001234567890')).toBe('-1001234567890');
  });

  it('prefixes a bare 10+ digit supergroup ID with -100', () => {
    expect(normalizeTelegramChatId('1002382502297')).toBe('-1001002382502297');
  });

  it('returns a short numeric ID unchanged (not a supergroup)', () => {
    expect(normalizeTelegramChatId('12345')).toBe('12345');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTelegramChatId('  @channel  ')).toBe('@channel');
  });

  it('returns the value unchanged when falsy', () => {
    expect(normalizeTelegramChatId('')).toBe('');
    expect(normalizeTelegramChatId(null as any)).toBeNull();
  });
});
