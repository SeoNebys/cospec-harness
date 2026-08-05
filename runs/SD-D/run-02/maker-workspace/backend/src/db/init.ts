/**
 * Database + snapshot-store initialization. Auto-creates data/bookmarks.db and
 * data/snapshots/ on first run so a returning user never loses saved bookmarks (SC-005).
 */
import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
// backend/src/db -> repo root /data
const REPO_ROOT = resolve(here, '..', '..', '..');

export const DATA_DIR = process.env.BOOKMARKS_DATA_DIR ?? resolve(REPO_ROOT, 'data');
export const SNAPSHOTS_DIR = resolve(DATA_DIR, 'snapshots');
export const DB_PATH = process.env.BOOKMARKS_DB ?? resolve(DATA_DIR, 'bookmarks.db');

export function ensureDataDirs(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

let dbInstance: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
  if (dbInstance) return dbInstance;
  ensureDataDirs();
  dbInstance = new BetterSqlite3(DB_PATH);
  migrate(dbInstance);
  return dbInstance;
}

/** For tests: an isolated in-memory database with the full schema. */
export function createTestDb(): BetterSqlite3.Database {
  const db = new BetterSqlite3(':memory:');
  migrate(db);
  return db;
}
