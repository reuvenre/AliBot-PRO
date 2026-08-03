import { CollageService } from './collage.service';

const sharp = require('sharp') as typeof import('sharp').default;

/**
 * boundJpeg is the guard between the AI image model's output and the Telegram upload:
 * the model answers in PNG at native resolution, and uploading that raw is what blew the
 * 120s album-upload timeout. These tests pin the envelope: always JPEG, never over 1440px.
 */
describe('CollageService.boundJpeg', () => {
  const svc = new CollageService();

  it('shrinks an oversized PNG into the ≤1440px JPEG envelope', async () => {
    const bigPng = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#3355aa' } })
      .png().toBuffer();
    const out = await svc.boundJpeg(bigPng);
    expect(out).not.toBeNull();
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1440);
    expect(out!.length).toBeLessThan(bigPng.length);
  });

  it('does not enlarge an image already inside the envelope', async () => {
    const small = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#ffffff' } })
      .png().toBuffer();
    const out = await svc.boundJpeg(small);
    const meta = await sharp(out!).metadata();
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(400);
    expect(meta.format).toBe('jpeg');
  });

  it('returns null for bytes that are not an image (caller falls back to the studio pass)', async () => {
    expect(await svc.boundJpeg(Buffer.from('not an image'))).toBeNull();
  });
});
