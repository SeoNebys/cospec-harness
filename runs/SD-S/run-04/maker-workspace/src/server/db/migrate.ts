import fs from 'node:fs';
import path from 'node:path';
import type { Database } from './database.js';

export function migrate(db: Database): void {
  const migrationPath = path.resolve('src/server/db/migrations/001_initial.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(sql);
    db.prepare(
      'INSERT OR IGNORE INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
    ).run(1, 'initial', new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
