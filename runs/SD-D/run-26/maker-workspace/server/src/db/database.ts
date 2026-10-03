import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrate.js';

export function openDatabase(dataDir: string, filename = 'bookmarks.sqlite') {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const db = new Database(filename === ':memory:' ? filename : path.join(dataDir, filename));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  const integrity = db.pragma('quick_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`Database integrity check failed: ${integrity}`);
  return db;
}
export function createTestDatabase() {
  return openDatabase(path.resolve('data'), ':memory:');
}
