import { BadRequestException, Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { igFetchHeaders, igFitBox, isIgFittableHost, isOwnUploadedUrl, unwrapOwnProxy } from './instagram-image';
import { buildPinOverlaySvg, PIN_H, PIN_IMAGE_H, PIN_W } from './pin-frame';
// sharp's runtime is CommonJS (module.exports = sharp) but its types use `export default`,
// and this tsconfig has NO esModuleInterop — so `import sharp from 'sharp'` compiles to
// `sharp_1.default`, which is UNDEFINED at runtime. Every sharp() call here then threw
// "sharp_1.default is not a function", the catch blocks swallowed it, and this endpoint
// served ORIGINAL bytes — the letterbox NEVER actually padded anything, which is exactly
// how #36003 kept recurring "despite the fix". Same trap collage.service.ts documents.
const sharp = require('sharp') as typeof import('sharp').default;
import { PostsService } from './posts.service';

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
  private readonly logger = new Logger(InstagramImageController.name);

  constructor(private readonly posts: PostsService) {}

  /**
   * The DESIGNED frame (studio/AI enhancement, collage sheet) prepared for a post's
   * publish — the exact image Telegram uploads — served briefly so Facebook and Instagram
   * (URL-ingest platforms) can publish the same one. PUBLIC on purpose: platform fetchers
   * cannot authenticate; post ids are unguessable UUIDs and frames expire within minutes.
   * `?fit=ig` letterboxes onto the nearest Instagram-legal canvas (never crops).
   */
  @Get('enhanced/:id')
  async enhanced(@Param('id') id: string, @Query('fit') fit: string, @Res() res: Response) {
    const buf = this.posts.getEnhancedFrame(id);
    if (!buf) {
      // The frame lives in memory and dies on deploy/restart — but Instagram/Facebook may
      // fetch this URL minutes after the send registered it. A 404 here fed Meta a text
      // page → IG #9004 ("Only photo or video can be accepted"). Degrade to the post's
      // ORIGINAL image instead: the publish loses the designed frame, not the post.
      const src = await this.posts.postImageForFrame(id).catch(() => null);
      if (!src) { res.status(404).send('frame expired'); return; }
      const target = unwrapOwnProxy(src);
      let host = '';
      try { host = new URL(target).hostname; } catch { /* fall through to raw src */ }
      this.logger.warn(`enhanced-frame ${id} expired — redirecting platform fetcher to the original image`);
      if (fit === 'ig' && host && isIgFittableHost(host)) {
        res.redirect(302, `/api/posts/ig-image?src=${encodeURIComponent(target)}`);
      } else {
        res.redirect(302, src);
      }
      return;
    }
    let out = buf;
    if (fit === 'ig') {
      try {
        const meta = await sharp(buf).metadata();
        const box = igFitBox(meta.width, meta.height);
        if (box) {
          out = await sharp(buf)
            .resize(box.width, box.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .jpeg({ quality: 90 })
            .toBuffer();
        }
      } catch (e: any) {
        // A broken pad step must not block the publish — serve the frame as-is. But LOG:
        // this exact catch silently swallowed a broken sharp import for weeks.
        this.logger.error(`enhanced-frame pad failed (serving unfitted): ${e?.message}`);
      }
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(out);
  }

  /**
   * An owner-uploaded image, from the DB. PUBLIC — platform fetchers cannot authenticate;
   * the unguessable uuid IS the access control, same as the enhanced-frame endpoint.
   */
  @Get('uploaded/:id')
  async uploaded(@Param('id') id: string, @Res() res: Response) {
    const img = await this.posts.getUploadedImage(id);
    if (!img) { res.status(404).send('not found'); return; }
    res.setHeader('Content-Type', img.mime || 'image/jpeg');
    // Immutable by construction — a new upload mints a new id.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(img.data);
  }

  /**
   * A post's PRE-COMPOSED pin frame, from memory (see registerPinFrame in the service —
   * Pinterest's create-time fetcher is too impatient for an on-the-fly compose). Expired
   * or lost to a restart → redirect to the post's original image: the pin loses its
   * frame, never its publish.
   */
  @Get('pin-frame/:id')
  async pinFrame(@Param('id') id: string, @Res() res: Response) {
    const buf = this.posts.getPinFrame(id);
    if (!buf) {
      const src = await this.posts.postImageForFrame(id).catch(() => null);
      if (src) { res.redirect(302, src); return; }
      res.status(404).send('frame expired');
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(buf);
  }

  /**
   * The DESIGNED Pinterest pin: the product photo letterboxed onto a 2:3 canvas with a
   * title band and price tag (see pin-frame.ts for why). Pinterest ingests pins by URL,
   * so the composed frame has to be publicly fetchable — this is that URL. PUBLIC and
   * SSRF-contained exactly like ig-image below: strict host allowlist, no redirects,
   * size cap. (The publisher itself now pre-composes instead — this stays for direct
   * inspection and as a manual preview.)
   */
  @Get('pin-image')
  async pinImage(
    @Query('src') src: string,
    @Query('title') title: string,
    @Query('price') price: string,
    @Res() res: Response,
  ) {
    const target = unwrapOwnProxy(String(src || ''));
    let host = '';
    try { host = new URL(target).hostname; } catch { throw new BadRequestException('bad url'); }
    if (!isIgFittableHost(host)) throw new BadRequestException('forbidden host');

    const upstream = await axios.get(target, {
      responseType: 'arraybuffer',
      maxRedirects: 0,
      headers: igFetchHeaders(host),
      timeout: 12000, maxContentLength: 8 * 1024 * 1024, validateStatus: () => true,
    });
    if (upstream.status !== 200) { res.status(502).send('image unavailable'); return; }

    const buf = Buffer.from(upstream.data);
    try {
      const photo = await sharp(buf)
        .resize(PIN_W, PIN_IMAGE_H, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .toBuffer();
      const overlay = Buffer.from(buildPinOverlaySvg(String(title || ''), String(price || '')));
      const framed = await sharp({
        create: { width: PIN_W, height: PIN_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .composite([{ input: photo, top: 0, left: 0 }, { input: overlay, top: 0, left: 0 }])
        .jpeg({ quality: 90 })
        .toBuffer();
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.send(framed);
    } catch (e: any) {
      // A broken compose must not cost the pin — serve the original photo and let the
      // publish proceed unframed. But LOG (the swallowed-sharp lesson, twice over).
      this.logger.error(`pin-image compose failed (serving original): ${e?.message}`);
      res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
      res.send(buf);
    }
  }

  @Get('ig-image')
  async igImage(@Query('src') src: string, @Res() res: Response) {
    const target = unwrapOwnProxy(String(src || ''));
    let host = '';
    try { host = new URL(target).hostname; } catch { throw new BadRequestException('bad url'); }
    if (!isIgFittableHost(host) && !isOwnUploadedUrl(target)) throw new BadRequestException('forbidden host');

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
    } catch (e: any) {
      // Unreadable image data → give Instagram the original and let it say so; a broken
      // pad step must not turn a maybe-fine image into a certain failure. But LOG: this
      // exact catch silently swallowed a broken sharp import for weeks.
      this.logger.error(`ig-image pad failed (serving original): ${e?.message}`);
      res.setHeader('Content-Type', String(upstream.headers['content-type'] || 'image/jpeg'));
      res.send(buf);
    }
  }
}
