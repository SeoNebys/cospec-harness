import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, 'schema.sql');

export type DB = Database.Database;

/**
 * Resolve the on-disk database location. Kept in a per-user app-data directory so
 * the collection persists across app restarts (FR-022). Override with
 * BOOKMARKS_DB_PATH; pass ':memory:' for tests.
 */
export function resolveDbPath(): string {
  const override = process.env.BOOKMARKS_DB_PATH;
  if (override) return override;
  const dir = join(homedir(), '.bookmark-manager');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'bookmarks.db');
}

/** Open a database (file or in-memory) and ensure the schema exists. */
export function openDb(path: string = resolveDbPath()): DB {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);
  return db;
}
