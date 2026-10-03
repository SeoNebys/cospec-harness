import type { AppDatabase } from './database.js';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function runMigrations(database: AppDatabase, directory = resolve('migrations')): string[] {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);
  const applied = new Set(
    (database.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  const files = readdirSync(directory)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const completed: string[] = [];
  const apply = database.transaction((name: string, sql: string) => {
    database.exec(sql);
    database.prepare('INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)').run(name, Date.now());
  });
  for (const file of files) {
    if (applied.has(file)) continue;
    apply(file, readFileSync(resolve(directory, file), 'utf8'));
    completed.push(file);
  }
  return completed;
}
