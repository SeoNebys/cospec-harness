import type BetterSqlite3 from "better-sqlite3";

/**
 * Schema for the bookmark manager (data-model.md):
 *  - bookmarks: the saved links
 *  - tags: normalized, case-insensitively unique labels
 *  - bookmark_tags: many-to-many join
 *  - bookmarks_fts: FTS5 index over title/url/note kept in sync via triggers
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS bookmarks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  url                 TEXT NOT NULL,
  normalized_url      TEXT NOT NULL,
  title               TEXT,
  note                TEXT,
  preview_description TEXT,
  preview_image_url   TEXT,
  fetch_status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (fetch_status IN ('pending', 'success', 'failed')),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks (normalized_url);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks (created_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id INTEGER NOT NULL REFERENCES bookmarks (id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5 (
  title,
  url,
  note,
  content='bookmarks',
  content_rowid='id'
);

-- Keep the FTS index in sync with the bookmarks table.
CREATE TRIGGER IF NOT EXISTS bookmarks_ai AFTER INSERT ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (rowid, title, url, note)
  VALUES (new.id, new.title, new.url, new.note);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_ad AFTER DELETE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (bookmarks_fts, rowid, title, url, note)
  VALUES ('delete', old.id, old.title, old.url, old.note);
END;

CREATE TRIGGER IF NOT EXISTS bookmarks_au AFTER UPDATE ON bookmarks BEGIN
  INSERT INTO bookmarks_fts (bookmarks_fts, rowid, title, url, note)
  VALUES ('delete', old.id, old.title, old.url, old.note);
  INSERT INTO bookmarks_fts (rowid, title, url, note)
  VALUES (new.id, new.title, new.url, new.note);
END;
`;

export function applySchema(db: BetterSqlite3.Database): void {
  db.exec(SCHEMA_SQL);
}
