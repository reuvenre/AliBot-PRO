/**
 * Normalize an owner-uploaded image before it is stored: honor the phone's EXIF rotation
 * (or every portrait shot arrives sideways), cap the long edge, and recompress to JPEG.
 * The row then weighs a few hundred KB instead of a 12MP original, and every consumer
 * (Telegram upload, Meta/Pinterest URL ingest, the pin frame) gets one predictable format.
 */

// sharp's runtime is CommonJS but its types use `export default`, and this tsconfig has
// NO esModuleInterop — the same trap collage.service.ts documents.
const sharp = require('sharp') as typeof import('sharp').default;

export const UPLOAD_MAX_EDGE = 1600;

export async function normalizeUploadedImage(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate() // apply EXIF orientation
    .resize(UPLOAD_MAX_EDGE, UPLOAD_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}
