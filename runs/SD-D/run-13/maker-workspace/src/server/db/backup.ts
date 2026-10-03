import type { BookmarkDatabase } from './connection.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export async function backupDatabase(db: BookmarkDatabase, dataDir: string): Promise<string> {
  const directory = join(dataDir,'backups'); mkdirSync(directory,{recursive:true});
  const destination = join(directory,'bookmarks-latest.sqlite3');
  db.pragma('wal_checkpoint(PASSIVE)');
  await db.backup(destination);
  return destination;
}
