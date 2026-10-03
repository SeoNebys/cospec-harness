import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeFetch } from './safe-fetch.js';

const SIGNATURES: Array<[string, (b: Uint8Array) => boolean]> = [
  ['png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['jpg', (b) => b[0] === 0xff && b[1] === 0xd8],
  ['gif', (b) => String.fromCharCode(...b.slice(0, 3)) === 'GIF'],
  ['webp', (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP'],
  ['ico', (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0],
];

export async function cacheFirstValidIcon(candidates: string[], cachePath: string): Promise<string | null> {
  await fs.mkdir(cachePath, { recursive: true });
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const result = await safeFetch(candidate, { maxBytes: 262_144, allowedTypes: /^image\/(png|jpeg|gif|webp|x-icon|vnd\.microsoft\.icon)$/u, accept: 'image/png,image/jpeg,image/gif,image/webp,image/x-icon' });
      const format = SIGNATURES.find(([, matches]) => matches(result.bytes))?.[0];
      if (!format) continue;
      const token = `${crypto.createHash('sha256').update(result.bytes).digest('hex')}.${format}`;
      await fs.writeFile(path.join(cachePath, token), result.bytes, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
      return token;
    } catch { /* try the next candidate */ }
  }
  return null;
}

export function safeIconPath(cachePath: string, token: string): string | null {
  if (!/^[a-f0-9]{64}\.(png|jpg|gif|webp|ico)$/u.test(token)) return null;
  return path.join(cachePath, token);
}
