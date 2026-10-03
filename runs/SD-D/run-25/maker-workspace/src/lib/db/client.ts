import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getConfig } from "@/lib/config";
import * as schema from "./schema";

type DbGlobal = typeof globalThis & {
  __safekeepSqlite?: Database.Database;
};

const globalForDb = globalThis as DbGlobal;

export function getSqlite(): Database.Database {
  if (globalForDb.__safekeepSqlite) return globalForDb.__safekeepSqlite;
  const dbPath = path.resolve(getConfig().DATABASE_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  globalForDb.__safekeepSqlite = sqlite;
  return sqlite;
}

export const db = drizzle(getSqlite(), { schema });
