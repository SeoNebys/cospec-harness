import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

const builtMigrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url));
const defaultMigrationsDirectory = existsSync(builtMigrationsDirectory)
  ? builtMigrationsDirectory
  : path.resolve('src/server/db/migrations');
const migrationPattern = /^(\d+)_.*\.sql$/;

export function migrateDatabase(
  database: DatabaseSync,
  migrationsDirectory = defaultMigrationsDirectory,
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => Number(row.version)),
  );
  const migrations = readdirSync(migrationsDirectory)
    .map((filename) => ({ filename, match: migrationPattern.exec(filename) }))
    .filter((entry): entry is { filename: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ filename, match }) => ({ filename, version: Number(match[1]) }))
    .sort((left, right) => left.version - right.version);

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const sql = readFileSync(path.join(migrationsDirectory, migration.filename), 'utf8');
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(sql);
      database
        .prepare('INSERT INTO schema_migrations(version, filename, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.filename, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
