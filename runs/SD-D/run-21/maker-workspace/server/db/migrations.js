import db from './connection.js';

// Creates the schema for all entities (data-model.md). Idempotent.
export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmark (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      note_html TEXT,
      note_text TEXT,
      icon_path TEXT,
      preview_image_url TEXT,
      -- is_read and is_archived are two INDEPENDENT boolean axes.
      is_read INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tag (
      bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS saved_view (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      query TEXT,
      included_tags TEXT NOT NULL DEFAULT '[]',
      excluded_tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS page_capture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('html','pdf')),
      file_path TEXT,
      captured_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ready','failed'))
    );

    CREATE TABLE IF NOT EXISTS archive_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookmark_id INTEGER NOT NULL REFERENCES bookmark(id) ON DELETE CASCADE,
      snapshot_url TEXT,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','ready','failed'))
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      default_sort TEXT NOT NULL CHECK (default_sort IN ('newest','oldest','title_az','title_za','recently_updated')),
      density TEXT NOT NULL CHECK (density IN ('comfortable','compact')),
      text_size TEXT NOT NULL CHECK (text_size IN ('small','medium','large'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmark_url ON bookmark(url);
    CREATE INDEX IF NOT EXISTS idx_bookmark_archived ON bookmark(is_archived);
    CREATE INDEX IF NOT EXISTS idx_bookmark_read ON bookmark(is_read);
    CREATE INDEX IF NOT EXISTS idx_bookmark_created ON bookmark(created_at);
    CREATE INDEX IF NOT EXISTS idx_bookmark_updated ON bookmark(updated_at);
    CREATE INDEX IF NOT EXISTS idx_bookmark_title ON bookmark(title);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_name ON tag(name COLLATE NOCASE);
  `);

  // Seed the singleton preferences row (T010).
  const prefs = db.prepare('SELECT id FROM preferences WHERE id = 1').get();
  if (!prefs) {
    db.prepare(
      `INSERT INTO preferences (id, default_sort, density, text_size)
       VALUES (1, 'newest', 'comfortable', 'medium')`
    ).run();
  }
}
