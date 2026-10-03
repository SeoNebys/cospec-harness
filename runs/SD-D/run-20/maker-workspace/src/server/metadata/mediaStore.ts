import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import type { MediaRepository, MediaRow } from '../repositories/mediaRepository.js';
import type { RestrictedTransport } from './restrictedFetch.js';

const allowed = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
  ['image/x-icon', 'ico'],
  ['image/vnd.microsoft.icon', 'ico'],
]);

export class MediaStore {
  constructor(
    private repository: MediaRepository,
    private fetcher: RestrictedTransport,
    private directory = resolve('data/assets'),
  ) {}
  async cache(url: string, expiresAt: string): Promise<MediaRow | null> {
    try {
      const response = await this.fetcher(url);
      if (
        response.statusCode < 200 ||
        response.statusCode >= 300 ||
        !response.body.length ||
        response.body.length > 2 * 1024 * 1024
      )
        return null;
      const detected = await fileTypeFromBuffer(response.body);
      let type = detected?.mime;
      if (!type && response.body.subarray(0, 4).toString('hex') === '00000100') type = 'image/x-icon';
      if (!type || !allowed.has(type)) return null;
      const hash = createHash('sha256').update(response.body).digest('hex');
      const existing = this.repository.findByHash(hash, type);
      if (existing) return existing;
      await mkdir(this.directory, { recursive: true });
      const publicId = randomUUID();
      const filename = `${publicId}.${allowed.get(type)}`;
      const temporary = resolve(this.directory, `${filename}.tmp`);
      const destination = resolve(this.directory, filename);
      await writeFile(temporary, response.body, { flag: 'wx' });
      await rename(temporary, destination);
      return this.repository.insert({
        publicId,
        hash,
        type,
        bytes: response.body.length,
        path: filename,
        expiresAt,
        createdAt: new Date().toISOString(),
      });
    } catch {
      return null;
    }
  }
  async bytes(row: MediaRow): Promise<Buffer> {
    if (
      extname(row.relative_path).length === 0 ||
      row.relative_path.includes('/') ||
      row.relative_path.includes('\\')
    )
      throw new Error('Invalid media path');
    return readFile(resolve(this.directory, row.relative_path));
  }
}
