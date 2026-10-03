import type { BookmarkDatabase } from './client.js';

const MIGRATIONS = [
  `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL CHECK(length(url) BETWEEN 1 AND 2048),
      normalized_url TEXT NOT NULL CHECK(length(normalized_url) BETWEEN 1 AND 2048),
      title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
      description TEXT CHECK(description IS NULL OR length(description) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 50),
      normalized_name TEXT NOT NULL UNIQUE CHECK(length(normalized_name) BETWEEN 1 AND 50)
    );

    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (bookmark_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_normalized_url ON bookmarks(normalized_url);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag_bookmark ON bookmark_tags(tag_id, bookmark_id);
    CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark_tag ON bookmark_tags(bookmark_id, tag_id);
  `,
];

export function runMigrations(database: BookmarkDatabase): void {
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const hasMigration = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
  const recordMigration = database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  const apply = database.transaction(() => {
    MIGRATIONS.forEach((sql, index) => {
      const version = index + 1;
      if (!hasMigration.get(version)) {
        database.exec(sql);
        recordMigration.run(version, new Date().toISOString());
      }
    });
  });
  apply();
}
