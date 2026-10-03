import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { config } from "~/config.server";
import * as schema from "./schema";

export function createDatabase(databasePath = config.DATABASE_PATH) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  const client = new Database(databasePath);
  client.pragma("foreign_keys = ON");
  client.pragma("busy_timeout = 3000");
  if (databasePath !== ":memory:") client.pragma("journal_mode = WAL");
  const db = drizzle(client, { schema });
  return { client, db };
}

const database = createDatabase();

export const sqlite = database.client;
export const db = database.db;
export type AppDatabase = typeof db;
