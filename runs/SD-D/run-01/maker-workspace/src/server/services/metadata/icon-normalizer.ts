import sharp from 'sharp';
import type { SafeResponse } from './safe-fetch.js';

export interface NormalizedIcon { data: Buffer; width: number; height: number }

export async function normalizeIcon(response: SafeResponse): Promise<NormalizedIcon> {
  if (response.body.length > 256 * 1024) throw new Error('Icon is too large.');
  if (response.contentType.includes('svg') || response.contentType === 'text/html') throw new Error('Only raster icons are supported.');
  const image = sharp(response.body, { animated: false, limitInputPixels: 512 * 512, failOn: 'warning' }).rotate().resize(128,128,{fit:'inside',withoutEnlargement:true}).png({ compressionLevel: 9 });
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  if (data.length > 256 * 1024 || !info.width || !info.height || info.width > 512 || info.height > 512) throw new Error('Normalized icon exceeds limits.');
  return { data, width: info.width, height: info.height };
}
