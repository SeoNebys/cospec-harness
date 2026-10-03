import type { BookmarkDatabase } from '../db/connection.js';
import { MediaRepository } from '../db/repositories/media-repository.js';
import { MetadataDraftRepository } from '../db/repositories/metadata-draft-repository.js';

export function cleanupExpiredMetadata(db: BookmarkDatabase): void {
  new MetadataDraftRepository(db).deleteExpired();
  new MediaRepository(db).cleanupUnreferenced();
}

export function scheduleMetadataCleanup(db: BookmarkDatabase): NodeJS.Timeout {
  const timer=setInterval(()=>cleanupExpiredMetadata(db),15*60*1000);timer.unref();return timer;
}
