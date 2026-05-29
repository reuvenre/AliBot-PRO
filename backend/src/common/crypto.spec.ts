import { encrypt, decrypt, mask } from './crypto';

describe('encrypt / decrypt', () => {
  it('round-trips a plain string', () => {
    const plain = 'my-secret-api-key-12345';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces different ciphertext for the same input (random IV)', () => {
    const plain = 'same-value';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('returns empty string unchanged', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('returns the original value when ciphertext is not valid base64 (migration safety)', () => {
    expect(decrypt('not-encrypted')).toBe('not-encrypted');
  });
});

describe('mask', () => {
  it('masks the middle of a long value', () => {
    expect(mask('abcdefgh12345678')).toBe('abcd****5678');
  });

  it('returns **** for short values', () => {
    expect(mask('abc')).toBe('****');
    expect(mask('')).toBe('****');
  });
});
