import { getDb } from './connection.js';

// Create the schema and indexes for all entities defined in data-model.md.
// Idempotent: safe to run on every startup.
export function migrate() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmark (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      url                 TEXT NOT NULL,
      normalized_url      TEXT NOT NULL UNIQUE,
      title               TEXT NOT NULL,
      description         TEXT,
      icon_url            TEXT,
      preview_image_url   TEXT,
      notes_markdown      TEXT,
      is_read             INTEGER NOT NULL DEFAULT 0,
      is_archived         INTEGER NOT NULL DEFAULT 0,
      date_added          TEXT NOT NULL,
      date_modified       TEXT NOT NULL,
      metadata_status     TEXT NOT NULL DEFAULT 'pending'
                            CHECK (metadata_status IN ('pending','ready','failed')),
      preserved_path      TEXT,
      preserved_kind      TEXT CHECK (preserved_kind IN ('html','pdf')),
      preserved_status    TEXT NOT NULL DEFAULT 'none'
                            CHECK (preserved_status IN ('none','pending','ready','failed')),
      archive_org_url     TEXT,
      archive_org_status  TEXT NOT NULL DEFAULT 'none'
                            CHECK (archive_org_status IN ('none','pending','ready','failed'))
    );

    CREATE TABLE IF NOT EXISTS tag (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_name_nocase ON tag (name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS saved_view (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      search_text   TEXT,
      included_tags TEXT,
      excluded_tags TEXT
    );

    CREATE TABLE IF NOT EXISTS display_preferences (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      default_sort    TEXT NOT NULL DEFAULT 'newest'
                        CHECK (default_sort IN ('newest','oldest','title','recently_modified')),
      items_per_view  INTEGER NOT NULL DEFAULT 25,
      text_size       TEXT NOT NULL DEFAULT 'medium'
                        CHECK (text_size IN ('small','medium','large'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookmark_archived ON bookmark (is_archived);
    CREATE INDEX IF NOT EXISTS idx_bookmark_read ON bookmark (is_read);
    CREATE INDEX IF NOT EXISTS idx_bookmark_date_added ON bookmark (date_added);
    CREATE INDEX IF NOT EXISTS idx_bookmark_title ON bookmark (title COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags (tag_id);
  `);

  // Seed the singleton preferences row (id = 1) with defaults.
  db.prepare(
    `INSERT OR IGNORE INTO display_preferences (id, default_sort, items_per_view, text_size)
     VALUES (1, 'newest', 25, 'medium')`
  ).run();
}
