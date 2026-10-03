import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BookmarkDatabase } from './connection.js';

const defaultMigrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url));

export function runMigrations(database: BookmarkDatabase, migrationsDirectory = defaultMigrationsDirectory): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    database.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: string }).version),
  );

  const files = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));

  const apply = database.transaction((version: string, sql: string) => {
    database.exec(sql);
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
  });

  for (const file of files) {
    if (!applied.has(file)) {
      apply(file, readFileSync(path.join(migrationsDirectory, file), 'utf8'));
    }
  }
}
