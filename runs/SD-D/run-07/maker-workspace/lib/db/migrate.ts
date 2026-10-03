import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export function migrate(db: Database.Database) {
  const hasFts = db.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get() as { enabled: number };
  if (!hasFts.enabled) throw new Error("SQLite FTS5 is required");
  const migration = fs.readFileSync(path.join(process.cwd(), "lib/db/migrations/001_initial.sql"), "utf8");
  db.exec(migration);
}
