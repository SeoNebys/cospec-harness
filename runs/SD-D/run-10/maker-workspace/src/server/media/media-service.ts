import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { AppError } from '../api/errors.js';
import type { MediaRepository, MediaRow } from '../repositories/media-repository.js';
import { fetchImage } from '../metadata/safe-fetch.js';

const allowed = new Map<string, { extension: string; signatures: Array<(bytes: Uint8Array) => boolean> }>([
  ['image/png', { extension: '.png', signatures: [(b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e] }],
  ['image/jpeg', { extension: '.jpg', signatures: [(b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff] }],
  ['image/gif', { extension: '.gif', signatures: [(b) => String.fromCharCode(...b.slice(0, 3)) === 'GIF'] }],
  [
    'image/webp',
    { extension: '.webp', signatures: [(b) => String.fromCharCode(...b.slice(8, 12)) === 'WEBP'] },
  ],
  [
    'image/x-icon',
    { extension: '.ico', signatures: [(b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0] },
  ],
  [
    'image/vnd.microsoft.icon',
    { extension: '.ico', signatures: [(b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0] },
  ],
]);

export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly directory: string,
  ) {}

  async initialize(): Promise<void> {
    await mkdir(join(this.directory, '.drafts'), { recursive: true });
    await mkdir(join(this.directory, 'attached'), { recursive: true });
  }

  async capture(userId: number, purpose: 'favicon' | 'preview', sourceUrl: string): Promise<MediaRow> {
    const response = await fetchImage(sourceUrl, purpose);
    const definition = allowed.get(response.contentType);
    if (!definition || !definition.signatures.some((matches) => matches(response.bytes))) {
      throw new AppError(422, 'remote_content_type', 'The image bytes do not match a supported image type.');
    }
    const publicId = `med_${randomUUID()}`;
    const storageKey = `.drafts/${publicId}${definition.extension}`;
    const destination = join(this.directory, storageKey);
    await writeFile(destination, response.bytes, { flag: 'wx' });
    try {
      return this.repository.create({
        publicId,
        userId,
        purpose,
        status: 'draft',
        storageKey,
        sourceUrl,
        mimeType: response.contentType,
        byteSize: response.bytes.byteLength,
        sha256: createHash('sha256').update(response.bytes).digest('hex'),
        expiresAt: Date.now() + 60 * 60_000,
      });
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  getOwned(publicId: string, userId: number, purpose?: 'favicon' | 'preview'): MediaRow {
    const media = this.repository.getOwned(publicId, userId);
    if (
      !media ||
      (purpose && media.purpose !== purpose) ||
      (media.expiresAt && media.expiresAt <= Date.now())
    ) {
      throw new AppError(404, 'media_not_found', 'Media was not found.');
    }
    return media;
  }

  async readOwned(publicId: string, userId: number): Promise<{ media: MediaRow; bytes: Buffer }> {
    const media = this.getOwned(publicId, userId);
    try {
      return { media, bytes: await readFile(join(this.directory, media.storageKey)) };
    } catch {
      throw new AppError(404, 'media_not_found', 'Media was not found.');
    }
  }

  async promote(media: MediaRow): Promise<boolean> {
    if (media.status === 'attached') return false;
    const targetKey = `attached/${media.publicId}${extname(media.storageKey)}`;
    await rename(join(this.directory, media.storageKey), join(this.directory, targetKey));
    try {
      this.repository.attach(media.id, media.userId, targetKey);
    } catch (error) {
      await rename(join(this.directory, targetKey), join(this.directory, media.storageKey)).catch(
        () => undefined,
      );
      throw error;
    }
    return true;
  }

  async revertPromotion(media: MediaRow): Promise<void> {
    if (media.status === 'attached') return;
    const attachedKey = `attached/${media.publicId}${extname(media.storageKey)}`;
    await rename(join(this.directory, attachedKey), join(this.directory, media.storageKey));
    this.repository.markDraft(
      media.id,
      media.userId,
      media.storageKey,
      media.expiresAt ?? Date.now() + 60 * 60_000,
    );
  }

  async cleanupExpiredDrafts(now = Date.now()): Promise<number> {
    const expired = this.repository.listExpiredDrafts(now);
    let removed = 0;
    for (const media of expired) {
      await unlink(join(this.directory, media.storageKey)).catch(() => undefined);
      this.repository.deleteDraft(media.id, media.userId);
      removed += 1;
    }
    return removed;
  }

  async cleanupUnreferenced(before: number): Promise<number> {
    const rows = this.repository.listUnreferenced(before);
    for (const row of rows) {
      await unlink(join(this.directory, row.storageKey)).catch(() => undefined);
      this.repository.deleteUnreferenced(row.id);
    }
    return rows.length;
  }
}
