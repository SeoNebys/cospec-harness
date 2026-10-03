import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database, directory = path.resolve('migrations')): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT`
  );
  const files = fs
    .readdirSync(directory)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  const apply = db.transaction(() => {
    for (const file of files) {
      const version = Number(file.split('_')[0]);
      const sql = fs.readFileSync(path.join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = db
        .prepare('SELECT checksum FROM schema_migrations WHERE version=?')
        .get(version) as { checksum: string } | undefined;
      if (prior && prior.checksum !== checksum)
        throw new Error(`Applied migration ${file} was modified`);
      if (!prior) {
        db.exec(sql);
        db.prepare(
          'INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(?,?,?,?)'
        ).run(version, file, checksum, new Date().toISOString());
      }
    }
  });
  apply();
}
