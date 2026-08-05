import type { DB } from './connection'

// Creates all tables and the full-text search index if they do not yet exist.
// Mirrors specs/001-manage-bookmarks/data-model.md. The full schema is created
// now (Foundational phase) even though the MVP only exercises bookmarks — later
// stories fill in notes, tags, saved copies, saved searches, and search.
export function applySchema(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id            TEXT PRIMARY KEY,
      url           TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      favicon_path  TEXT,
      note_html     TEXT,
      note_text     TEXT,
      is_read       INTEGER NOT NULL DEFAULT 0,
      is_archived   INTEGER NOT NULL DEFAULT 0,
      saved_copy_id TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_copies (
      id          TEXT PRIMARY KEY,
      bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      kind        TEXT NOT NULL,
      file_path   TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      captured_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      keywords         TEXT,
      tag_filter       TEXT,
      unread_only      INTEGER NOT NULL DEFAULT 0,
      include_archived INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Full-text index over the fields search must look inside (FR-018). Keeps
    -- an unindexed bookmark_id so matches map back to bookmarks; the app keeps
    -- this in sync on every change (see searchIndex.ts).
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      bookmark_id UNINDEXED, title, description, note_text, tags, url
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(is_archived);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created  ON bookmarks(created_at);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag  ON bookmark_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_saved_copies_bookmark ON saved_copies(bookmark_id);
  `)
}
