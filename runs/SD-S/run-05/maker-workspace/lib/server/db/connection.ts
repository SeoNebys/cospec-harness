import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { sqlite?: Database.Database; migrated?: boolean };
const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "bookmarks.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const sqlite = globalDb.sqlite ?? new Database(dbPath);
if (!globalDb.sqlite) { sqlite.pragma("journal_mode = WAL"); sqlite.pragma("foreign_keys = ON"); }
globalDb.sqlite = sqlite;

export function migrate() {
  if (globalDb.migrated) return;
  const sql = fs.readFileSync(path.join(process.cwd(), "lib/server/db/migrations/0001_initial.sql"), "utf8");
  sqlite.exec(sql);
  globalDb.migrated = true;
}
migrate();
export const db = drizzle(sqlite, { schema });
