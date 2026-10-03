// Schema creation for the Bookmark Manager, per data-model.md.
// Constraints are enforced here to avoid leaving them to implementation discretion.

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      address             TEXT NOT NULL UNIQUE,
      title               TEXT,
      description         TEXT,
      note                TEXT,
      icon_url            TEXT,
      preview_image_url   TEXT,
      is_unread           INTEGER NOT NULL DEFAULT 1 CHECK (is_unread IN (0,1)),
      is_archived         INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
      date_added          TEXT NOT NULL,
      date_updated        TEXT NOT NULL,
      preserved_copy_path TEXT,
      preserved_copy_kind TEXT CHECK (preserved_copy_kind IN ('html','pdf') OR preserved_copy_kind IS NULL),
      preserved_at        TEXT,
      archive_org_url     TEXT,
      archive_org_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_ci ON tags (name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bt_tag ON bookmark_tags (tag_id);
    CREATE INDEX IF NOT EXISTS idx_bt_bookmark ON bookmark_tags (bookmark_id);

    CREATE TABLE IF NOT EXISTS saved_searches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      query_text    TEXT,
      included_tags TEXT NOT NULL DEFAULT '[]',
      excluded_tags TEXT NOT NULL DEFAULT '[]',
      date_created  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id           INTEGER PRIMARY KEY CHECK (id = 1),
      default_sort TEXT NOT NULL DEFAULT 'newest' CHECK (default_sort IN ('newest','oldest','title','updated')),
      items_shown  INTEGER NOT NULL DEFAULT 50,
      text_size    TEXT NOT NULL DEFAULT 'medium' CHECK (text_size IN ('small','medium','large'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_address ON bookmarks (address);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_list ON bookmarks (is_archived, is_unread, date_added);

    INSERT OR IGNORE INTO preferences (id, default_sort, items_shown, text_size)
      VALUES (1, 'newest', 50, 'medium');
  `);
}
