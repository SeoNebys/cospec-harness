import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '@shared/errors.js';
export async function normalizeIcon(input: Buffer) {
  if (input.length > 524288) throw new AppError(413, 'TOO_LARGE', 'The icon file is too large.');
  try {
    const image = sharp(input, { animated: false, limitInputPixels: 1024 * 1024, failOn: 'error' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('dimensions');
    const bytes = await image
      .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const out = await sharp(bytes).metadata();
    return {
      hash: createHash('sha256').update(bytes).digest('hex'),
      mimeType: 'image/png',
      bytes,
      width: out.width!,
      height: out.height!
    };
  } catch {
    throw new AppError(422, 'METADATA_UNAVAILABLE', 'The page icon was not a supported image.');
  }
}
