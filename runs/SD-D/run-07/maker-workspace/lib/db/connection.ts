import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";

declare global { var __bookmarkDb: Database.Database | undefined; }

export function openDatabase(file = path.join(config.dataDir, "bookmarks.sqlite")) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");
  return db;
}

export function database() {
  if (!globalThis.__bookmarkDb) globalThis.__bookmarkDb = openDatabase();
  return globalThis.__bookmarkDb;
}
