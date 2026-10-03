import { createHash } from 'node:crypto';
import sharp from 'sharp';

export interface ProcessedImage { id: string; mimeType: 'image/png' | 'image/webp'; bytes: Buffer; byteLength: number; width: number; height: number }

export async function processImage(input: Buffer, kind: 'icon' | 'preview'): Promise<ProcessedImage> {
  const maxInput = kind === 'icon' ? 1024 * 1024 : 5 * 1024 * 1024;
  if (!input.length || input.length > maxInput) throw new Error('Image input exceeds the allowed size.');
  const metadata = await sharp(input, { animated: false, limitInputPixels: 24_000_000, failOn: 'warning' }).metadata();
  if (!['png','jpeg','webp','gif','avif'].includes(metadata.format || '')) throw new Error('Unsupported image format.');
  const pipeline = sharp(input, { page: 0, pages: 1, limitInputPixels: 24_000_000, failOn: 'warning' }).rotate().resize(kind === 'icon' ? { width: 128, height: 128, fit: 'inside', withoutEnlargement: true } : { width: 1200, height: 630, fit: 'inside', withoutEnlargement: true });
  const bytes = kind === 'icon' ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.webp({ quality: 78 }).toBuffer();
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Processed image exceeds the allowed size.');
  const output = await sharp(bytes).metadata();
  return { id: createHash('sha256').update(bytes).digest('hex'), mimeType: kind === 'icon' ? 'image/png' : 'image/webp', bytes, byteLength: bytes.length, width: output.width!, height: output.height! };
}
