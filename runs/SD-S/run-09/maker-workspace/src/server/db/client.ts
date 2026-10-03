import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function createDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:") {
    const resolved = path.resolve(filename);
    if (!resolved.startsWith(path.resolve("/work") + path.sep)) {
      throw new Error("Database path must remain below /work");
    }
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (filename !== ":memory:") db.pragma("journal_mode = WAL");
  return db;
}

export function inTransaction<T>(db: AppDatabase, work: () => T): T {
  return db.transaction(work)();
}
