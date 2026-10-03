import fs from "node:fs";
import path from "node:path";
import type { AppDatabase } from "./client.js";
import { createDatabase } from "./client.js";
import { loadConfig } from "../config.js";

export function runMigrations(db: AppDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`);
  const directory = path.resolve("drizzle/migrations");
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
  const hasMigration = db.prepare("SELECT 1 FROM _migrations WHERE name = ?");
  const recordMigration = db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)");
  for (const file of files) {
    if (hasMigration.get(file)) continue;
    const sql = fs.readFileSync(path.join(directory, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      recordMigration.run(file, Date.now());
    })();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDatabase(loadConfig().databasePath);
  runMigrations(db);
  db.close();
}
