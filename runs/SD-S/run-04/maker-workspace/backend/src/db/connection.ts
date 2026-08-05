import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { applySchema } from "./schema.js";

/**
 * Create (or open) the SQLite database, apply pragmas and the schema, and
 * return the connection. Pass ":memory:" for tests. The file is created on
 * first run (FR-004).
 */
export function createDatabase(filename: string): BetterSqlite3.Database {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}
