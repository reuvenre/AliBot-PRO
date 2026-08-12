/**
 * Compose a designed pin frame from a product photo buffer — shared by the pre-compose
 * path (posts.service, which serves Pinterest a ready buffer from memory) and the
 * on-the-fly endpoint (instagram-image.controller, kept for direct inspection).
 *
 * Why pre-compose exists: Pinterest validates media_source.image_url AT pin creation and
 * its fetcher is impatient — an on-the-fly compose (fetch upstream + sharp raster) on a
 * small instance takes seconds, the fetch times out, and the whole create fails with
 * Pinterest's vague "Sorry! Something went wrong on our end." Serving a buffer that was
 * composed BEFORE the create call turns that fetch into a memory read.
 */

// sharp's runtime is CommonJS (module.exports = sharp) but its types use `export default`,
// and this tsconfig has NO esModuleInterop — the same trap collage.service.ts documents.
const sharp = require('sharp') as typeof import('sharp').default;
import { buildPinOverlaySvg, PIN_H, PIN_IMAGE_H, PIN_W } from './pin-frame';

export async function composePinFrame(photo: Buffer, title: string, price: string): Promise<Buffer> {
  const fitted = await sharp(photo)
    .resize(PIN_W, PIN_IMAGE_H, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();
  const overlay = Buffer.from(buildPinOverlaySvg(title, price));
  return sharp({
    create: { width: PIN_W, height: PIN_H, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: fitted, top: 0, left: 0 }, { input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
