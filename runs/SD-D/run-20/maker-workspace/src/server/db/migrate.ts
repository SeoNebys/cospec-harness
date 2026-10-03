import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppDatabase } from './connection.js';
import { openDatabase } from './connection.js';

export function migrationsDirectory(): string {
  return resolve(process.cwd(), 'db/migrations');
}

export function migrate(db: AppDatabase, directory = migrationsDirectory()): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (row) => row.version,
    ),
  );
  const files = readdirSync(directory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const version = Number.parseInt(file.split('_')[0]!, 10);
    if (applied.has(version)) continue;
    const sql = readFileSync(resolve(directory, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)').run(
        version,
        basename(file, '.sql'),
        new Date().toISOString(),
      );
    })();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDatabase();
  migrate(db);
  db.close();
}
