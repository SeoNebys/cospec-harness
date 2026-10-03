import { PREFS_DEFAULTS } from '../../shared/constants.js';

// Create the schema per data-model.md. Idempotent (IF NOT EXISTS).
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      normalizedUrl TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      faviconPath TEXT,
      previewImagePath TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      snapshotType TEXT NOT NULL DEFAULT 'none',
      snapshotPath TEXT,
      snapshotStatus TEXT NOT NULL DEFAULT 'pending',
      webArchiveUrl TEXT,
      metadataStatus TEXT NOT NULL DEFAULT 'collected',
      dateAdded TEXT NOT NULL,
      dateUpdated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmarkId TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmarkId, tagId)
    );

    CREATE TABLE IF NOT EXISTS saved_filters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      query TEXT NOT NULL DEFAULT '',
      includeTags TEXT NOT NULL DEFAULT '[]',
      excludeTags TEXT NOT NULL DEFAULT '[]',
      dateCreated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS display_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      defaultSort TEXT NOT NULL,
      itemsPerPage INTEGER NOT NULL,
      fontSize TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(archived);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_dateAdded ON bookmarks(dateAdded);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tagId);
  `);

  // Seed the singleton preferences row if absent.
  const prefs = db.prepare('SELECT id FROM display_preferences WHERE id = 1').get();
  if (!prefs) {
    db.prepare(
      `INSERT INTO display_preferences (id, defaultSort, itemsPerPage, fontSize)
       VALUES (1, ?, ?, ?)`
    ).run(PREFS_DEFAULTS.defaultSort, PREFS_DEFAULTS.itemsPerPage, PREFS_DEFAULTS.fontSize);
  }
}
