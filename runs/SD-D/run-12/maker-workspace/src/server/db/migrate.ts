import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, type AppDatabase } from './database.js';

function migrationDirectory(): string {
  const sourcePath = resolve(process.cwd(), 'src/server/db/migrations');
  return sourcePath;
}

export function migrateDatabase(db: AppDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE filename = ?');
  const record = db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)');
  const run = db.transaction((filename: string, sql: string) => {
    db.exec(sql);
    record.run(filename, new Date().toISOString());
  });
  for (const filename of readdirSync(migrationDirectory()).filter((name) => name.endsWith('.sql')).sort()) {
    if (!applied.get(filename)) run(filename, readFileSync(resolve(migrationDirectory(), filename), 'utf8'));
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const db = openDatabase();
  migrateDatabase(db);
  db.close();
  console.log('Database migrations complete.');
}
