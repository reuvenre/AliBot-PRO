import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length !== 64) {
    // In dev without key set, use a deterministic fallback (NOT for prod)
    return Buffer.alloc(32, 'dev-key-fallback');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plain: string): string {
  if (!plain) return plain;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  try {
    const key = getKey();
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final('utf8');
  } catch {
    return ciphertext; // not encrypted yet (migration safety)
  }
}

export function mask(value: string): string {
  if (!value || value.length < 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

/**
 * Telegram channels/supergroups require a negative ID prefixed with -100.
 * Users often copy just the numeric part (e.g. 1002382502297) — auto-fix it.
 */
export function normalizeTelegramChatId(id: string): string {
  if (!id) return id;
  const trimmed = id.trim();
  if (trimmed.startsWith('@')) return trimmed;       // @username — fine as-is
  if (trimmed.startsWith('-')) return trimmed;        // already negative — fine
  if (/^\d{10,}$/.test(trimmed)) return `-100${trimmed}`;  // supergroup/channel missing prefix
  return trimmed;
}
