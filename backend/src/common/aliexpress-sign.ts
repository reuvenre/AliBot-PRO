import * as crypto from 'crypto';

/**
 * Signs an AliExpress TOP API request.
 * Adds timestamp, sign_method, v, and sign to the params.
 * Ref: https://developers.aliexpress.com/en/doc.htm?docId=101617&docType=1
 */
export function signAliexpress(
  params: Record<string, any>,
  appSecret: string,
): Record<string, string> {
  const base: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ),
    timestamp: String(Date.now()),
    sign_method: 'md5',
    v: '2.0',
  };

  // Sort alphabetically, concatenate key+value
  const sorted = Object.keys(base).sort();
  const content = appSecret + sorted.map((k) => `${k}${base[k]}`).join('') + appSecret;

  base.sign = crypto.createHash('md5').update(content, 'utf8').digest('hex').toUpperCase();
  return base;
}
