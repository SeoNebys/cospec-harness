import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export function migrate(db: DatabaseSync, migrationsDir = path.resolve('migrations')) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;');
  const applied = db.prepare('SELECT name FROM schema_migrations').all().map((r) => String(r.name));
  for (const name of fs.readdirSync(migrationsDir).filter((n) => n.endsWith('.sql')).sort()) {
    if (applied.includes(name)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(sql); db.prepare('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString()); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
