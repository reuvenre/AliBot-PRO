/**
 * Boot-time environment validation. A missing JWT/encryption secret used to let the
 * app boot "healthy" and then 500 on the first login or credential read; here we fail
 * fast at startup instead. Enforced only in production so local/dev/test still run
 * with a partial .env.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  if (config.NODE_ENV !== 'production') return config;

  const errors: string[] = [];
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ENCRYPTION_KEY',
    'FRONTEND_URL',
  ];
  for (const key of required) {
    const v = config[key];
    if (!v || String(v).trim() === '') errors.push(`${key} is required`);
  }

  // ENCRYPTION_KEY must be a 32-byte hex key (64 hex chars) for AES-256.
  const enc = config.ENCRYPTION_KEY ? String(config.ENCRYPTION_KEY) : '';
  if (enc && !/^[0-9a-fA-F]{64}$/.test(enc)) {
    errors.push('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  // Google OAuth is optional, but half-configured means silent login failure — flag it.
  const hasGoogleId = !!config.GOOGLE_CLIENT_ID;
  const hasGoogleSecret = !!config.GOOGLE_CLIENT_SECRET;
  if (hasGoogleId !== hasGoogleSecret) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set (or both unset)');
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}
