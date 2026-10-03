import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

export type Db = Database.Database;

let singleton: Db | undefined;

export function openDatabase(filename = config.databasePath): Db {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}

export function getDatabase(): Db {
  singleton ||= openDatabase();
  return singleton;
}

export function closeDatabase(): void {
  singleton?.close();
  singleton = undefined;
}

export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const migrationsDir = path.resolve(process.cwd(), 'src/server/db/migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
  const insert = db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)');
  for (const file of files) {
    if (applied.get(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    })();
  }
}
