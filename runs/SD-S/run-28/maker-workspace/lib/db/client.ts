import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/config/env";

export type AppDatabase = Database.Database;

const globalDb = globalThis as typeof globalThis & { __bookmarkDb?: AppDatabase };

function openDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  if (filename !== ":memory:") database.pragma("journal_mode = WAL");
  database.pragma("synchronous = NORMAL");
  return database;
}

export function getDb(): AppDatabase {
  globalDb.__bookmarkDb ??= openDatabase(env().DATABASE_PATH);
  return globalDb.__bookmarkDb;
}

export function createTestDb(): AppDatabase {
  return openDatabase(":memory:");
}
