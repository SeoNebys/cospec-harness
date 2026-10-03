import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, type AppDatabase } from '../../src/server/db/database.js';

export interface TemporaryDatabase {
  database: AppDatabase;
  path: string;
  cleanup(): void;
}

export function createTemporaryDatabase(): TemporaryDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), 'bookmarks-test-'));
  const databasePath = path.join(directory, 'bookmarks.sqlite');
  const database = openDatabase({ path: databasePath });
  let cleaned = false;
  return {
    database,
    path: databasePath,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
