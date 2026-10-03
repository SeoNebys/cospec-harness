import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  try { db.exec('PRAGMA defensive = ON;'); } catch { /* unavailable on some SQLite builds */ }
  return db;
}

export function migrate(db: Database, root = process.cwd()): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT');
  const files = ['001_initial.sql', '002_search.sql', '003_imports.sql'];
  for (const file of files) {
    const seen = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(file);
    if (seen) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
