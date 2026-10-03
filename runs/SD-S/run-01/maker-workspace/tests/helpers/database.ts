import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, type BookmarkDatabase } from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrate.js';

export function createTestDatabase(): { database: BookmarkDatabase; path: string; cleanup: () => void } {
  const directory = mkdtempSync(path.join(tmpdir(), 'bookmark-manager-test-'));
  const databasePath = path.join(directory, 'test.db');
  const database = openDatabase(databasePath);
  runMigrations(database);
  return {
    database,
    path: databasePath,
    cleanup: () => {
      if (database.open) database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
