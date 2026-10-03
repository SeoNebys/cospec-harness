import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type Database from 'better-sqlite3';

export function migrateDatabase(
  db: Database.Database,
  migrationsDirectory = resolve(process.cwd(), 'migrations'),
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const applied = db.prepare('SELECT version FROM schema_migrations').all() as Array<{
    version: string;
  }>;
  const appliedVersions = new Set(applied.map(({ version }) => version));
  const files = readdirSync(migrationsDirectory)
    .filter((file) => /^\d+.*\.sql$/u.test(file))
    .sort();

  const applyMigration = db.transaction((file: string, sql: string) => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      file,
      new Date().toISOString(),
    );
  });

  for (const file of files) {
    if (!appliedVersions.has(file)) {
      applyMigration(file, readFileSync(resolve(migrationsDirectory, file), 'utf8'));
    }
  }
}
