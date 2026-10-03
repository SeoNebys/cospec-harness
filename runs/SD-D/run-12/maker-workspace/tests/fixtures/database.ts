import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, type AppDatabase } from '../../src/server/db/database.js';
import { migrateDatabase } from '../../src/server/db/migrate.js';

export type TestDatabase = { db: AppDatabase; migrate: () => void; cleanup: () => void };
export function createTestDatabase(): TestDatabase {
  const directory = mkdtempSync(join(tmpdir(), 'bookmark-garden-'));
  const db = openDatabase(join(directory, 'test.sqlite'));
  return {
    db,
    migrate: () => migrateDatabase(db),
    cleanup: () => { if (db.open) db.close(); rmSync(directory, { recursive: true, force: true }); },
  };
}
