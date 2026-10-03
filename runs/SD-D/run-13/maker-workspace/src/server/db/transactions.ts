import type { BookmarkDatabase } from './connection.js';

export function inTransaction<T>(db: BookmarkDatabase, work: () => T): T {
  return db.transaction(work).immediate();
}
