import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import sharp from 'sharp';
import { igFetchHeaders, igFitBox, isIgFittableHost, unwrapOwnProxy } from './instagram-image';

/**
 * Serves an Instagram-legal variant of a product photo: the original letterboxed onto the
 * nearest allowed canvas (see instagram-image.ts for why letterbox, not crop). Instagram
 * ingests images by URL, so the padded variant has to be publicly fetchable — this is that
 * URL. The send path only points Instagram here when the original's ratio is illegal.
 *
 * PUBLIC (no JWT) on purpose — Instagram's fetcher cannot authenticate. SSRF is contained
 * the same way the Yupoo proxy contains it: a strict host allowlist (the product-image
 * CDNs this system publishes, nothing else), no redirects, and a size cap.
 */
@Controller('posts')
export class InstagramImageController {
  @Get('ig-image')
  async igImage(@Query('src') src: string, @Res() res: Response) {
    const target = unwrapOwnProxy(String(src || ''));
    let host = '';
    try { host = new URL(target).hostname; } catch { throw new BadRequestException('bad url'); }
    if (!isIgFittableHost(host)) throw new BadRequestException('forbidden host');

    const upstream = await axios.get(target, {
      responseType: 'arraybuffer',
      // Never follow redirects — the initial host is validated, a redirect target is not.
      maxRedirects: 0,
      headers: igFetchHeaders(host),
      timeout: 12000, maxContentLength: 8 * 1024 * 1024, validateStatus: () => true,
    });
    if (upstream.status !== 200) { res.status(502).send('image unavailable'); return; }

    const buf = Buffer.from(upstream.data);
    try {
      const meta = await sharp(buf).metadata();
      const box = igFitBox(meta.width, meta.height);
      // Already legal → stream the original bytes untouched. The endpoint is idempotent to
      // call on any image, so a stale link to it never breaks a post.
      if (!box) {
        res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
        res.setHeader('Cache-Control', 'public, max-age=604800');
        res.send(buf);
        return;
      }
      const padded = await sharp(buf)
        .resize(box.width, box.height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.send(padded);
    } catch {
      // Unreadable image data → give Instagram the original and let it say so; a broken
      // pad step must not turn a maybe-fine image into a certain failure.
      res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
      res.send(buf);
    }
  }
}
