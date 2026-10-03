import fs from 'node:fs';
import path from 'node:path';
import type { BookmarkDatabase } from './connection.js';

const MIGRATION_PATTERN = /^(\d+)_([a-z0-9_-]+)\.sql$/i;

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(directory: string): Migration[] {
  return fs
    .readdirSync(directory)
    .map((filename) => {
      const match = filename.match(MIGRATION_PATTERN);
      if (!match) return null;
      return {
        version: Number(match[1]),
        name: match[2],
        sql: fs.readFileSync(path.join(directory, filename), 'utf8'),
      };
    })
    .filter((migration): migration is Migration => migration !== null)
    .sort((a, b) => a.version - b.version);
}

export function runMigrations(
  database: BookmarkDatabase,
  directory = path.resolve(process.cwd(), 'migrations'),
  now: () => string = () => new Date().toISOString(),
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const applied = new Set(
    (database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      ({ version }) => version,
    ),
  );

  const apply = database.transaction((migration: Migration) => {
    database.exec(migration.sql);
    database
      .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(migration.version, migration.name, now());
  });

  for (const migration of loadMigrations(directory)) {
    if (!applied.has(migration.version)) apply(migration);
  }
}
