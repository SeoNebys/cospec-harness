import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookmarks (
  id            TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  normalizedUrl TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL,
  deletedAt     TEXT
);

-- Duplicate detection is scoped to active (non-deleted) bookmarks.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_normalized_active
  ON bookmarks (normalizedUrl) WHERE deletedAt IS NULL;

-- Recent-first ordering.
CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks (createdAt);

-- Fast scoping to active rows.
CREATE INDEX IF NOT EXISTS idx_bookmarks_deleted ON bookmarks (deletedAt);
`;

/** Open (and initialize) the SQLite database at the given path. */
export function openDb(path: string): DB {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}
