import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BookmarkDatabase } from './connection.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function migrate(db: BookmarkDatabase, now = Date.now()): void {
  const files = readdirSync(migrationsDir).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  const bootstrap = files.shift();
  if (!bootstrap) throw new Error('No migrations found');
  db.exec(readFileSync(join(migrationsDir, bootstrap), 'utf8'));
  const current = db.prepare('SELECT version FROM schema_migrations').all().map((row) => Number((row as { version: number }).version));
  const known = new Set(current);
  const availableVersions = files.map((name) => Number(name.slice(0, 3)));
  if (current.some((version) => !availableVersions.includes(version))) throw new Error('Database schema is newer than this application');
  const apply = db.transaction((file: string, version: number) => {
    db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES(?,?,?)').run(version, file, now);
  });
  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (!known.has(version)) apply(file, version);
  }
}
